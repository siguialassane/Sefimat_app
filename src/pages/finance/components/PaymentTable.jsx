import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle, Ban, Plus, Undo2 } from "lucide-react";
import {
    canAbandonRemainder,
    canAddPayment,
    canCancelFinanceValidation,
    canUnrejectFinance,
    getAbandonedAmount,
    getFinanceBadgeClasses,
    getFinanceStatusMeta,
    getRemainingDue,
    isFinanceApproved,
    isFinanceRejected,
    isFinanceValidationPending,
    isFullyPaid,
} from "@/lib/finance";

export function PaymentTable({
    inscriptions,
    loading,
    onViewDetails,
    onValidate,
    onAddPayment,
    onCancelValidation,
    onAbandon,
    onUnreject,
    actionLoading,
    showActions = true,
    showAddPayment = false,
    showCancelValidation = false,
    showAbandon = false,
    showUnreject = false,
    emptyMessage = "Aucun résultat",
    emptyDescription = "Aucune inscription ne correspond à vos critères.",
}) {
    const formatMontant = (montant) => {
        return `${new Intl.NumberFormat("fr-FR").format(montant || 0)} FCFA`;
    };

    const renderStatusBadge = (inscription) => {
        const meta = getFinanceStatusMeta(inscription);
        return <Badge className={getFinanceBadgeClasses(meta.variant)}>{meta.label}</Badge>;
    };

    if (loading && !inscriptions.length) {
        return (
            <Card>
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-text-secondary">Chargement...</p>
                </div>
            </Card>
        );
    }

    if (inscriptions.length === 0) {
        return (
            <Card>
                <div className="flex flex-col items-center justify-center py-16">
                    <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
                    <p className="text-text-main dark:text-white text-lg font-medium">
                        {emptyMessage}
                    </p>
                    <p className="text-text-secondary">{emptyDescription}</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                        <tr>
                            <th className="p-4 font-semibold text-text-main dark:text-white">Participant</th>
                            <th className="p-4 font-semibold text-text-main dark:text-white">Référence</th>
                            <th className="p-4 font-semibold text-text-main dark:text-white">Président de section</th>
                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">Montant déclaré</th>
                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">Reste</th>
                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">Statut</th>
                            <th className="p-4 font-semibold text-text-main dark:text-white text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                        {inscriptions.map((inscription) => {
                            const isPresentiel = !inscription.chef_quartier_id;
                            const isPending = isFinanceValidationPending(inscription);
                            const isApproved = isFinanceApproved(inscription);
                            const isRejected = isFinanceRejected(inscription);
                            const isComplete = isFullyPaid(inscription);
                            const resteDu = getRemainingDue(inscription);
                            const nonDu = getAbandonedAmount(inscription);
                            const canValidate =
                                showActions &&
                                !isRejected &&
                                !isApproved &&
                                (inscription.montant_total_paye || 0) > 0;

                            return (
                                <tr
                                    key={inscription.id}
                                    className={
                                        isApproved
                                            ? "bg-emerald-50/30 dark:bg-emerald-900/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20"
                                            : isPending
                                                ? "bg-amber-50/20 dark:bg-amber-900/10 hover:bg-amber-50/40 dark:hover:bg-amber-900/20"
                                                : "hover:bg-gray-50 dark:hover:bg-white/5"
                                    }
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                                                {inscription.photo_url ? (
                                                    <img
                                                        src={inscription.photo_url}
                                                        alt={inscription.nom}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-lg text-gray-400">
                                                        {inscription.nom?.charAt(0)}
                                                    </span>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-text-main dark:text-white">
                                                    {inscription.nom} {inscription.prenom}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    {inscription.telephone || "N/A"}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 font-mono text-sm text-primary">
                                        {inscription.reference_id || "N/A"}
                                    </td>
                                    <td className="p-4">
                                        {isPresentiel ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700" title="Inscription guichet (Secrétariat)">
                                                Guichet
                                            </span>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-text-secondary">
                                                    {inscription.chef_quartier?.nom_complet}
                                                </span>
                                                <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                                                    Président
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`font-bold ${isComplete ? "text-emerald-600" : "text-blue-600"}`}>
                                            {formatMontant(inscription.montant_total_paye)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {resteDu === 0 && nonDu > 0 ? (
                                            <span className="text-text-secondary font-medium" title="Reliquat abandonné (non dû)">
                                                Non dû
                                            </span>
                                        ) : isComplete ? (
                                            <span className="text-emerald-600 font-medium">Soldé</span>
                                        ) : (
                                            <span className="text-red-500">
                                                {formatMontant(resteDu)}
                                                {nonDu > 0 && (
                                                    <span className="block text-[11px] text-text-secondary">
                                                        (−{formatMontant(nonDu)} non dus)
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        {renderStatusBadge(inscription)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onViewDetails?.(inscription)}
                                            >
                                                <Eye className="h-4 w-4 mr-1" />
                                                Détails
                                            </Button>
                                            {canValidate && (
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={() => onValidate?.(inscription.id)}
                                                    disabled={actionLoading}
                                                    title="Valider le dossier (part au secrétariat ; la dette restante reste suivie)"
                                                >
                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                    Valider
                                                </Button>
                                            )}
                                            {showAddPayment && canAddPayment(inscription) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onAddPayment?.(inscription.id)}
                                                    disabled={actionLoading}
                                                    title="Ajouter un paiement"
                                                >
                                                    <Plus className="h-4 w-4 mr-1" />
                                                    Paiement
                                                </Button>
                                            )}
                                            {showAbandon && canAbandonRemainder(inscription) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onAbandon?.(inscription.id)}
                                                    disabled={actionLoading}
                                                    title={`Abandonner le reliquat restant (${formatMontant(resteDu)}) — geste irréversible`}
                                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                                >
                                                    <Ban className="h-4 w-4 mr-1" />
                                                    Abandonner
                                                </Button>
                                            )}
                                            {showCancelValidation && canCancelFinanceValidation(inscription) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onCancelValidation?.(inscription.id)}
                                                    disabled={actionLoading}
                                                    title="Annuler la validation (le dossier retourne en attente finance)"
                                                >
                                                    <Undo2 className="h-4 w-4 mr-1" />
                                                    Annuler
                                                </Button>
                                            )}
                                            {showUnreject && canUnrejectFinance(inscription) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => onUnreject?.(inscription.id)}
                                                    disabled={actionLoading}
                                                    title="Annuler le refus (le dossier retourne en attente finance)"
                                                >
                                                    <Undo2 className="h-4 w-4 mr-1" />
                                                    Rouvrir
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="bg-surface-light dark:bg-surface-dark px-4 py-3 flex items-center justify-between border-t border-border-light dark:border-border-dark">
                <p className="text-sm text-text-secondary">
                    <span className="font-medium text-text-main dark:text-white">
                        {inscriptions.length}
                    </span>{" "}
                    résultats affichés
                </p>
            </div>
        </Card>
    );
}
