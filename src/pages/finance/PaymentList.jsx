import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, CheckCheck, DollarSign } from "lucide-react";
import { useData } from "@/contexts";
import { PaymentFilters, PaymentTable, PaymentModal } from "./components";
import { Card } from "@/components/ui/card";

export function PaymentList() {
    const { 
        inscriptions: allInscriptions,
        chefsQuartier,
        loading, 
        refresh,
    } = useData();
    
    const [searchTerm, setSearchTerm] = useState("");
    const [filterChef, setFilterChef] = useState("");
    const [filterStatus, setFilterStatus] = useState("tous"); // "tous", "solde", "valide_financier"
    const [selectedInscription, setSelectedInscription] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Filtrer uniquement les paiements validés (4000 FCFA ou validé par admin)
    const paiementsValides = useMemo(() => {
        return allInscriptions.filter(i => 
            i.statut_paiement === "valide_financier" || 
            i.statut_paiement === "soldé" ||
            (i.montant_total_paye || 0) >= (i.montant_requis || 4000)
        );
    }, [allInscriptions]);

    // Statistiques des paiements validés
    const stats = useMemo(() => {
        const soldes = paiementsValides.filter(i => 
            (i.montant_total_paye || 0) >= (i.montant_requis || 4000)
        ).length;
        
        const validesAdmin = paiementsValides.filter(i => 
            i.statut_paiement === "valide_financier"
        ).length;
        
        const totalCollecte = paiementsValides.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0);
        
        return { soldes, validesAdmin, totalCollecte, total: paiementsValides.length };
    }, [paiementsValides]);

    // Filtrer les inscriptions selon les critères
    const filteredInscriptions = useMemo(() => {
        let filtered = [...paiementsValides];
        
        // Filtre par type de validation
        if (filterStatus === "solde") {
            filtered = filtered.filter(i => 
                (i.montant_total_paye || 0) >= (i.montant_requis || 4000)
            );
        } else if (filterStatus === "valide_financier") {
            filtered = filtered.filter(i => 
                i.statut_paiement === "valide_financier"
            );
        }
        
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
    }, [paiementsValides, filterStatus, filterChef, searchTerm]);

    const handleRefresh = useCallback(() => {
        refresh();
    }, [refresh]);

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    // Export CSV
    const exportToCSV = () => {
        const headers = ["Référence", "Nom", "Prénom", "Téléphone", "Président", "Montant payé", "Statut", "Date"];
        const rows = filteredInscriptions.map(i => [
            i.reference_id || "",
            i.nom,
            i.prenom,
            i.telephone || "",
            i.chef_quartier?.nom_complet || "Présentiel",
            i.montant_total_paye || 0,
            i.statut_paiement,
            new Date(i.created_at).toLocaleDateString("fr-FR"),
        ]);

        const csvContent = "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `liste_paiements_valides_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                        Liste des Paiements
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Participants ayant payé 4000 FCFA ou validés par l'administration
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                    <Button onClick={exportToCSV} className="gap-2">
                        <Download className="h-4 w-4" />
                        Exporter CSV
                    </Button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Soldé (4000 FCFA)</p>
                                    <p className="text-xl font-bold text-blue-600">{stats.soldes}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                    <CheckCheck className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Validé par admin</p>
                                    <p className="text-xl font-bold text-emerald-600">{stats.validesAdmin}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                                    <DollarSign className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Total collecté</p>
                                    <p className="text-xl font-bold text-purple-600">{formatMontant(stats.totalCollecte)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <CheckCheck className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Total validés</p>
                                    <p className="text-xl font-bold text-primary">{stats.total}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Filters */}
                    <PaymentFilters
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        filterChef={filterChef}
                        onChefChange={setFilterChef}
                        chefsQuartier={chefsQuartier}
                        showStatusFilter={true}
                        filterStatus={filterStatus}
                        onStatusChange={setFilterStatus}
                    />

                    {/* Table */}
                    <PaymentTable
                        inscriptions={filteredInscriptions}
                        loading={loading}
                        onViewDetails={(inscription) => {
                            setSelectedInscription(inscription);
                            setModalOpen(true);
                        }}
                        showActions={false}
                        emptyMessage="Aucun paiement validé"
                        emptyDescription="Aucun participant n'a encore payé 4000 FCFA ou n'a été validé."
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
                    showActions={false}
                />
            )}
        </div>
    );
}
