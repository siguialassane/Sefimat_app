import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, useData } from "@/contexts";
import { PaymentFilters, PaymentTable, PaymentModal } from "./components";
import { Card } from "@/components/ui/card";
import { notify } from "@/components/ui/toast";
import {
    isFinanceApproved,
    isFinanceRejected,
    isFinanceValidationPending,
} from "@/lib/finance";

export function PaymentValidation() {
    const { user } = useAuth();
    const {
        inscriptions: allInscriptions,
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

            return inscription.type_inscription === "presentielle" && inscription.statut_paiement === "partiel";
        });
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

    const handleValidate = async (inscriptionId) => {
        if (!user?.id) {
            notify.error("Utilisateur non connecté. Veuillez vous reconnecter.", { title: "Accès refusé" });
            return;
        }

        setActionLoading(true);
        try {
            const inscription = allInscriptions.find((item) => item.id === inscriptionId);
            const updateData = {
                statut_paiement: "valide_financier",
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
            notify.success("Paiement validé et pris en compte par la finance.", {
                title: "Validation finance",
            });
        } catch (error) {
            console.error("Erreur validation:", error);
            notify.error("Erreur lors de la validation", { title: "Validation impossible" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (inscriptionId) => {
        if (!user?.id) {
            notify.error("Utilisateur non connecté. Veuillez vous reconnecter.", { title: "Accès refusé" });
            return;
        }

        if (!confirm("Êtes-vous sûr de vouloir refuser ce paiement ?")) return;

        setActionLoading(true);
        try {
            const inscription = allInscriptions.find((item) => item.id === inscriptionId);
            const updateData = {
                statut_paiement: "refuse",
                valide_par_financier: user.id,
                date_validation_financier: new Date().toISOString(),
            };

            if (inscription?.created_by === "president") {
                updateData.workflow_status = "rejected";
            } else {
                updateData.statut_workflow = "rejete";
            }

            const { error } = await supabase
                .from("inscriptions")
                .update(updateData)
                .eq("id", inscriptionId);

            if (error) throw error;

            updateInscriptionLocal(inscriptionId, updateData);

            setModalOpen(false);
            setSelectedInscription(null);
            notify.warning("Paiement refusé.", { title: "Refus enregistré" });
        } catch (error) {
            console.error("Erreur refus:", error);
            notify.error("Erreur lors du refus", { title: "Refus impossible" });
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                        Validation des Paiements
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Montants en attente de validation par la finance
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
                                <p className="text-sm text-text-secondary">Paiements en attente</p>
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
                        onReject={handleReject}
                        actionLoading={actionLoading}
                        showActions={true}
                        emptyMessage="Aucun paiement en attente"
                        emptyDescription="Tous les paiements ont déjà été traités."
                    />
                </div>
            </div>

            {modalOpen && selectedInscription && (
                <PaymentModal
                    inscription={selectedInscription}
                    onClose={() => {
                        setModalOpen(false);
                        setSelectedInscription(null);
                    }}
                    onValidate={handleValidate}
                    onReject={handleReject}
                    actionLoading={actionLoading}
                    showActions={true}
                />
            )}
        </div>
    );
}
