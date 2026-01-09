import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DollarSign,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    Users,
    Download,
    RefreshCw,
    UserCheck,
    Building2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts";

export function FinanceDashboard() {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCollecte: 0,
        paiementsEnAttente: 0,
        paiementsPartiels: 0,
        paiementsComplets: 0,
        nombreInscrits: 0,
        paiementsValides: 0,
        paiementsNonValides: 0,
        paiementsPresident: 0,
        paiementsSecretariat: 0,
    });
    const [recentPayments, setRecentPayments] = useState([]);
    const [pendingValidations, setPendingValidations] = useState([]);
    
    // Protection contre les appels simultanés (pas hasLoaded qui ne se reset jamais!)
    const isLoadingRef = useRef(false);

    const loadDashboardData = useCallback(async (isMounted = true) => {
        // Éviter les appels simultanés
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;

        // Timeout de sécurité: reset après 10 secondes
        const timeoutId = setTimeout(() => {
            isLoadingRef.current = false;
        }, 10000);

        if (isMounted) setLoading(true);
        try {
            console.log('FinanceDashboard: Chargement des données...');

            // Charger les statistiques des inscriptions
            const { data: inscriptions, error: inscError } = await supabase
                .from("inscriptions")
                .select("montant_total_paye, montant_requis, statut_paiement, type_inscription");

            if (inscError) {
                console.error('FinanceDashboard: Erreur inscriptions:', inscError);
                throw inscError;
            }

            console.log('FinanceDashboard: Inscriptions reçues:', inscriptions?.length || 0);

            const totalCollecte = (inscriptions || []).reduce(
                (acc, i) => acc + (i.montant_total_paye || 0),
                0
            );
            const paiementsEnAttente = (inscriptions || []).filter(
                (i) => i.statut_paiement === "partiel" && i.montant_total_paye < (i.montant_requis || 4000)
            ).length;
            const paiementsPartiels = (inscriptions || []).filter(
                (i) => i.statut_paiement === "partiel"
            ).length;
            const paiementsComplets = (inscriptions || []).filter(
                (i) => i.statut_paiement === "soldé" || i.statut_paiement === "valide_financier"
            ).length;

            // Charger les paiements avec statut et source
            const { data: allPaiements, error: paiementsStatError } = await supabase
                .from("paiements")
                .select(`
                    id,
                    montant,
                    statut,
                    inscription:inscriptions(type_inscription)
                `);

            let paiementsValides = 0;
            let paiementsNonValides = 0;
            let paiementsPresident = 0;
            let paiementsSecretariat = 0;

            if (!paiementsStatError && allPaiements) {
                paiementsValides = allPaiements.filter(p => p.statut === "validé").length;
                paiementsNonValides = allPaiements.filter(p => p.statut === "attente" || p.statut === "en_attente").length;
                paiementsPresident = allPaiements.filter(p => p.inscription?.type_inscription === "en_ligne").length;
                paiementsSecretariat = allPaiements.filter(p => p.inscription?.type_inscription === "presentielle").length;
            }

            if (isMounted) {
                setStats({
                    totalCollecte,
                    paiementsEnAttente,
                    paiementsPartiels,
                    paiementsComplets,
                    nombreInscrits: (inscriptions || []).length,
                    paiementsValides,
                    paiementsNonValides,
                    paiementsPresident,
                    paiementsSecretariat,
                });
            }

            // Charger les inscriptions en attente de validation financière
            const { data: pending, error: pendingError } = await supabase
                .from("inscriptions")
                .select(`
                    id,
                    reference_id,
                    nom,
                    prenom,
                    montant_total_paye,
                    montant_requis,
                    statut_paiement,
                    photo_url,
                    created_at,
                    chef_quartier:chefs_quartier(nom_complet, zone)
                `)
                .eq("statut_paiement", "partiel")
                .lt("montant_total_paye", 4000)
                .order("created_at", { ascending: false })
                .limit(5);

            if (pendingError) {
                console.error('FinanceDashboard: Erreur pending:', pendingError);
            } else {
                console.log('FinanceDashboard: Validations en attente:', pending?.length || 0);
                if (isMounted) setPendingValidations(pending || []);
            }

            // Charger les derniers paiements avec source
            const { data: payments, error: paymentsError } = await supabase
                .from("paiements")
                .select(`
                    id,
                    montant,
                    date_paiement,
                    mode_paiement,
                    statut,
                    inscription:inscriptions(nom, prenom, reference_id, type_inscription)
                `)
                .order("date_paiement", { ascending: false })
                .limit(10);

            if (paymentsError) {
                console.error('FinanceDashboard: Erreur paiements:', paymentsError);
            } else {
                console.log('FinanceDashboard: Paiements récents:', payments?.length || 0);
                if (isMounted) setRecentPayments(payments || []);
            }
        } catch (error) {
            console.error("FinanceDashboard: Exception chargement:", error);
        } finally {
            clearTimeout(timeoutId);
            isLoadingRef.current = false;
            if (isMounted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        loadDashboardData(isMounted);

        // Subscription Realtime pour inscriptions ET paiements
        const channel = supabase
            .channel('finance-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inscriptions' }, () => {
                console.log('FinanceDashboard: Changement inscriptions détecté');
                if (isMounted) loadDashboardData(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'paiements' }, () => {
                console.log('FinanceDashboard: Changement paiements détecté');
                if (isMounted) loadDashboardData(true);
            })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [loadDashboardData]);

    // Fonction de rafraîchissement pour le bouton
    const handleRefresh = () => loadDashboardData(true);

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant) + " FCFA";
    };

    const statCards = [
        {
            title: "Total Collecté",
            value: formatMontant(stats.totalCollecte),
            icon: DollarSign,
            iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
            iconColor: "text-emerald-600 dark:text-emerald-400",
        },
        {
            title: "Paiements Validés",
            value: stats.paiementsValides.toString(),
            icon: CheckCircle,
            iconBg: "bg-green-50 dark:bg-green-900/20",
            iconColor: "text-green-600 dark:text-green-400",
        },
        {
            title: "En attente validation",
            value: stats.paiementsNonValides.toString(),
            icon: Clock,
            iconBg: "bg-amber-50 dark:bg-amber-900/20",
            iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
            title: "Paiements Complets",
            value: stats.paiementsComplets.toString(),
            icon: Users,
            iconBg: "bg-blue-50 dark:bg-blue-900/20",
            iconColor: "text-blue-600 dark:text-blue-400",
        },
    ];

    // Cartes secondaires pour la source des paiements
    const sourceCards = [
        {
            title: "Par Président Section",
            value: stats.paiementsPresident.toString(),
            icon: UserCheck,
            iconBg: "bg-purple-50 dark:bg-purple-900/20",
            iconColor: "text-purple-600 dark:text-purple-400",
            description: "Inscriptions en ligne",
        },
        {
            title: "Par Secrétariat",
            value: stats.paiementsSecretariat.toString(),
            icon: Building2,
            iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
            iconColor: "text-indigo-600 dark:text-indigo-400",
            description: "Inscriptions présentielles",
        },
    ];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-main dark:text-white">
                        Tableau de bord Financier
                    </h1>
                    <p className="text-text-secondary dark:text-gray-400 text-sm md:text-base">
                        Bienvenue, {userProfile?.nom_complet || "Admin Financier"}. Voici le récapitulatif financier.
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
                    <Button className="gap-2">
                        <Download className="h-4 w-4" />
                        Exporter
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading
                    ? Array.from({ length: 4 }).map((_, index) => (
                        <Card key={index} className="p-5 flex flex-col gap-4 animate-pulse">
                            <div className="flex justify-between items-start">
                                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                            </div>
                            <div>
                                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                            </div>
                        </Card>
                    ))
                    : statCards.map((stat, index) => (
                        <Card
                            key={index}
                            className="p-5 flex flex-col justify-between gap-4 hover:border-emerald-500/50 transition-colors group"
                        >
                            <div className="flex justify-between items-start">
                                <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                                </div>
                            </div>
                            <div>
                                <p className="text-text-secondary dark:text-gray-400 text-sm font-medium">
                                    {stat.title}
                                </p>
                                <p className="text-2xl font-bold text-text-main dark:text-white mt-1">
                                    {stat.value}
                                </p>
                            </div>
                        </Card>
                    ))}
            </div>

            {/* Source des paiements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sourceCards.map((stat, index) => (
                    <Card
                        key={index}
                        className="p-5 flex items-center gap-4 hover:border-emerald-500/50 transition-colors"
                    >
                        <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                            <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                        </div>
                        <div className="flex-1">
                            <p className="text-text-secondary dark:text-gray-400 text-sm font-medium">
                                {stat.title}
                            </p>
                            <p className="text-2xl font-bold text-text-main dark:text-white">
                                {stat.value} <span className="text-sm font-normal text-text-secondary">paiements</span>
                            </p>
                            <p className="text-xs text-text-secondary mt-1">{stat.description}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Validations en attente */}
                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border-light dark:border-border-dark">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-indigo-500" />
                                    Validations en attente
                                </CardTitle>
                                <CardDescription>
                                    Paiements inférieurs à 4.000 FCFA
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => navigate("/finance/validation")}>
                                Voir tout
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            </div>
                        ) : pendingValidations.length === 0 ? (
                            <div className="p-8 text-center text-text-secondary">
                                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                                <p>Aucune validation en attente</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border-light dark:divide-border-dark">
                                {pendingValidations.map((item) => (
                                    <div
                                        key={item.id}
                                        className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center overflow-hidden">
                                                {item.photo_url ? (
                                                    <img
                                                        src={item.photo_url}
                                                        alt={item.nom}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-emerald-600 font-bold">
                                                        {item.nom?.charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-text-main dark:text-white">
                                                    {item.nom} {item.prenom}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    {item.reference_id || "N/A"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-emerald-600">
                                                {formatMontant(item.montant_total_paye || 0)}
                                            </p>
                                            <p className="text-xs text-text-secondary">
                                                / {formatMontant(item.montant_requis || 4000)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Derniers paiements */}
                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border-light dark:border-border-dark">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                    Derniers paiements
                                </CardTitle>
                                <CardDescription>
                                    Transactions récentes
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => navigate("/finance/synthese")}>
                                Voir tout
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            </div>
                        ) : recentPayments.length === 0 ? (
                            <div className="p-8 text-center text-text-secondary">
                                <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                <p>Aucun paiement enregistré</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border-light dark:divide-border-dark">
                                {recentPayments.slice(0, 5).map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                                payment.inscription?.type_inscription === "en_ligne"
                                                    ? "bg-purple-100 dark:bg-purple-900/30"
                                                    : "bg-indigo-100 dark:bg-indigo-900/30"
                                            }`}>
                                                {payment.inscription?.type_inscription === "en_ligne" ? (
                                                    <UserCheck className="h-5 w-5 text-purple-600" />
                                                ) : (
                                                    <Building2 className="h-5 w-5 text-indigo-600" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-text-main dark:text-white">
                                                    {payment.inscription?.nom} {payment.inscription?.prenom}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    {new Date(payment.date_paiement).toLocaleDateString("fr-FR")} • {
                                                        payment.inscription?.type_inscription === "en_ligne" 
                                                            ? "Président Section" 
                                                            : "Secrétariat"
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-emerald-600">
                                                +{formatMontant(payment.montant)}
                                            </p>
                                            <div className="flex items-center gap-1 justify-end">
                                                <Badge 
                                                    variant={payment.statut === "validé" ? "success" : "warning"} 
                                                    className="text-xs"
                                                >
                                                    {payment.statut === "validé" ? "Validé" : "En attente"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
