import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, useData } from "@/contexts";
import { PaymentFilters, PaymentTable, PaymentModal } from "./components";
import { Card } from "@/components/ui/card";

export function PaymentValidation() {
    const { user } = useAuth();
    
    const { 
        inscriptions: allInscriptions,
        chefsQuartier,
        loading, 
        refresh,
        updateInscriptionLocal
    } = useData();
    
    const [searchTerm, setSearchTerm] = useState("");
    const [filterChef, setFilterChef] = useState("");
    const [selectedInscription, setSelectedInscription] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Filtrer uniquement les paiements en attente de validation
    const paiementsEnAttente = useMemo(() => {
        return allInscriptions.filter(i => 
            (i.statut_paiement === "partiel" || i.statut_paiement === "non_payé") &&
            i.statut_paiement !== "valide_financier" &&
            i.statut_paiement !== "soldé" &&
            (i.montant_total_paye || 0) < (i.montant_requis || 4000)
        );
    }, [allInscriptions]);

    // Filtrer selon les critères de recherche
    const filteredInscriptions = useMemo(() => {
        let filtered = [...paiementsEnAttente];
        
        // Filtre par président de section
        if (filterChef) {
            if (filterChef === "presentiel") {
                filtered = filtered.filter(i => !i.chef_quartier_id);
            } else {
                filtered = filtered.filter(i => i.chef_quartier_id === filterChef);
            }
        }
        
        // Filtre par recherche
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(i =>
                `${i.nom} ${i.prenom}`.toLowerCase().includes(term) ||
                i.reference_id?.toLowerCase().includes(term)
            );
        }
        
        return filtered;
    }, [paiementsEnAttente, filterChef, searchTerm]);

    const handleRefresh = useCallback(() => {
        refresh();
    }, [refresh]);

    const handleValidate = async (inscriptionId) => {
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from("inscriptions")
                .update({
                    statut_paiement: "valide_financier",
                    valide_par_financier: user.id,
                    date_validation_financier: new Date().toISOString(),
                })
                .eq("id", inscriptionId);

            if (error) throw error;

            updateInscriptionLocal(inscriptionId, {
                statut_paiement: "valide_financier",
                valide_par_financier: user.id,
                date_validation_financier: new Date().toISOString(),
            });
            
            setModalOpen(false);
            setSelectedInscription(null);
        } catch (error) {
            console.error("Erreur validation:", error);
            alert("Erreur lors de la validation");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (inscriptionId) => {
        if (!confirm("Êtes-vous sûr de vouloir refuser ce paiement ?")) return;

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from("inscriptions")
                .update({
                    statut_paiement: "refuse",
                    valide_par_financier: user.id,
                    date_validation_financier: new Date().toISOString(),
                })
                .eq("id", inscriptionId);

            if (error) throw error;

            updateInscriptionLocal(inscriptionId, {
                statut_paiement: "refuse",
                valide_par_financier: user.id,
                date_validation_financier: new Date().toISOString(),
            });
            
            setModalOpen(false);
            setSelectedInscription(null);
        } catch (error) {
            console.error("Erreur refus:", error);
            alert("Erreur lors du refus");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                        Validation des Paiements
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Paiements en attente de validation par l'administration
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    {/* Stats Card */}
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

                    {/* Filters */}
                    <PaymentFilters
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        filterChef={filterChef}
                        onChefChange={setFilterChef}
                        chefsQuartier={chefsQuartier}
                    />

                    {/* Table */}
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
                        emptyDescription="Tous les paiements ont été traités."
                    />
                </div>
            </div>

            {/* Detail Modal */}
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
