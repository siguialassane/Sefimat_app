import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, BarChart3, Users, CheckCircle2, Clock3 } from "lucide-react";
import { useData } from "@/contexts";
import { notify } from "@/components/ui/toast";
import {
    getFinanceBadgeClasses,
    getFinanceCollectedAmount,
    getFinanceStatusMeta,
    isFinanceValidationPending,
    isPresidentRegistration,
} from "@/lib/finance";

const formatMontant = (montant) =>
    `${new Intl.NumberFormat("fr-FR").format(montant || 0)} FCFA`;

export function FinanceStats() {
    const { inscriptions, loading, refresh } = useData();

    const presidentInscriptions = useMemo(() => {
        return inscriptions
            .filter((inscription) => isPresidentRegistration(inscription) && inscription.chef_quartier_id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [inscriptions]);

    const presidentSummary = useMemo(() => {
        const summaryMap = new Map();

        presidentInscriptions.forEach((inscription) => {
            const chefId = inscription.chef_quartier_id;
            const current = summaryMap.get(chefId) || {
                id: chefId,
                president: inscription.chef_quartier?.nom_complet || "Président inconnu",
                zone: inscription.chef_quartier?.zone || "Section non précisée",
                participants: 0,
                declaredAmount: 0,
                validatedAmount: 0,
                pendingAmount: 0,
                validatedCount: 0,
                pendingCount: 0,
            };

            const declaredAmount = inscription.montant_total_paye || 0;
            const validatedAmount = getFinanceCollectedAmount(inscription);
            const pendingAmount = isFinanceValidationPending(inscription) ? declaredAmount : 0;

            current.participants += 1;
            current.declaredAmount += declaredAmount;
            current.validatedAmount += validatedAmount;
            current.pendingAmount += pendingAmount;

            if (validatedAmount > 0) current.validatedCount += 1;
            if (pendingAmount > 0) current.pendingCount += 1;

            summaryMap.set(chefId, current);
        });

        return Array.from(summaryMap.values()).sort((a, b) => b.validatedAmount - a.validatedAmount);
    }, [presidentInscriptions]);

    const overview = useMemo(() => {
        return presidentSummary.reduce(
            (acc, current) => {
                acc.activePresidents += 1;
                acc.totalParticipants += current.participants;
                acc.validatedAmount += current.validatedAmount;
                acc.pendingAmount += current.pendingAmount;
                if (current.validatedAmount > 0) acc.presidentsWithValidated += 1;
                if (current.pendingAmount > 0) acc.presidentsWithPending += 1;
                return acc;
            },
            {
                activePresidents: 0,
                totalParticipants: 0,
                validatedAmount: 0,
                pendingAmount: 0,
                presidentsWithValidated: 0,
                presidentsWithPending: 0,
            }
        );
    }, [presidentSummary]);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-emerald-500" />
                        Stats Présidents
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Suivi des inscriptions et des montants déclarés par président
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        refresh();
                        notify.success("Statistiques actualisées.", { title: "Actualisation réussie" });
                    }}
                    disabled={loading}
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Actualiser
                </Button>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Présidents actifs</p>
                                    <p className="text-xl font-bold text-blue-600">{overview.activePresidents}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Montant validé</p>
                                    <p className="text-xl font-bold text-emerald-600">{formatMontant(overview.validatedAmount)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                    <Clock3 className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">En attente finance</p>
                                    <p className="text-xl font-bold text-amber-600">{formatMontant(overview.pendingAmount)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Participants liés</p>
                                    <p className="text-xl font-bold text-primary">{overview.totalParticipants}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="overflow-hidden">
                            <div className="px-6 py-5 border-b border-border-light dark:border-border-dark">
                                <h2 className="text-lg font-semibold text-text-main dark:text-white">
                                    Résumé par président
                                </h2>
                                <p className="text-sm text-text-secondary mt-1">
                                    Montants validés vs montants encore en attente
                                </p>
                            </div>
                            <div className="divide-y divide-border-light dark:divide-border-dark">
                                {presidentSummary.length === 0 ? (
                                    <div className="p-6 text-sm text-text-secondary">
                                        Aucune inscription président trouvée pour le moment.
                                    </div>
                                ) : (
                                    presidentSummary.map((item) => (
                                        <div key={item.id} className="p-6 flex flex-col gap-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="font-semibold text-text-main dark:text-white">
                                                        {item.president}
                                                    </p>
                                                    <p className="text-sm text-text-secondary">{item.zone}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-text-secondary">Participants</p>
                                                    <p className="text-lg font-bold text-text-main dark:text-white">
                                                        {item.participants}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                                                    <p className="text-xs text-text-secondary">Validé</p>
                                                    <p className="text-lg font-bold text-emerald-600">
                                                        {formatMontant(item.validatedAmount)}
                                                    </p>
                                                    <p className="text-xs text-text-secondary">
                                                        {item.validatedCount} inscription(s)
                                                    </p>
                                                </div>
                                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                                                    <p className="text-xs text-text-secondary">En attente</p>
                                                    <p className="text-lg font-bold text-amber-600">
                                                        {formatMontant(item.pendingAmount)}
                                                    </p>
                                                    <p className="text-xs text-text-secondary">
                                                        {item.pendingCount} inscription(s)
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card className="overflow-hidden">
                            <div className="px-6 py-5 border-b border-border-light dark:border-border-dark">
                                <h2 className="text-lg font-semibold text-text-main dark:text-white">
                                    Détail des inscriptions
                                </h2>
                                <p className="text-sm text-text-secondary mt-1">
                                    Qui a inscrit qui, avec le montant validé ou encore en attente
                                </p>
                            </div>
                            {presidentInscriptions.length === 0 ? (
                                <div className="p-6 text-sm text-text-secondary">
                                    Aucun détail à afficher pour le moment.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                            <tr>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Président</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Participant</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white text-center">Déclaré</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white text-center">Compté</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white text-center">Statut</th>
                                                <th className="p-4 font-semibold text-text-main dark:text-white">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                            {presidentInscriptions.map((inscription) => {
                                                const meta = getFinanceStatusMeta(inscription);
                                                return (
                                                    <tr key={inscription.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                                        <td className="p-4">
                                                            <div>
                                                                <p className="font-medium text-text-main dark:text-white">
                                                                    {inscription.chef_quartier?.nom_complet || "Président inconnu"}
                                                                </p>
                                                                <p className="text-xs text-text-secondary">
                                                                    {inscription.chef_quartier?.zone || "Section non précisée"}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <p className="font-medium text-text-main dark:text-white">
                                                                {inscription.nom} {inscription.prenom}
                                                            </p>
                                                            <p className="text-xs text-text-secondary">
                                                                {inscription.reference_id || "Sans référence"}
                                                            </p>
                                                        </td>
                                                        <td className="p-4 text-center font-bold text-blue-600">
                                                            {formatMontant(inscription.montant_total_paye)}
                                                        </td>
                                                        <td className="p-4 text-center font-bold text-emerald-600">
                                                            {formatMontant(getFinanceCollectedAmount(inscription))}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getFinanceBadgeClasses(meta.variant)}`}>
                                                                {meta.label}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-text-secondary">
                                                            {new Date(inscription.created_at).toLocaleDateString("fr-FR", {
                                                                day: "2-digit",
                                                                month: "2-digit",
                                                                year: "numeric",
                                                            })}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
