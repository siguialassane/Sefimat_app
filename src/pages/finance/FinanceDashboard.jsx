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
    getFinanceBadgeClasses,
    getFinanceCollectedAmount,
    getPendingAmount,
    getVersementStatusMeta,
    isFinanceApproved,
    isFinanceValidationPending,
    REQUIRED_PAYMENT_AMOUNT,
} from "@/lib/finance";

export function FinanceDashboard() {
    const navigate = useNavigate();
    const { userProfile } = useAuth();

    const {
        inscriptions,
        paiements,
        chefsQuartier,
        stats: globalStats,
        loading,
        lastUpdate,
        refresh,
    } = useData();

    const inscriptionById = useMemo(() => {
        const map = new Map();
        for (const inscription of inscriptions) {
            map.set(inscription.id, inscription);
        }
        return map;
    }, [inscriptions]);

    const stats = useMemo(() => {
        const dossiersPresident = inscriptions.filter((i) => i.chef_quartier_id);
        const dossiersGuichet = inscriptions.filter((i) => !i.chef_quartier_id);

        return {
            montantDedans: globalStats.montantDedans,
            montantDehors: globalStats.montantDehors,
            versementsEnAttente: globalStats.versementsEnAttente,
            dossiersEnAttente: inscriptions.filter(isFinanceValidationPending).length,
            dossiersSoldes: globalStats.paiementsComplets,
            dedansPresident: dossiersPresident.reduce((acc, i) => acc + getFinanceCollectedAmount(i), 0),
            dedansGuichet: dossiersGuichet.reduce((acc, i) => acc + getFinanceCollectedAmount(i), 0),
            nbPresident: dossiersPresident.length,
            nbGuichet: dossiersGuichet.length,
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
                return {
                    chef,
                    dossiers: dossiers.length,
                    declare: dossiers.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0),
                    valide: dossiers.reduce((acc, i) => acc + getFinanceCollectedAmount(i), 0),
                    valides: dossiers.filter(isFinanceApproved).length,
                    dehors: dossiers.reduce((acc, i) => acc + getPendingAmount(i), 0),
                    nonDu: dossiers.reduce((acc, i) => acc + getAbandonedAmount(i), 0),
                };
            })
            .sort((a, b) => b.declare - a.declare);
    }, [inscriptions, chefsQuartier]);

    const derniersVersements = useMemo(() => {
        return [...(paiements || [])]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);
    }, [paiements]);

    const handleRefresh = useCallback(() => {
        refresh();
        notify.success("Données financières actualisées.", { title: "Actualisation réussie" });
    }, [refresh]);

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const statCards = [
        {
            title: "En caisse (dedans)",
            value: formatMontant(stats.montantDedans),
            icon: DollarSign,
            iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
            iconColor: "text-emerald-600 dark:text-emerald-400",
        },
        {
            title: "Dehors (en attente)",
            value: formatMontant(stats.montantDehors),
            icon: Clock,
            iconBg: "bg-amber-50 dark:bg-amber-900/20",
            iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
            title: "Dossiers en attente",
            value: stats.dossiersEnAttente.toString(),
            icon: Users,
            iconBg: "bg-blue-50 dark:bg-blue-900/20",
            iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
            title: "Dossiers soldés",
            value: stats.dossiersSoldes.toString(),
            icon: CheckCircle,
            iconBg: "bg-green-50 dark:bg-green-900/20",
            iconColor: "text-green-600 dark:text-green-400",
        },
    ];

    const sourceCards = [
        {
            title: "Via les présidents (dedans)",
            value: formatMontant(stats.dedansPresident),
            icon: UserCheck,
            iconBg: "bg-purple-50 dark:bg-purple-900/20",
            iconColor: "text-purple-600 dark:text-purple-400",
            description: stats.nbPresident + " dossiers",
        },
        {
            title: "Au guichet (dedans)",
            value: formatMontant(stats.dedansGuichet),
            icon: Building2,
            iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
            iconColor: "text-indigo-600 dark:text-indigo-400",
            description: stats.nbGuichet + " dossiers (présentiel)",
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
                                {stat.value}
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
                                    Dossiers saisis par les présidents, en attente de validation finance
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
                                                / {formatMontant(item.montant_requis || REQUIRED_PAYMENT_AMOUNT)}
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
                                    Derniers versements
                                </CardTitle>
                                <CardDescription>
                                    Déclarations et réceptions les plus récentes
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
                        ) : derniersVersements.length === 0 ? (
                            <div className="p-8 text-center text-text-secondary">
                                <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                <p>Aucun versement enregistré</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border-light dark:divide-border-dark">
                                {derniersVersements.map((versement) => {
                                    const inscription = inscriptionById.get(versement.inscription_id);
                                    const meta = getVersementStatusMeta(versement);
                                    const isPresident = !!inscription?.chef_quartier_id;
                                    return (
                                        <div
                                            key={versement.id}
                                            className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={"h-10 w-10 rounded-full flex items-center justify-center " + (isPresident
                                                    ? "bg-purple-100 dark:bg-purple-900/30"
                                                    : "bg-indigo-100 dark:bg-indigo-900/30"
                                                )}>
                                                    {isPresident ? (
                                                        <UserCheck className="h-5 w-5 text-purple-600" />
                                                    ) : (
                                                        <Building2 className="h-5 w-5 text-indigo-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-text-main dark:text-white">
                                                        {inscription ? inscription.nom + " " + inscription.prenom : "Dossier inconnu"}
                                                    </p>
                                                    <p className="text-xs text-text-secondary">
                                                        {new Date(versement.created_at).toLocaleDateString("fr-FR")} • {isPresident ? "Président de section" : "Guichet"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-emerald-600">
                                                    +{formatMontant(versement.montant)}
                                                </p>
                                                <div className="flex items-center gap-1 justify-end">
                                                    <Badge className={getFinanceBadgeClasses(meta.variant) + " text-xs"}>
                                                        {meta.label}
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
                                Dossiers, montants déclarés, reçus et dehors par président
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
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Déclaré</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Dossiers validés</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Dehors</th>
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
                                            <td className="p-4 text-center font-bold text-emerald-600">{formatMontant(row.declare)}<span className="block text-xs font-normal text-text-secondary mt-1">dont {formatMontant(row.valide)} reçus</span></td>
                                            <td className="p-4 text-center">
                                                <Badge variant="success">{row.valides}</Badge>
                                            </td>
                                            <td className="p-4 text-center">
                                                {row.dehors > 0 ? (
                                                    <span className="font-bold text-amber-600">{formatMontant(row.dehors)}</span>
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
