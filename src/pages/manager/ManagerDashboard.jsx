import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    DollarSign,
    Wallet,
    CheckCircle,
    Clock,
    UserCheck,
    Building2,
    Eye,
    RefreshCw,
    Hourglass,
} from "lucide-react";
import { useAuth, useData } from "@/contexts";
import { notify } from "@/components/ui/toast";
import {
    getAbandonedAmount,
    getFinanceCollectedAmount,
    getRemainingDue,
    isFinanceApproved,
    isFinanceValidationPending,
    isFullyPaid,
    isPresidentRegistration,
} from "@/lib/finance";

export function ManagerDashboard() {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const { inscriptions, chefsQuartier, loading, lastUpdate, refresh } = useData();

    const stats = useMemo(() => {
        const totalInscrits = inscriptions.length;
        const totalCollecte = inscriptions.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0);
        const totalValide = inscriptions.reduce((acc, i) => acc + getFinanceCollectedAmount(i), 0);
        const resteDu = inscriptions.reduce((acc, i) => acc + getRemainingDue(i), 0);
        const totalNonDu = inscriptions.reduce((acc, i) => acc + getAbandonedAmount(i), 0);
        const soldes = inscriptions.filter(isFullyPaid).length;
        const pendingFinance = inscriptions.filter(
            (i) => i.created_by === "president" && i.workflow_status === "pending_finance"
        ).length;
        const pendingSecretariat = inscriptions.filter(
            (i) => i.created_by === "president" && i.workflow_status === "pending_secretariat"
        ).length;
        const completed = inscriptions.filter(
            (i) => i.created_by === "president" && i.workflow_status === "completed"
        ).length;
        const rejected = inscriptions.filter((i) => i.workflow_status === "rejected").length;
        const valides = inscriptions.filter((i) => i.statut === "valide").length;
        const viaPresident = inscriptions.filter(isPresidentRegistration);
        const viaGuichet = inscriptions.filter((i) => !isPresidentRegistration(i));

        return {
            totalInscrits,
            totalCollecte,
            totalValide,
            resteDu,
            totalNonDu,
            soldes,
            pendingFinance,
            pendingSecretariat,
            completed,
            rejected,
            valides,
            presidentsActifs: new Set(viaPresident.map((i) => i.chef_quartier_id).filter(Boolean)).size,
            viaPresident: {
                count: viaPresident.length,
                montant: viaPresident.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0),
                valide: viaPresident.reduce((acc, i) => acc + getFinanceCollectedAmount(i), 0),
            },
            viaGuichet: {
                count: viaGuichet.length,
                montant: viaGuichet.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0),
            },
        };
    }, [inscriptions]);

    const presidentRows = useMemo(() => {
        return (chefsQuartier || [])
            .map((chef) => {
                const dossiers = inscriptions.filter((i) => i.chef_quartier_id === chef.id);
                return {
                    chef,
                    dossiers: dossiers.length,
                    declare: dossiers.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0),
                    valide: dossiers.reduce((acc, i) => acc + getFinanceCollectedAmount(i), 0),
                    valides: dossiers.filter(isFinanceApproved).length,
                    enAttente: dossiers.filter(isFinanceValidationPending).length,
                };
            })
            .sort((a, b) => b.declare - a.declare);
    }, [inscriptions, chefsQuartier]);

    const handleRefresh = useCallback(() => {
        refresh();
        notify.success("Données actualisées.", { title: "Actualisation réussie" });
    }, [refresh]);

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const kpis = [
        { title: "Total inscrits", value: stats.totalInscrits.toString(), icon: Users, iconBg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600" },
        { title: "Total déclaré", value: formatMontant(stats.totalCollecte), icon: DollarSign, iconBg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600" },
        { title: "Total validé", value: formatMontant(stats.totalValide), icon: DollarSign, iconBg: "bg-emerald-50 dark:bg-emerald-900/20", iconColor: "text-emerald-600" },
        { title: "Reste dû", value: formatMontant(stats.resteDu), icon: Wallet, iconBg: "bg-red-50 dark:bg-red-900/20", iconColor: "text-red-600" },
        { title: "Dossiers soldés", value: stats.soldes.toString(), icon: CheckCircle, iconBg: "bg-green-50 dark:bg-green-900/20", iconColor: "text-green-600" },
        { title: "En attente finance", value: stats.pendingFinance.toString(), icon: Clock, iconBg: "bg-amber-50 dark:bg-amber-900/20", iconColor: "text-amber-600" },
        { title: "En attente secrétariat", value: stats.pendingSecretariat.toString(), icon: Hourglass, iconBg: "bg-orange-50 dark:bg-orange-900/20", iconColor: "text-orange-600" },
        { title: "Dossiers validés", value: stats.valides.toString(), icon: UserCheck, iconBg: "bg-violet-50 dark:bg-violet-900/20", iconColor: "text-violet-600" },
        { title: "Présidents actifs", value: `${stats.presidentsActifs} / ${(chefsQuartier || []).length}`, icon: Users, iconBg: "bg-indigo-50 dark:bg-indigo-900/20", iconColor: "text-indigo-600" },
    ];

    const funnel = [
        { label: "En attente finance", value: stats.pendingFinance, color: "bg-amber-500" },
        { label: "En attente secrétariat", value: stats.pendingSecretariat, color: "bg-orange-500" },
        { label: "Terminés (présidents)", value: stats.completed, color: "bg-emerald-500" },
        { label: "Rejetés", value: stats.rejected, color: "bg-red-500" },
    ];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-main dark:text-white">
                        Vue globale
                    </h1>
                    <p className="text-text-secondary dark:text-gray-400 text-sm md:text-base">
                        Bienvenue, {userProfile?.nom_complet || "Manager"}. Pilotage général de l'événement.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="hidden md:block text-sm text-text-secondary dark:text-gray-400 bg-white dark:bg-white/5 px-3 py-2 rounded-lg border border-border-light dark:border-border-dark">
                        {lastUpdate
                            ? `Mise à jour : ${lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                            : "Chargement..."}
                    </span>
                    <Button variant="outline" onClick={handleRefresh} disabled={loading} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, index) => (
                    <Card key={index} className="p-5 flex flex-col justify-between gap-4">
                        <div className="flex justify-between items-start">
                            <div className={`p-2 rounded-lg ${kpi.iconBg}`}>
                                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                            </div>
                        </div>
                        <div>
                            <p className="text-text-secondary dark:text-gray-400 text-sm font-medium">{kpi.title}</p>
                            <p className="text-2xl font-bold text-text-main dark:text-white mt-1">{kpi.value}</p>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                        <UserCheck className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                        <p className="text-text-secondary dark:text-gray-400 text-sm font-medium">Via présidents</p>
                        <p className="text-2xl font-bold text-text-main dark:text-white">
                            {stats.viaPresident.count} <span className="text-sm font-normal text-text-secondary">inscrits</span>
                        </p>
                        <p className="text-xs text-text-secondary mt-1">{formatMontant(stats.viaPresident.montant)} déclarés • {formatMontant(stats.viaPresident.valide)} validés</p>
                    </div>
                </Card>
                <Card className="p-5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                        <Building2 className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                        <p className="text-text-secondary dark:text-gray-400 text-sm font-medium">Via guichet (Secrétariat)</p>
                        <p className="text-2xl font-bold text-text-main dark:text-white">
                            {stats.viaGuichet.count} <span className="text-sm font-normal text-text-secondary">inscrits</span>
                        </p>
                        <p className="text-xs text-text-secondary mt-1">{formatMontant(stats.viaGuichet.montant)} encaissés</p>
                    </div>
                </Card>
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="border-b border-border-light dark:border-border-dark">
                    <CardTitle>Circuit des dossiers président</CardTitle>
                    <CardDescription>Finance → Secrétariat → Terminé</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {funnel.map((step, index) => (
                            <div key={index} className="flex flex-col gap-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-text-secondary">{step.label}</span>
                                    <span className="font-bold text-text-main dark:text-white">{step.value}</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${step.color}`}
                                        style={{
                                            width: `${stats.totalInscrits > 0 ? Math.round((step.value / stats.totalInscrits) * 100) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    {stats.totalNonDu > 0 && (
                        <p className="text-sm text-text-secondary mt-4">
                            Reliquats non dus (abandonnés à la validation) :{" "}
                            <span className="font-bold">{formatMontant(stats.totalNonDu)}</span>
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card className="overflow-hidden">
                <CardHeader className="border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Présidents de section</CardTitle>
                            <CardDescription>Activité par président</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate("/manager/presidents")}>
                            Gérer
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {presidentRows.length === 0 ? (
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
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Validés</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">En attente</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                    {presidentRows.slice(0, 8).map((row) => (
                                        <tr key={row.chef.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                            <td className="p-4">
                                                <p className="font-medium text-text-main dark:text-white">{row.chef.nom_complet}</p>
                                                <p className="text-xs text-text-secondary">{row.chef.zone || "Section non précisée"}</p>
                                            </td>
                                            <td className="p-4 text-center font-medium">{row.dossiers}</td>
                                            <td className="p-4 text-center font-bold text-emerald-600">{formatMontant(row.declare)}<span className="block text-xs font-normal text-text-secondary mt-1">dont {formatMontant(row.valide)} validés</span></td>
                                            <td className="p-4 text-center">
                                                <Badge variant="success">{row.valides}</Badge>
                                            </td>
                                            <td className="p-4 text-center">
                                                {row.enAttente > 0 ? (
                                                    <Badge variant="warning">{row.enAttente}</Badge>
                                                ) : (
                                                    <span className="text-text-secondary">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {presidentRows.length > 8 && (
                                <div className="p-4 text-center">
                                    <Button variant="outline" size="sm" onClick={() => navigate("/manager/presidents")}>
                                        <Eye className="h-4 w-4 mr-1" />
                                        Voir les {presidentRows.length} présidents
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
