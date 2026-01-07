import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Search,
    Download,
    Filter,
    DollarSign,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export function PaymentSummary() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inscriptions, setInscriptions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filters, setFilters] = useState({
        statut_paiement: "",
        chef_quartier: "",
    });
    const [chefsQuartier, setChefsQuartier] = useState([]);
    const [totals, setTotals] = useState({
        totalCollecte: 0,
        totalRestant: 0,
        nombreComplet: 0,
        nombrePartiel: 0,
    });

    useEffect(() => {
        loadData();
        loadChefsQuartier();
    }, []);

    const loadChefsQuartier = async () => {
        const { data } = await supabase
            .from("chefs_quartier")
            .select("id, nom_complet, zone")
            .order("nom_complet");
        setChefsQuartier(data || []);
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('PaymentSummary: Chargement des données...');
            const { data, error: fetchError } = await supabase
                .from("inscriptions")
                .select(`
                    *,
                    chef_quartier:chefs_quartier(id, nom_complet, zone)
                `)
                .order("created_at", { ascending: false });

            if (fetchError) {
                console.error('PaymentSummary: Erreur Supabase:', fetchError);
                throw fetchError;
            }

            console.log('PaymentSummary: Données reçues:', data?.length || 0, 'inscriptions');
            setInscriptions(data || []);

            // Calculer les totaux
            const totalCollecte = (data || []).reduce((acc, i) => acc + (i.montant_total_paye || 0), 0);
            const totalRestant = (data || []).reduce(
                (acc, i) => acc + Math.max(0, (i.montant_requis || 4000) - (i.montant_total_paye || 0)),
                0
            );
            const nombreComplet = (data || []).filter(
                (i) => i.statut_paiement === "soldé" || i.statut_paiement === "valide_financier"
            ).length;
            const nombrePartiel = (data || []).filter((i) => i.statut_paiement === "partiel").length;

            setTotals({ totalCollecte, totalRestant, nombreComplet, nombrePartiel });
        } catch (err) {
            console.error("PaymentSummary: Exception chargement:", err);
            setError(err.message || "Erreur lors du chargement des données");
        } finally {
            setLoading(false);
        }
    };

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const getStatutBadge = (statut) => {
        switch (statut) {
            case "soldé":
                return <Badge variant="success">Soldé</Badge>;
            case "valide_financier":
                return <Badge variant="success">Validé</Badge>;
            case "partiel":
                return <Badge variant="warning">Partiel</Badge>;
            case "refuse":
                return <Badge variant="destructive">Refusé</Badge>;
            default:
                return <Badge variant="secondary">Non payé</Badge>;
        }
    };

    const filteredInscriptions = inscriptions.filter((i) => {
        const matchesSearch = `${i.nom} ${i.prenom}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        const matchesStatut =
            !filters.statut_paiement || i.statut_paiement === filters.statut_paiement;
        const matchesChef =
            !filters.chef_quartier || i.chef_quartier?.id === filters.chef_quartier;
        return matchesSearch && matchesStatut && matchesChef;
    });

    const exportToCSV = () => {
        const headers = [
            "Référence",
            "Nom",
            "Prénom",
            "Téléphone",
            "Président de section",
            "Montant payé",
            "Montant requis",
            "Statut",
            "Date inscription",
        ];
        const rows = filteredInscriptions.map((i) => [
            i.reference_id || "",
            i.nom,
            i.prenom,
            i.telephone || "",
            i.chef_quartier?.nom_complet || "Présentiel",
            i.montant_total_paye || 0,
            i.montant_requis || 4000,
            i.statut_paiement,
            new Date(i.created_at).toLocaleDateString("fr-FR"),
        ]);

        const csvContent =
            "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `recapitulatif_paiements_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight flex items-center gap-2">
                        <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
                        Récapitulatif des Paiements
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Vue d'ensemble de tous les paiements
                    </p>
                </div>
                <Button className="gap-2" onClick={exportToCSV}>
                    <Download className="h-4 w-4" />
                    Exporter CSV
                </Button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                    <DollarSign className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Total collecté</p>
                                    <p className="text-xl font-bold text-emerald-600">
                                        {formatMontant(totals.totalCollecte)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                                    <DollarSign className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Total restant</p>
                                    <p className="text-xl font-bold text-red-600">
                                        {formatMontant(totals.totalRestant)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Paiements complets</p>
                                    <p className="text-xl font-bold text-blue-600">{totals.nombreComplet}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Paiements partiels</p>
                                    <p className="text-xl font-bold text-blue-600">{totals.nombrePartiel}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="mb-1.5 block text-xs">Recherche</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                    <Input
                                        placeholder="Nom ou prénom..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-xs">Statut paiement</Label>
                                <Select
                                    value={filters.statut_paiement}
                                    onChange={(e) =>
                                        setFilters({ ...filters, statut_paiement: e.target.value })
                                    }
                                >
                                    <option value="">Tous les statuts</option>
                                    <option value="soldé">Soldé</option>
                                    <option value="valide_financier">Validé par financier</option>
                                    <option value="partiel">Partiel</option>
                                    <option value="non_payé">Non payé</option>
                                    <option value="refuse">Refusé</option>
                                </Select>
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-xs">Président de section</Label>
                                <Select
                                    value={filters.chef_quartier}
                                    onChange={(e) =>
                                        setFilters({ ...filters, chef_quartier: e.target.value })
                                    }
                                >
                                    <option value="">Tous</option>
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
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-text-secondary">Chargement...</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                            <tr>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">
                                                    Référence
                                                </th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">
                                                    Participant
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
                                                <th className="p-4 font-semibold text-text-main dark:text-white">
                                                    Date
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                            {filteredInscriptions.map((inscription) => (
                                                <tr
                                                    key={inscription.id}
                                                    className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                                >
                                                    <td className="p-4 font-mono text-sm text-primary">
                                                        {inscription.reference_id || "N/A"}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                                                                {inscription.photo_url ? (
                                                                    <img
                                                                        src={inscription.photo_url}
                                                                        alt={inscription.nom}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <span className="text-sm text-gray-400">
                                                                        {inscription.nom?.charAt(0)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-text-main dark:text-white">
                                                                    {inscription.nom} {inscription.prenom}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-text-secondary">
                                                        {inscription.chef_quartier?.nom_complet || "Présentiel"}
                                                    </td>
                                                    <td className="p-4 text-center font-bold text-emerald-600">
                                                        {formatMontant(inscription.montant_total_paye)}
                                                    </td>
                                                    <td className="p-4 text-center font-medium text-red-500">
                                                        {formatMontant(
                                                            Math.max(
                                                                0,
                                                                (inscription.montant_requis || 4000) -
                                                                (inscription.montant_total_paye || 0)
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {getStatutBadge(inscription.statut_paiement)}
                                                    </td>
                                                    <td className="p-4 text-text-secondary text-sm">
                                                        {new Date(inscription.created_at).toLocaleDateString("fr-FR")}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination placeholder */}
                                <div className="bg-surface-light dark:bg-surface-dark px-4 py-3 flex items-center justify-between border-t border-border-light dark:border-border-dark">
                                    <p className="text-sm text-text-secondary">
                                        <span className="font-medium text-text-main dark:text-white">
                                            {filteredInscriptions.length}
                                        </span>{" "}
                                        résultats
                                    </p>
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
