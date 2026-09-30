import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DollarSign,
    TrendingUp,
    Clock,
    CheckCircle,
    Users,
    Download,
    RefreshCw,
    UserCheck,
    Building2,
    Eye,
} from "lucide-react";
import { useAuth, useData } from "@/contexts";
import { notify } from "@/components/ui/toast";
import {
    getAbandonedAmount,
    getFinanceCollectedAmount,
    getFinanceStatusMeta,
    isFinanceApproved,
    isFinanceValidationPending,
    shouldCountInFinanceTotals,
} from "@/lib/finance";

export function FinanceDashboard() {
    const navigate = useNavigate();
    const { userProfile } = useAuth();

    const {
        inscriptions,
        chefsQuartier,
        stats: globalStats,
        loading,
        lastUpdate,
        refresh,
    } = useData();

    const stats = useMemo(() => {
        const financeCountedInscriptions = inscriptions.filter(shouldCountInFinanceTotals);
        const paiementsValides = inscriptions.filter(
            (i) => isFinanceApproved(i) && (i.montant_total_paye || 0) > 0
        ).length;
        const paiementsNonValides = inscriptions.filter(isFinanceValidationPending).length;
        const paiementsPresident = financeCountedInscriptions.filter(
            (i) => i.type_inscription === "en_ligne" && (i.montant_total_paye || 0) > 0
        ).length;
        const paiementsSecretariat = financeCountedInscriptions.filter(
            (i) => i.type_inscription === "presentielle" && (i.montant_total_paye || 0) > 0
        ).length;

        return {
            totalCollecte: globalStats.totalCollecte,
            paiementsEnAttente: globalStats.paiementsEnAttente,
            paiementsPartiels: globalStats.paiementsPartiels,
            paiementsComplets: globalStats.paiementsComplets,
            nombreInscrits: inscriptions.length,
            paiementsValides,
            paiementsNonValides,
            paiementsPresident,
            paiementsSecretariat,
        };
    }, [inscriptions, globalStats]);

    const pendingValidations = useMemo(() => {
        return inscriptions
            .filter((i) => isFinanceValidationPending(i))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);
    }, [inscriptions]);

    const presidentStats = useMemo(() => {
        return (chefsQuartier || [])
            .map((chef) => {
                const dossiers = inscriptions.filter((i) => i.chef_quartier_id === chef.id);
                const pending = dossiers.filter(isFinanceValidationPending);
                return {
                    chef,
                    dossiers: dossiers.length,
                    encaisse: dossiers.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0),
                    valides: dossiers.filter(isFinanceApproved).length,
                    pendingCount: pending.length,
                    pendingAmount: pending.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0),
                    nonDu: dossiers.reduce((acc, i) => acc + getAbandonedAmount(i), 0),
                };
            })
            .sort((a, b) => b.encaisse - a.encaisse);
    }, [inscriptions, chefsQuartier]);

    const recentPayments = useMemo(() => {
        return inscriptions
            .filter((i) => (i.montant_total_paye || 0) > 0)
            .filter((i) => shouldCountInFinanceTotals(i) || isFinanceValidationPending(i))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);
    }, [inscriptions]);

    const handleRefresh = useCallback(() => {
        refresh();
        notify.success("Données financières actualisées.", { title: "Actualisation réussie" });
    }, [refresh]);

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
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

    const sourceCards = [
        {
            title: "Par Président Section",
            value: stats.paiementsPresident.toString(),
            icon: UserCheck,
            iconBg: "bg-purple-50 dark:bg-purple-900/20",
            iconColor: "text-purple-600 dark:text-purple-400",
            description: "Montants déjà validés par la finance",
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
                    <span className="hidden md:block text-sm text-text-secondary dark:text-gray-400 bg-white dark:bg-white/5 px-3 py-2 rounded-lg border border-border-light dark:border-border-dark">
                        {lastUpdate
                            ? `Mise à jour : ${lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                            : "Chargement..."}
                    </span>
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                    <Button
                        className="gap-2"
                        onClick={() => notify.info("Export financier bientôt disponible.", { title: "Fonction en préparation" })}
                    >
                        <Download className="h-4 w-4" />
                        Exporter
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading && !inscriptions.length
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border-light dark:border-border-dark">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-indigo-500" />
                                    Validations en attente
                                </CardTitle>
                                <CardDescription>
                                    Montants saisis par les présidents avant validation finance
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => navigate("/finance/validation")}>
                                Voir tout
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading && !inscriptions.length ? (
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

                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border-light dark:border-border-dark">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                    Derniers paiements
                                </CardTitle>
                                <CardDescription>
                                    Validés et en attente, selon le workflow finance
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => navigate("/finance/synthese")}>
                                Voir tout
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading && !inscriptions.length ? (
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
                                {recentPayments.slice(0, 5).map((payment) => {
                                    const statusMeta = getFinanceStatusMeta(payment);
                                    const amountShown = shouldCountInFinanceTotals(payment)
                                        ? getFinanceCollectedAmount(payment)
                                        : payment.montant_total_paye || 0;

                                    return (
                                        <div
                                            key={payment.id}
                                            className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                                    payment.type_inscription === "en_ligne"
                                                        ? "bg-purple-100 dark:bg-purple-900/30"
                                                        : "bg-indigo-100 dark:bg-indigo-900/30"
                                                }`}>
                                                    {payment.type_inscription === "en_ligne" ? (
                                                        <UserCheck className="h-5 w-5 text-purple-600" />
                                                    ) : (
                                                        <Building2 className="h-5 w-5 text-indigo-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-text-main dark:text-white">
                                                        {payment.nom} {payment.prenom}
                                                    </p>
                                                    <p className="text-xs text-text-secondary">
                                                        {new Date(payment.created_at).toLocaleDateString("fr-FR")} • {
                                                            payment.type_inscription === "en_ligne"
                                                                ? "Président Section"
                                                                : "Secrétariat"
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-emerald-600">
                                                    +{formatMontant(amountShown)}
                                                </p>
                                                <div className="flex items-center gap-1 justify-end">
                                                    <Badge variant={statusMeta.variant} className="text-xs">
                                                        {statusMeta.label}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <UserCheck className="h-5 w-5 text-purple-500" />
                                Suivi par président de section
                            </CardTitle>
                            <CardDescription>
                                Dossiers, montants encaissés et validations par président
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate("/finance/liste")}>
                            Voir tout
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading && !inscriptions.length ? (
                        <div className="p-8 text-center">
                            <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    ) : presidentStats.length === 0 ? (
                        <div className="p-8 text-center text-text-secondary">
                            <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                            <p>Aucun président enregistré</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                    <tr>
                                        <th className="p-4 font-semibold text-text-main dark:text-white">Président</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Dossiers</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Encaissé</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Validés</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">En attente</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Non dû</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-right">Détail</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                    {presidentStats.map((row) => (
                                        <tr key={row.chef.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                            <td className="p-4">
                                                <p className="font-medium text-text-main dark:text-white">{row.chef.nom_complet}</p>
                                                <p className="text-xs text-text-secondary">{row.chef.zone || "Section non précisée"}</p>
                                            </td>
                                            <td className="p-4 text-center font-medium">{row.dossiers}</td>
                                            <td className="p-4 text-center font-bold text-emerald-600">{formatMontant(row.encaisse)}</td>
                                            <td className="p-4 text-center">
                                                <Badge variant="success">{row.valides}</Badge>
                                            </td>
                                            <td className="p-4 text-center">
                                                {row.pendingCount > 0 ? (
                                                    <span>
                                                        <Badge variant="warning">{row.pendingCount}</Badge>
                                                        <span className="block text-xs text-text-secondary mt-1">{formatMontant(row.pendingAmount)}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-text-secondary">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center text-text-secondary">{formatMontant(row.nonDu)}</td>
                                            <td className="p-4 text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => navigate("/finance/liste", { state: { filterChef: row.chef.id } })}
                                                >
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    Voir
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
