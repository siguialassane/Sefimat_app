import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
    ArrowLeft,
    Search,
    Eye,
    Users,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export function SectionRegistrations() {
    const context = useOutletContext();
    const president = context?.president;
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [inscriptions, setInscriptions] = useState([]);
    const [filteredInscriptions, setFilteredInscriptions] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");

    useEffect(() => {
        if (president?.id) {
            loadSectionRegistrations();
        }
    }, [president]);

    useEffect(() => {
        filterInscriptions();
    }, [searchTerm, filterStatus, inscriptions]);

    const loadSectionRegistrations = async () => {
        if (!president?.id) return;
        
        setLoading(true);
        try {
            const { data } = await supabase
                .from('inscriptions')
                .select('*')
                .eq('chef_quartier_id', president.id)
                .order('created_at', { ascending: false });

            if (data) {
                setInscriptions(data);
                setFilteredInscriptions(data);
            }
        } catch (error) {
            console.error('Erreur chargement inscriptions:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterInscriptions = () => {
        let filtered = inscriptions;

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(ins => 
                ins.nom?.toLowerCase().includes(search) ||
                ins.prenom?.toLowerCase().includes(search) ||
                ins.telephone?.includes(search) ||
                ins.email?.toLowerCase().includes(search)
            );
        }

        if (filterStatus !== "all") {
            filtered = filtered.filter(ins => ins.statut_paiement === filterStatus);
        }

        setFilteredInscriptions(filtered);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "soldé":
            case "valide_financier":
                return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Soldé</Badge>;
            case "partiel":
                return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Partiel</Badge>;
            default:
                return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Non payé</Badge>;
        }
    };

    const formatMontant = (montant) => {
        return new Intl.NumberFormat('fr-FR').format(montant || 0) + ' FCFA';
    };

    return (
        <div className="h-full flex flex-col overflow-y-auto">
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-4 sm:px-8 flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('..')}
                            className="gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Retour</span>
                        </Button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-text-main dark:text-white">
                                Inscriptions de ma Section
                            </h1>
                            <p className="text-sm text-text-secondary">
                                {filteredInscriptions.length} sur {inscriptions.length} inscrits
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={loadSectionRegistrations} variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-8">
                <div className="max-w-7xl mx-auto">
                    <Card className="mb-6">
                        <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                        <Input
                                            type="text"
                                            placeholder="Rechercher par nom, prénom, téléphone, email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="px-4 py-2 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark rounded-lg text-text-main dark:text-white"
                                    >
                                        <option value="all">Tous les statuts</option>
                                        <option value="soldé">Soldé</option>
                                        <option value="valide_financier">Validé financier</option>
                                        <option value="partiel">Partiel</option>
                                        <option value="non_payé">Non payé</option>
                                    </select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Liste des Inscrits de ma Section
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                        <p className="text-text-secondary">Chargement...</p>
                                    </div>
                                </div>
                            ) : filteredInscriptions.length === 0 ? (
                                <div className="text-center py-12">
                                    <Users className="h-16 w-16 text-text-secondary mx-auto mb-4" />
                                    <p className="text-text-secondary">
                                        {searchTerm || filterStatus !== "all" 
                                            ? "Aucun résultat pour cette recherche"
                                            : "Aucune inscription"}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredInscriptions.map((inscription) => (
                                        <div
                                            key={inscription.id}
                                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                                {inscription.photo_url ? (
                                                    <img
                                                        src={inscription.photo_url}
                                                        alt={inscription.nom}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-sm text-gray-400 font-bold">
                                                        {inscription.nom?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-text-main dark:text-white truncate text-sm">
                                                    {inscription.nom} {inscription.prenom}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    {inscription.age} ans • {inscription.sexe === 'homme' ? 'H' : 'F'}
                                                </p>
                                            </div>

                                            <div className="md:hidden text-xs text-text-secondary">
                                                {inscription.telephone || '-'}
                                            </div>

                                            <div className="hidden sm:flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="font-bold text-green-600 text-sm">
                                                        {formatMontant(inscription.montant_total_paye)}
                                                    </p>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    {getStatusBadge(inscription.statut_paiement)}
                                                </div>
                                            </div>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1 flex-shrink-0 h-8 px-2"
                                                onClick={() => navigate(`/admin/President/inscription/${inscription.id}`)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
