import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Search,
    CheckCircle,
    XCircle,
    Eye,
    DollarSign,
    X,
    RefreshCw,
    Download,
    Filter,
    Users,
    Clock,
    CheckCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, useData } from "@/contexts";

export function PaymentValidation() {
    const { user } = useAuth();
    
    // Utiliser le DataContext global
    const { 
        inscriptions: allInscriptions,
        chefsQuartier,
        loading, 
        refresh,
        updateInscriptionLocal
    } = useData();
    
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("en_attente"); // "en_attente", "valides", "tous"
    const [filterChef, setFilterChef] = useState("");
    const [selectedInscription, setSelectedInscription] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Calculer les statistiques
    const stats = useMemo(() => {
        const enAttente = allInscriptions.filter(i => 
            (i.statut_paiement === "partiel" || i.statut_paiement === "non_payé") &&
            (i.montant_total_paye || 0) < (i.montant_requis || 4000)
        ).length;
        
        const valides = allInscriptions.filter(i => 
            i.statut_paiement === "valide_financier" || 
            i.statut_paiement === "soldé" ||
            (i.montant_total_paye || 0) >= (i.montant_requis || 4000)
        ).length;
        
        const totalCollecte = allInscriptions.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0);
        const totalRestant = allInscriptions.reduce(
            (acc, i) => acc + Math.max(0, (i.montant_requis || 4000) - (i.montant_total_paye || 0)),
            0
        );
        
        return { enAttente, valides, totalCollecte, totalRestant, total: allInscriptions.length };
    }, [allInscriptions]);

    // Filtrer les inscriptions selon le filtre actif
    const filteredInscriptions = useMemo(() => {
        let filtered = [...allInscriptions];
        
        // Filtre par statut
        if (filterStatus === "en_attente") {
            filtered = filtered.filter(i => 
                (i.statut_paiement === "partiel" || i.statut_paiement === "non_payé") &&
                (i.montant_total_paye || 0) < (i.montant_requis || 4000)
            );
        } else if (filterStatus === "valides") {
            filtered = filtered.filter(i => 
                i.statut_paiement === "valide_financier" || 
                i.statut_paiement === "soldé" ||
                (i.montant_total_paye || 0) >= (i.montant_requis || 4000)
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
    }, [allInscriptions, filterStatus, filterChef, searchTerm]);

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

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const getStatutBadge = (inscription) => {
        if (inscription.statut_paiement === "valide_financier") {
            return <Badge className="bg-emerald-500 text-white">Validé</Badge>;
        }
        if (inscription.statut_paiement === "soldé" || (inscription.montant_total_paye || 0) >= (inscription.montant_requis || 4000)) {
            return <Badge className="bg-blue-500 text-white">Soldé</Badge>;
        }
        if (inscription.statut_paiement === "refuse") {
            return <Badge variant="destructive">Refusé</Badge>;
        }
        if (inscription.statut_paiement === "partiel") {
            return <Badge className="bg-amber-500 text-white">Partiel</Badge>;
        }
        return <Badge variant="secondary">Non payé</Badge>;
    };

    // Export CSV
    const exportToCSV = () => {
        const headers = ["Référence", "Nom", "Prénom", "Téléphone", "Président", "Montant payé", "Reste", "Statut", "Date"];
        const rows = filteredInscriptions.map(i => [
            i.reference_id || "",
            i.nom,
            i.prenom,
            i.telephone || "",
            i.chef_quartier?.nom_complet || "Présentiel",
            i.montant_total_paye || 0,
            Math.max(0, (i.montant_requis || 4000) - (i.montant_total_paye || 0)),
            i.statut_paiement,
            new Date(i.created_at).toLocaleDateString("fr-FR"),
        ]);

        const csvContent = "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `paiements_${filterStatus}_${new Date().toISOString().split("T")[0]}.csv`);
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
                        Gestion des Paiements
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Validez et suivez tous les paiements des participants
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
                        <Card 
                            className={`p-5 cursor-pointer transition-all ${filterStatus === "en_attente" ? "ring-2 ring-amber-500" : "hover:shadow-md"}`}
                            onClick={() => setFilterStatus("en_attente")}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                    <Clock className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">En attente</p>
                                    <p className="text-xl font-bold text-amber-600">{stats.enAttente}</p>
                                </div>
                            </div>
                        </Card>
                        <Card 
                            className={`p-5 cursor-pointer transition-all ${filterStatus === "valides" ? "ring-2 ring-emerald-500" : "hover:shadow-md"}`}
                            onClick={() => setFilterStatus("valides")}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                    <CheckCheck className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Validés / Soldés</p>
                                    <p className="text-xl font-bold text-emerald-600">{stats.valides}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Total collecté</p>
                                    <p className="text-xl font-bold text-blue-600">{formatMontant(stats.totalCollecte)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card 
                            className={`p-5 cursor-pointer transition-all ${filterStatus === "tous" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                            onClick={() => setFilterStatus("tous")}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Total inscriptions</p>
                                    <p className="text-xl font-bold text-primary">{stats.total}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="mb-1.5 block text-xs">Recherche</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                    <Input
                                        placeholder="Nom, prénom ou référence..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-xs">Statut</Label>
                                <Select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="en_attente">🕐 En attente de validation</option>
                                    <option value="valides">✅ Validés / Soldés</option>
                                    <option value="tous">📋 Tous les paiements</option>
                                </Select>
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-xs">Président de section</Label>
                                <Select
                                    value={filterChef}
                                    onChange={(e) => setFilterChef(e.target.value)}
                                >
                                    <option value="">Tous</option>
                                    <option value="presentiel">🟡 Présentiel uniquement</option>
                                    {chefsQuartier.map((chef) => (
                                        <option key={chef.id} value={chef.id}>
                                            {chef.nom_complet}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </Card>

                    {/* Table */}
                    <Card className="overflow-hidden">
                        {loading && !allInscriptions.length ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-text-secondary">Chargement...</p>
                            </div>
                        ) : filteredInscriptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
                                <p className="text-text-main dark:text-white text-lg font-medium">
                                    {filterStatus === "en_attente" ? "Aucun paiement en attente" : "Aucun résultat"}
                                </p>
                                <p className="text-text-secondary">
                                    {filterStatus === "en_attente" 
                                        ? "Tous les paiements ont été traités." 
                                        : "Aucune inscription ne correspond à vos critères."}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                            <tr>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">
                                                    Participant
                                                </th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">
                                                    Référence
                                                </th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">
                                                    Président de section
                                                </th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white text-center">
                                                    Montant payé
                                                </th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white text-center">
                                                    Reste
                                                </th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white text-center">
                                                    Statut
                                                </th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white text-right">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                            {filteredInscriptions.map((inscription) => {
                                                const isPresentiel = !inscription.chef_quartier_id;
                                                const isComplete = (inscription.montant_total_paye || 0) >= (inscription.montant_requis || 4000);
                                                const isValidated = inscription.statut_paiement === "valide_financier" || inscription.statut_paiement === "soldé";
                                                
                                                return (
                                                    <tr
                                                        key={inscription.id}
                                                        className={`transition-colors ${
                                                            isComplete || isValidated
                                                                ? "bg-emerald-50/30 dark:bg-emerald-900/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20"
                                                                : "hover:bg-gray-50 dark:hover:bg-white/5"
                                                        }`}
                                                    >
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                                                                    {inscription.photo_url ? (
                                                                        <img
                                                                            src={inscription.photo_url}
                                                                            alt={inscription.nom}
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-lg text-gray-400">
                                                                            {inscription.nom?.charAt(0)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-text-main dark:text-white">
                                                                        {inscription.nom} {inscription.prenom}
                                                                    </p>
                                                                    <p className="text-xs text-text-secondary">
                                                                        {inscription.telephone || "N/A"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 font-mono text-sm text-primary">
                                                            {inscription.reference_id || "N/A"}
                                                        </td>
                                                        <td className="p-4">
                                                            {isPresentiel ? (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                                                    🏢 Présentiel
                                                                </span>
                                                            ) : (
                                                                <span className="text-text-secondary">
                                                                    {inscription.chef_quartier?.nom_complet}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className={`font-bold ${isComplete ? "text-emerald-600" : "text-blue-600"}`}>
                                                                {formatMontant(inscription.montant_total_paye)}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {isComplete ? (
                                                                <span className="text-emerald-600 font-medium">Soldé</span>
                                                            ) : (
                                                                <span className="text-red-500">
                                                                    {formatMontant(
                                                                        (inscription.montant_requis || 4000) -
                                                                        (inscription.montant_total_paye || 0)
                                                                    )}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {getStatutBadge(inscription)}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedInscription(inscription);
                                                                        setModalOpen(true);
                                                                    }}
                                                                >
                                                                    <Eye className="h-4 w-4 mr-1" />
                                                                    Détails
                                                                </Button>
                                                                {!isComplete && !isValidated && (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            className="bg-emerald-600 hover:bg-emerald-700"
                                                                            onClick={() => handleValidate(inscription.id)}
                                                                            disabled={actionLoading}
                                                                        >
                                                                            <CheckCircle className="h-4 w-4 mr-1" />
                                                                            Valider
                                                                        </Button>
                                                                        <Button
                                                                            variant="destructive"
                                                                            size="sm"
                                                                            onClick={() => handleReject(inscription.id)}
                                                                            disabled={actionLoading}
                                                                        >
                                                                            <XCircle className="h-4 w-4" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer */}
                                <div className="bg-surface-light dark:bg-surface-dark px-4 py-3 flex items-center justify-between border-t border-border-light dark:border-border-dark">
                                    <p className="text-sm text-text-secondary">
                                        <span className="font-medium text-text-main dark:text-white">
                                            {filteredInscriptions.length}
                                        </span>{" "}
                                        résultats affichés
                                    </p>
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </div>

            {/* Detail Modal */}
            {modalOpen && selectedInscription && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg p-6 animate-fade-in">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-lg font-bold text-text-main dark:text-white">
                                Détails de l'inscription
                            </h3>
                            <button
                                onClick={() => {
                                    setModalOpen(false);
                                    setSelectedInscription(null);
                                }}
                                className="text-text-secondary hover:text-text-main"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Photo */}
                            <div className="flex justify-center">
                                <div className="h-24 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                    {selectedInscription.photo_url ? (
                                        <img
                                            src={selectedInscription.photo_url}
                                            alt={selectedInscription.nom}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-3xl text-gray-400">
                                            {selectedInscription.nom?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-text-secondary">Nom complet</p>
                                    <p className="font-medium text-text-main dark:text-white">
                                        {selectedInscription.nom} {selectedInscription.prenom}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-secondary">Téléphone</p>
                                    <p className="font-medium text-text-main dark:text-white">
                                        {selectedInscription.telephone || "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-secondary">Président de section</p>
                                    <p className="font-medium text-text-main dark:text-white">
                                        {selectedInscription.chef_quartier?.nom_complet || (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                                Présentiel
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-secondary">Date d'inscription</p>
                                    <p className="font-medium text-text-main dark:text-white">
                                        {new Date(selectedInscription.created_at).toLocaleDateString("fr-FR")}
                                    </p>
                                </div>
                            </div>

                            {/* Payment Info */}
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="h-5 w-5 text-emerald-600" />
                                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                                        Détails du paiement
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-emerald-700 dark:text-emerald-400">Montant payé</p>
                                        <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                            {formatMontant(selectedInscription.montant_total_paye)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-emerald-700 dark:text-emerald-400">Montant requis</p>
                                        <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                            {formatMontant(selectedInscription.montant_requis || 4000)}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-emerald-300 dark:border-emerald-700">
                                    <p className="text-emerald-700 dark:text-emerald-400 text-sm">Reste à payer</p>
                                    <p className="font-bold text-red-600 text-xl">
                                        {formatMontant(
                                            Math.max(0, (selectedInscription.montant_requis || 4000) -
                                            (selectedInscription.montant_total_paye || 0))
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Statut */}
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-text-secondary">Statut:</span>
                                {getStatutBadge(selectedInscription)}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setModalOpen(false);
                                    setSelectedInscription(null);
                                }}
                            >
                                Fermer
                            </Button>
                            {selectedInscription.statut_paiement !== "valide_financier" && 
                             selectedInscription.statut_paiement !== "soldé" &&
                             (selectedInscription.montant_total_paye || 0) < (selectedInscription.montant_requis || 4000) && (
                                <>
                                    <Button
                                        variant="destructive"
                                        onClick={() => handleReject(selectedInscription.id)}
                                        disabled={actionLoading}
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Refuser
                                    </Button>
                                    <Button
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        onClick={() => handleValidate(selectedInscription.id)}
                                        disabled={actionLoading}
                                    >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Valider
                                    </Button>
                                </>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
