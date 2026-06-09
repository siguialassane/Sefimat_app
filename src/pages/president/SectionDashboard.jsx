import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
    Users,
    TrendingUp,
    CheckCircle,
    AlertCircle,
    RefreshCw,
    Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export function SectionDashboard() {
    const context = useOutletContext();
    const president = context?.president;
    
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalMembers: 0,
        fullyPaid: 0,
        partiallyPaid: 0,
        totalCollected: 0,
        totalRemaining: 0,
        collectionRate: 0,
    });
    const [recentRegistrations, setRecentRegistrations] = useState([]);

    useEffect(() => {
        if (president?.id) {
            loadSectionData();
        }
    }, [president]);

    const loadSectionData = async () => {
        if (!president?.id) return;
        
        setLoading(true);
        try {
            const { data: inscriptions, error } = await supabase
                .from('inscriptions')
                .select('*')
                .eq('chef_quartier_id', president.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erreur chargement inscriptions:', error);
                setLoading(false);
                return;
            }

            if (!inscriptions) {
                setLoading(false);
                return;
            }

            const totalMembers = inscriptions.length;
            const totalCollected = inscriptions.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0);
            const totalRequired = totalMembers * 4000;
            const totalRemaining = totalRequired - totalCollected;

            setStats({
                totalMembers,
                fullyPaid: inscriptions.filter(i => i.statut_paiement === 'soldé' || i.statut_paiement === 'valide_financier').length,
                partiallyPaid: inscriptions.filter(i => i.statut_paiement === 'partiel').length,
                totalCollected,
                totalRemaining,
                collectionRate: totalMembers > 0 ? Math.round((totalCollected / totalRequired) * 100) : 0,
            });

            setRecentRegistrations(inscriptions.slice(0, 5));

        } catch (error) {
            console.error('Erreur chargement données section:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatMontant = (montant) => {
        return new Intl.NumberFormat('fr-FR').format(montant || 0) + ' FCFA';
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

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary">Chargement des données...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-y-auto">
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-4 sm:px-8 flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-text-main dark:text-white tracking-tight">
                            Tableau de Bord - {president?.zone || 'Ma Section'}
                        </h1>
                        <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                            {president?.nom_complet || 'Chef de section'}
                        </p>
                    </div>
                    <div className="flex gap-2 self-start sm:self-auto">
                        <ThemeToggle />
                        <Button onClick={loadSectionData} variant="outline" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            <span className="hidden sm:inline">Actualiser</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-8">
                <div className="space-y-6 max-w-7xl mx-auto">
                    {/* Stats essentielles */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <Card className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex-shrink-0">
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-text-secondary">Total inscrits</p>
                                    <p className="text-xl sm:text-2xl font-bold text-text-main dark:text-white">
                                        {stats.totalMembers}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 flex-shrink-0">
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-text-secondary">Soldés</p>
                                    <p className="text-xl sm:text-2xl font-bold text-green-600">
                                        {stats.fullyPaid}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex-shrink-0">
                                    <AlertCircle className="h-5 w-5 text-amber-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-text-secondary">Partiels</p>
                                    <p className="text-xl sm:text-2xl font-bold text-amber-600">
                                        {stats.partiallyPaid}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex-shrink-0">
                                    <TrendingUp className="h-5 w-5 text-purple-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-text-secondary">Taux collecte</p>
                                    <p className="text-xl sm:text-2xl font-bold text-purple-600">
                                        {stats.collectionRate}%
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Finances */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 flex-shrink-0">
                                    <Wallet className="h-6 w-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Total collecté</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {formatMontant(stats.totalCollected)}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 flex-shrink-0">
                                    <Wallet className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Reste à collecter</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        {formatMontant(stats.totalRemaining)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Inscriptions Récentes - SANS bouton Voir toutes */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Inscriptions Récentes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {recentRegistrations.length === 0 ? (
                                <p className="text-text-secondary text-center py-8">Aucune inscription pour votre section</p>
                            ) : (
                                <div className="space-y-2">
                                    {recentRegistrations.map((inscription) => (
                                        <div
                                            key={inscription.id}
                                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                                {inscription.photo_url ? (
                                                    <img
                                                        src={inscription.photo_url}
                                                        alt={inscription.nom}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
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
                                            <div className="text-right">
                                                <p className="font-bold text-green-600 text-sm">
                                                    {formatMontant(inscription.montant_total_paye)}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {getStatusBadge(inscription.statut_paiement)}
                                            </div>
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
