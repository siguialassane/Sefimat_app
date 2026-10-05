import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, useData } from "@/contexts";
import { PaymentFilters, PaymentTable, PaymentModal } from "./components";
import { Card } from "@/components/ui/card";
import { notify } from "@/components/ui/toast";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import {
    canCancelFinanceValidation,
    canUnrejectFinance,
    getRemainingDue,
    isFinanceApproved,
    isFinanceRejected,
    isFinanceValidationPending,
} from "@/lib/finance";

export function PaymentValidation() {
    const { user } = useAuth();
    const {
        inscriptions: allInscriptions,
        paiements,
        chefsQuartier,
        loading,
        refresh,
        updateInscriptionLocal,
    } = useData();

    const [searchTerm, setSearchTerm] = useState("");
    const [filterChef, setFilterChef] = useState("");
    const [selectedInscription, setSelectedInscription] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [paymentDialogFor, setPaymentDialogFor] = useState(null);

    const formatMontant = (montant) => {
        return `${new Intl.NumberFormat("fr-FR").format(montant || 0)} FCFA`;
    };

    const paiementsEnAttente = useMemo(() => {
        return allInscriptions.filter((inscription) => {
            if (isFinanceApproved(inscription) || isFinanceRejected(inscription)) {
                return false;
            }

            if (isFinanceValidationPending(inscription)) {
                return (inscription.montant_total_paye || 0) > 0;
            }

            if (
                inscription.type_inscription === "en_ligne" &&
                inscription.statut_workflow === "en_attente_finance" &&
                inscription.created_by !== "president"
            ) {
                return inscription.statut_paiement === "partiel" || inscription.statut_paiement === "non_payé";
            }

            // Les inscriptions présentielles sont validées définitivement au guichet :
            // elles n'apparaissent plus dans la file de validation finance.
            return false;
        });
    }, [allInscriptions]);

    const paiementsRefuses = useMemo(() => {
        return allInscriptions.filter((inscription) => isFinanceRejected(inscription));
    }, [allInscriptions]);

    const dossiersValides = useMemo(() => {
        return allInscriptions.filter((inscription) => canCancelFinanceValidation(inscription));
    }, [allInscriptions]);

    const filteredInscriptions = useMemo(() => {
        let filtered = [...paiementsEnAttente];

        if (filterChef) {
            if (filterChef === "presentiel") {
                filtered = filtered.filter((inscription) => !inscription.chef_quartier_id);
            } else {
                filtered = filtered.filter((inscription) => inscription.chef_quartier_id === filterChef);
            }
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter((inscription) =>
                `${inscription.nom} ${inscription.prenom}`.toLowerCase().includes(term) ||
                inscription.reference_id?.toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [paiementsEnAttente, filterChef, searchTerm]);

    const handleRefresh = useCallback(() => {
        refresh();
        notify.success("Liste des validations actualisée.", { title: "Actualisation réussie" });
    }, [refresh]);

    // Scénario 2a : valider = envoyer le dossier au secrétariat (dortoir),
    // MÊME partiel. La dette reste suivie (pas d'abandon auto) et la réception
    // des versements continue en caisse. Les refus se font par versement (Caisse).
    const handleValidate = async (inscriptionId) => {
        if (!user?.id) {
            notify.error("Utilisateur non connecté. Veuillez vous reconnecter.", { title: "Accès refusé" });
            return;
        }

        setActionLoading(true);
        try {
            const inscription = allInscriptions.find((item) => item.id === inscriptionId);
            const updateData = {
                valide_par_financier: user.id,
                date_validation_financier: new Date().toISOString(),
            };

            if (inscription?.created_by === "president") {
                updateData.workflow_status = "pending_secretariat";
            } else {
                updateData.statut_workflow = "en_attente_secretariat";
            }

            const { error } = await supabase
                .from("inscriptions")
                .update(updateData)
                .eq("id", inscriptionId);

            if (error) throw error;

            updateInscriptionLocal(inscriptionId, updateData);

            setModalOpen(false);
            setSelectedInscription(null);
            const reste = getRemainingDue(inscription);
            notify.success(
                reste > 0
                    ? `Dossier envoyé au secrétariat. Reste dû suivi : ${formatMontant(reste)} (le président continue d'encaisser).`
                    : "Dossier soldé envoyé au secrétariat.",
                { title: "Validation finance" }
            );
        } catch (error) {
            console.error("Erreur validation:", error);
            notify.error("Erreur lors de la validation", { title: "Validation impossible" });
        } finally {
            setActionLoading(false);
        }
    };

    // Abandon explicite du reliquat (geste séparé de la validation).
    const handleAbandon = async (inscriptionId) => {
        const inscription = allInscriptions.find((item) => item.id === inscriptionId);
        if (!inscription) return;
        const reliquat = getRemainingDue(inscription);
        if (reliquat <= 0) {
            notify.warning("Il n'y a aucun reliquat à abandonner.", { title: "Abandon impossible" });
            return;
        }
        if (!confirm(`Abandonner le reliquat de ${formatMontant(reliquat)} pour ${inscription.nom} ${inscription.prenom} ? Il ne sera plus dû.`)) return;

        setActionLoading(true);
        try {
            const updateData = { montant_non_du: reliquat };
            const { error } = await supabase
                .from("inscriptions")
                .update(updateData)
                .eq("id", inscriptionId);
            if (error) throw error;

            updateInscriptionLocal(inscriptionId, updateData);
            setSelectedInscription((prev) => (prev?.id === inscriptionId ? { ...prev, ...updateData } : prev));
            notify.success(`${formatMontant(reliquat)} déclaré(s) non dû(s).`, {
                title: "Reliquat abandonné",
            });
        } catch (error) {
            console.error("Erreur abandon:", error);
            notify.error("Erreur lors de l'abandon", { title: "Abandon impossible" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnreject = async (inscriptionId) => {
        const inscription = allInscriptions.find((item) => item.id === inscriptionId);
        if (!inscription) return;
        if (!canUnrejectFinance(inscription)) {
            notify.warning("Ce dossier ne peut pas être rouvert.", { title: "Réouverture impossible" });
            return;
        }

        if (!confirm("Rouvrir le dossier de " + inscription.nom + " " + inscription.prenom + " ? Il retournera en attente de validation finance.")) return;

        setActionLoading(true);
        try {
            const updateData = {
                statut_paiement: (inscription.montant_total_paye || 0) > 0 ? "partiel" : "non_payé",
                montant_non_du: 0,
                valide_par_financier: null,
                date_validation_financier: null,
            };

            if (inscription?.created_by === "president") {
                updateData.workflow_status = "pending_finance";
            } else {
                updateData.statut_workflow = "en_attente_finance";
            }

            const { error } = await supabase
                .from("inscriptions")
                .update(updateData)
                .eq("id", inscriptionId);

            if (error) throw error;

            updateInscriptionLocal(inscriptionId, updateData);

            setModalOpen(false);
            setSelectedInscription(null);
            notify.success("Refus annulé. Le dossier est de nouveau en attente finance.", {
                title: "Dossier rouvert",
            });
        } catch (error) {
            console.error("Erreur réouverture:", error);
            notify.error("Erreur lors de la réouverture", { title: "Réouverture impossible" });
        } finally {
            setActionLoading(false);
        }
    };

    // Annuler une validation : le dossier repart en attente finance.
    // Le reliquat explicitement abandonné est conservé (geste séparé).
    const handleCancelValidation = async (inscriptionId) => {
        const inscription = allInscriptions.find((item) => item.id === inscriptionId);
        if (!inscription) return;
        if (!canCancelFinanceValidation(inscription)) {
            notify.warning("Seuls les dossiers validés partiels peuvent être renvoyés en attente.", {
                title: "Annulation impossible",
            });
            return;
        }
        if (!confirm(`Renvoyer le dossier de ${inscription.nom} ${inscription.prenom} en attente finance ?`)) return;

        setActionLoading(true);
        try {
            const updateData = {
                workflow_status: "pending_finance",
                statut_paiement: (inscription.montant_total_paye || 0) > 0 ? "partiel" : "non_payé",
                valide_par_financier: null,
                date_validation_financier: null,
            };
            const { error } = await supabase
                .from("inscriptions")
                .update(updateData)
                .eq("id", inscriptionId);
            if (error) throw error;

            updateInscriptionLocal(inscriptionId, updateData);
            setModalOpen(false);
            setSelectedInscription(null);
            notify.success("Dossier renvoyé en attente finance.", { title: "Validation annulée" });
        } catch (error) {
            console.error("Erreur annulation:", error);
            notify.error("Erreur lors de l'annulation", { title: "Annulation impossible" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddPaymentOpen = (inscriptionId) => {
        const inscription = allInscriptions.find((item) => item.id === inscriptionId);
        if (inscription) setPaymentDialogFor(inscription);
    };

    const handleAddPaymentSuccess = () => {
        setPaymentDialogFor(null);
        refresh();
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                        Validation des dossiers
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Valider un dossier l'envoie au secrétariat (dortoir), même partiel — la dette reste suivie
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Actualiser
                </Button>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    <Card className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Dossiers en attente</p>
                                <p className="text-2xl font-bold text-amber-600">{paiementsEnAttente.length}</p>
                            </div>
                        </div>
                    </Card>

                    <PaymentFilters
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        filterChef={filterChef}
                        onChefChange={setFilterChef}
                        chefsQuartier={chefsQuartier}
                    />

                    <PaymentTable
                        inscriptions={filteredInscriptions}
                        loading={loading}
                        onViewDetails={(inscription) => {
                            setSelectedInscription(inscription);
                            setModalOpen(true);
                        }}
                        onValidate={handleValidate}
                        onAddPayment={handleAddPaymentOpen}
                        onAbandon={handleAbandon}
                        showAddPayment
                        showAbandon
                        actionLoading={actionLoading}
                        showActions={true}
                        emptyMessage="Aucun dossier en attente"
                        emptyDescription="Tous les dossiers ont déjà été traités."
                    />

                    <Card className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                                <Clock className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Anciens refus (dossiers)</p>
                                <p className="text-2xl font-bold text-red-600">{paiementsRefuses.length}</p>
                                <p className="text-xs text-text-secondary">Refus créés avant la caisse par versement — réouverture seule.</p>
                            </div>
                        </div>
                    </Card>

                    <PaymentTable
                        inscriptions={paiementsRefuses}
                        loading={loading}
                        onViewDetails={(inscription) => {
                            setSelectedInscription(inscription);
                            setModalOpen(true);
                        }}
                        onUnreject={handleUnreject}
                        actionLoading={actionLoading}
                        showActions={false}
                        showUnreject
                        emptyMessage="Aucun ancien refus"
                        emptyDescription="Aucun refus de dossier enregistré."
                    />

                    <Card className="p-5">
                        <div>
                            <p className="text-sm text-text-secondary">Dossiers validés (partiels)</p>
                            <p className="text-2xl font-bold text-emerald-600">{dossiersValides.length}</p>
                            <p className="text-xs text-text-secondary">Annulation, complément ou abandon du reliquat.</p>
                        </div>
                    </Card>

                    <PaymentTable
                        inscriptions={dossiersValides}
                        loading={loading}
                        onViewDetails={(inscription) => {
                            setSelectedInscription(inscription);
                            setModalOpen(true);
                        }}
                        onAddPayment={handleAddPaymentOpen}
                        onCancelValidation={handleCancelValidation}
                        onAbandon={handleAbandon}
                        showAddPayment
                        showCancelValidation
                        showAbandon
                        actionLoading={actionLoading}
                        showActions={true}
                        emptyMessage="Aucun dossier validé partiel"
                        emptyDescription="Aucun dossier à annuler, compléter ou abandonner."
                    />
                </div>
            </div>

            {modalOpen && selectedInscription && (
                <PaymentModal
                    inscription={selectedInscription}
                    paiements={paiements}
                    onClose={() => {
                        setModalOpen(false);
                        setSelectedInscription(null);
                    }}
                    onValidate={handleValidate}
                    onUnreject={handleUnreject}
                    onAddPayment={handleAddPaymentOpen}
                    onCancelValidation={handleCancelValidation}
                    onAbandon={handleAbandon}
                    actionLoading={actionLoading}
                    showActions={true}
                    showUnreject
                    showAddPayment
                    showCancelValidation
                    showAbandon
                />
            )}

            {paymentDialogFor && (
                <AddPaymentDialog
                    inscription={paymentDialogFor}
                    onClose={() => setPaymentDialogFor(null)}
                    onSuccess={handleAddPaymentSuccess}
                />
            )}
        </div>
    );
}
