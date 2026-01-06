import { useState, useEffect } from "react";
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts";

export function FinanceDashboard() {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCollecte: 0,
        paiementsEnAttente: 0,
        paiementsPartiels: 0,
        paiementsComplets: 0,
        nombreInscrits: 0,
    });
    const [recentPayments, setRecentPayments] = useState([]);
    const [pendingValidations, setPendingValidations] = useState([]);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Charger les statistiques des inscriptions
            const { data: inscriptions, error: inscError } = await supabase
                .from("inscriptions")
                .select("montant_total_paye, montant_requis, statut_paiement");

            if (inscError) throw inscError;

            const totalCollecte = inscriptions.reduce(
                (acc, i) => acc + (i.montant_total_paye || 0),
                0
            );
            const paiementsEnAttente = inscriptions.filter(
                (i) => i.statut_paiement === "partiel" && i.montant_total_paye < (i.montant_requis || 4000)
            ).length;
            const paiementsPartiels = inscriptions.filter(
                (i) => i.statut_paiement === "partiel"
            ).length;
            const paiementsComplets = inscriptions.filter(
                (i) => i.statut_paiement === "complet" || i.statut_paiement === "valide_financier"
            ).length;

            setStats({
                totalCollecte,
                paiementsEnAttente,
                paiementsPartiels,
                paiementsComplets,
                nombreInscrits: inscriptions.length,
            });

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

            if (!pendingError) {
                setPendingValidations(pending || []);
            }

            // Charger les derniers paiements
            const { data: payments, error: paymentsError } = await supabase
                .from("paiements")
                .select(`
                    id,
                    montant,
                    date_paiement,
                    mode_paiement,
                    inscription:inscriptions(nom, prenom, reference_id)
                `)
                .order("date_paiement", { ascending: false })
                .limit(10);

            if (!paymentsError) {
                setRecentPayments(payments || []);
            }
        } catch (error) {
            console.error("Erreur chargement dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

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
            trend: "+12%",
            trendUp: true,
        },
        {
            title: "En attente de validation",
            value: stats.paiementsEnAttente.toString(),
            icon: Clock,
            iconBg: "bg-amber-50 dark:bg-amber-900/20",
            iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
            title: "Paiements Partiels",
            value: stats.paiementsPartiels.toString(),
            icon: AlertCircle,
            iconBg: "bg-orange-50 dark:bg-orange-900/20",
            iconColor: "text-orange-600 dark:text-orange-400",
        },
        {
            title: "Paiements Complets",
            value: stats.paiementsComplets.toString(),
            icon: CheckCircle,
            iconBg: "bg-blue-50 dark:bg-blue-900/20",
            iconColor: "text-blue-600 dark:text-blue-400",
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
                        onClick={loadDashboardData}
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
                            className="p-5 flex flex-col justify-between gap-4 hover:border-amber-500/50 transition-colors group"
                        >
                            <div className="flex justify-between items-start">
                                <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                                </div>
                                {stat.trend && (
                                    <span
                                        className={`text-xs font-medium ${stat.trendUp ? "text-emerald-600" : "text-red-600"
                                            }`}
                                    >
                                        {stat.trend}
                                    </span>
                                )}
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

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Validations en attente */}
                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border-light dark:border-border-dark">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-amber-500" />
                                    Validations en attente
                                </CardTitle>
                                <CardDescription>
                                    Paiements inférieurs à 4.000 FCFA
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => window.location.href = "/finance/validations"}>
                                Voir tout
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
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
                                            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center overflow-hidden">
                                                {item.photo_url ? (
                                                    <img
                                                        src={item.photo_url}
                                                        alt={item.nom}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-amber-600 font-bold">
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
                                            <p className="font-bold text-amber-600">
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
                            <Button variant="outline" size="sm" onClick={() => window.location.href = "/finance/recapitulatif"}>
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
                                            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                                <DollarSign className="h-5 w-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-text-main dark:text-white">
                                                    {payment.inscription?.nom} {payment.inscription?.prenom}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    {new Date(payment.date_paiement).toLocaleDateString("fr-FR")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-emerald-600">
                                                +{formatMontant(payment.montant)}
                                            </p>
                                            <Badge variant="secondary" className="text-xs">
                                                {payment.mode_paiement === "especes" ? "Espèces" : payment.mode_paiement}
                                            </Badge>
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
