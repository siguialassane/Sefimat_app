import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
    Users,
    CreditCard,
    TrendingUp,
    CheckCircle,
    AlertCircle,
    Clock,
    UserCheck,
    Phone,
    RefreshCw,
    Wallet,
    PieChart,
    LogOut,
    Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notify } from "@/components/ui/toast";
import { useAuth } from "@/contexts";
import {
    getFinanceBadgeClasses,
    getFinanceStatusMeta,
} from "@/lib/finance";

export function PresidentDashboard() {
    const context = useOutletContext();
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalMembers: 0,
        fullyPaid: 0,
        partiallyPaid: 0,
        unpaid: 0,
        totalCollected: 0,
        totalRemaining: 0, // Reste à payer
        collectionRate: 0,
        pendingFinance: 0,
        pendingSecretariat: 0,
        completed: 0,
        male: 0,
        female: 0,
        ageGroups: {
            '5-9': 0,
            '10-14': 0,
            '15-17': 0,
            '18-25': 0,
            '26-35': 0,
        },
    });
    const [recentRegistrations, setRecentRegistrations] = useState([]);
    const [recentPayments, setRecentPayments] = useState([]);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Use the database view for stats
            const { data: statsData, error: statsError } = await supabase
                .from('v_global_dashboard_stats')
                .select('*')
                .single();
            
            if (statsError) {
                console.error('Erreur vue stats:', statsError);
                // Fallback: fetch directement si la vue n'existe pas
                const { data: inscriptions } = await supabase
                    .from('inscriptions')
                    .select('*');
                
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
                unpaid: inscriptions.filter(i => i.statut_paiement === 'non_payé' || !i.statut_paiement).length,
                totalCollected,
                totalRemaining,
                collectionRate: totalMembers > 0 ? Math.round((totalCollected / totalRequired) * 100) : 0,
                pendingFinance: inscriptions.filter(i => i.workflow_status === 'pending_finance').length,
                pendingSecretariat: inscriptions.filter(i => i.workflow_status === 'pending_secretariat').length,
                completed: inscriptions.filter(i => i.workflow_status === 'completed').length,
                male: inscriptions.filter(i => i.sexe === 'homme').length,
                female: inscriptions.filter(i => i.sexe === 'femme').length,
                ageGroups: {
                    '5-9': inscriptions.filter(i => i.age >= 5 && i.age < 10).length,
                    '10-14': inscriptions.filter(i => i.age >= 10 && i.age < 15).length,
                    '15-17': inscriptions.filter(i => i.age >= 15 && i.age < 18).length,
                    '18-25': inscriptions.filter(i => i.age >= 18 && i.age <= 25).length,
                    '26-35': inscriptions.filter(i => i.age > 25 && i.age <= 35).length,
                },
            });
            } else {
                // Utiliser les stats de la vue DB
                const totalMembers = statsData.total_inscriptions || 0;
                const totalCollected = statsData.total_collected || 0;
                const totalRequired = totalMembers * 4000;
                const totalRemaining = totalRequired - totalCollected;
                
                setStats({
                    totalMembers,
                    fullyPaid: statsData.fully_paid || 0,
                    partiallyPaid: statsData.partially_paid || 0,
                    unpaid: statsData.unpaid || 0,
                    totalCollected,
                    totalRemaining: statsData.total_remaining || 0,
                    collectionRate: totalMembers > 0 ? Math.round((totalCollected / totalRequired) * 100) : 0,
                    pendingFinance: statsData.pending_finance || 0,
                    pendingSecretariat: statsData.pending_secretariat || 0,
                    completed: statsData.completed || 0,
                    male: statsData.male_count || 0,
                    female: statsData.female_count || 0,
                    ageGroups: {
                        '5-9': statsData.age_5_9 || 0,
                        '10-14': statsData.age_10_14 || 0,
                        '15-17': statsData.age_15_17 || 0,
                        '18-25': statsData.age_18_25 || 0,
                        '26-35': statsData.age_26_35 || 0,
                    },
                });
            }
            
            // Fetch recent registrations using DB function
            const { data: registrations, error: regError } = await supabase.rpc('get_recent_registrations', {
                p_limit: 5
            });
            
            if (regError) {
                // Fallback: fetch directement
                const { data: inscriptions } = await supabase
                    .from('inscriptions')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(5);
                setRecentRegistrations(inscriptions || []);
            } else {
                setRecentRegistrations(registrations || []);
            }
            
            // Fetch recent payments using DB function
            const { data: payments, error: payError } = await supabase.rpc('get_recent_payments', {
                p_limit: 5
            });
            
            if (payError) {
                // Fallback: fetch directement
                const { data: payData } = await supabase
                    .from('paiements')
                    .select('*, inscriptions(nom, prenom)')
                    .order('date_paiement', { ascending: false })
                    .limit(5);
                setRecentPayments(payData || []);
            } else {
                setRecentPayments(payments || []);
            }
            
        } catch (error) {
            console.error('Erreur chargement dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const getStatusBadge = (inscription) => {
        const meta = getFinanceStatusMeta(inscription);
        return <Badge className={getFinanceBadgeClasses(meta.variant)}>{meta.label}</Badge>;
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary">Chargement du tableau de bord...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-y-auto">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-4 sm:px-8 flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-text-main dark:text-white tracking-tight">
                            Tableau de Bord - Président
                        </h1>
                        <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                            {user?.email || 'Chargement...'}
                        </p>
                    </div>
                    <div className="flex gap-2 self-start sm:self-auto">
                        <ThemeToggle />
                        <Button onClick={loadDashboardData} variant="outline" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            <span className="hidden sm:inline">Actualiser</span>
                        </Button>
                        <Button onClick={async () => {
                            await signOut();
                            navigate('/login');
                        }} variant="outline" className="gap-2">
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Déconnexion</span>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Registration Overview Stats */}
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
                                    <UserCheck className="h-5 w-5 text-green-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-text-secondary">Validés</p>
                                    <p className="text-xl sm:text-2xl font-bold text-green-600">
                                        {stats.completed}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex-shrink-0">
                                    <Clock className="h-5 w-5 text-amber-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-text-secondary">En attente</p>
                                    <p className="text-xl sm:text-2xl font-bold text-amber-600">
                                        {stats.pendingFinance + stats.pendingSecretariat}
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

                    {/* Payment Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <Card className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex-shrink-0">
                                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-text-secondary">Soldés</p>
                                    <p className="text-xl sm:text-2xl font-bold text-emerald-600">
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
                                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 flex-shrink-0">
                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-text-secondary">Reste à payer</p>
                                    <p className="text-lg sm:text-xl font-bold text-red-600">
                                        {formatMontant(stats.totalRemaining)}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 flex-shrink-0">
                                    <Wallet className="h-5 w-5 text-green-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-text-secondary">Collecté</p>
                                    <p className="text-sm sm:text-lg font-bold text-green-600 truncate">
                                        {formatMontant(stats.totalCollected)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Demographics & Payment Progress */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {/* Gender Distribution */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Répartition par Genre
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-text-secondary">Hommes</span>
                                            <span className="font-medium text-text-main dark:text-white">
                                                {stats.male} ({stats.totalMembers > 0 ? Math.round((stats.male / stats.totalMembers) * 100) : 0}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                            <div
                                                className="bg-blue-600 h-2.5 rounded-full transition-all"
                                                style={{ width: `${stats.totalMembers > 0 ? (stats.male / stats.totalMembers) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-text-secondary">Femmes</span>
                                            <span className="font-medium text-text-main dark:text-white">
                                                {stats.female} ({stats.totalMembers > 0 ? Math.round((stats.female / stats.totalMembers) * 100) : 0}%)
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                            <div
                                                className="bg-pink-600 h-2.5 rounded-full transition-all"
                                                style={{ width: `${stats.totalMembers > 0 ? (stats.female / stats.totalMembers) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Payment Progress */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Progression des Paiements
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-center">
                                    <div className="relative inline-flex items-center justify-center">
                                        <svg className="w-32 h-32 sm:w-40 sm:h-40">
                                            <circle
                                                className="text-gray-200 dark:text-gray-700"
                                                strokeWidth="8"
                                                stroke="currentColor"
                                                fill="transparent"
                                                r="58"
                                                cx="64"
                                                cy="64"
                                            />
                                            <circle
                                                className="text-primary"
                                                strokeWidth="8"
                                                strokeDasharray={`${stats.collectionRate * 3.64} 364`}
                                                strokeLinecap="round"
                                                stroke="currentColor"
                                                fill="transparent"
                                                r="58"
                                                cx="64"
                                                cy="64"
                                                transform="rotate(-90 64 64)"
                                            />
                                        </svg>
                                        <div className="absolute flex flex-col items-center">
                                            <span className="text-2xl sm:text-3xl font-bold text-text-main dark:text-white">
                                                {stats.collectionRate}%
                                            </span>
                                            <span className="text-xs text-text-secondary">collecté</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center text-sm text-text-secondary">
                                    {formatMontant(stats.totalCollected)} / {formatMontant(stats.totalMembers * 4000)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Age Distribution */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                <PieChart className="h-5 w-5" />
                                Répartition par Tranche d'Âge
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4">
                                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-blue-600">{stats.ageGroups['5-9']}</p>
                                    <p className="text-xs text-text-secondary mt-1">5-9 ans</p>
                                </div>
                                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-green-600">{stats.ageGroups['10-14']}</p>
                                    <p className="text-xs text-text-secondary mt-1">10-14 ans</p>
                                </div>
                                <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-indigo-600">{stats.ageGroups['15-17']}</p>
                                    <p className="text-xs text-text-secondary mt-1">15-17 ans</p>
                                </div>
                                <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-amber-600">{stats.ageGroups['18-25']}</p>
                                    <p className="text-xs text-text-secondary mt-1">18-25 ans</p>
                                </div>
                                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg sm:col-span-1 col-span-3">
                                    <p className="text-2xl font-bold text-purple-600">{stats.ageGroups['26-35']}</p>
                                    <p className="text-xs text-text-secondary mt-1">26-35 ans</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Registrations */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Inscriptions Récentes
                                </CardTitle>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate('/admin/President/inscriptions')}
                                    className="gap-2"
                                >
                                    <Users className="h-4 w-4" />
                                    <span className="hidden sm:inline">Voir toutes</span>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {recentRegistrations.length === 0 ? (
                                <p className="text-text-secondary text-center py-8">Aucune inscription</p>
                            ) : (
                                <div className="space-y-3">
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
                                                    <div className="h-full w-full flex items-center justify-center text-lg text-gray-400">
                                                        {inscription.nom?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-text-main dark:text-white truncate">
                                                    {inscription.nom} {inscription.prenom}
                                                </p>
                                                <p className="text-xs text-text-secondary flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {inscription.telephone || inscription.numero_parent || "N/A"}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {getStatusBadge(inscription)}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1 flex-shrink-0"
                                                onClick={() => navigate(`/admin/President/inscription/${inscription.id}`)}
                                            >
                                                <Eye className="h-4 w-4" />
                                                <span className="hidden sm:inline">Détail</span>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent Payments */}
                    {recentPayments.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Paiements Récents
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {recentPayments.map((payment) => (
                                        <div
                                            key={payment.id}
                                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                                        >
                                            <div>
                                                <p className="font-medium text-text-main dark:text-white">
                                                    {payment.inscriptions?.nom} {payment.inscriptions?.prenom}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    {payment.mode_paiement} • {new Date(payment.date_paiement).toLocaleDateString("fr-FR")}
                                                </p>
                                            </div>
                                            <p className="font-bold text-green-600">
                                                +{formatMontant(payment.montant)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
