import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, DollarSign, CheckCircle, Plus, Undo2, Ban } from "lucide-react";
import {
    canAbandonRemainder,
    canAddPayment,
    canCancelFinanceValidation,
    canUnrejectFinance,
    getAbandonedAmount,
    getFinanceBadgeClasses,
    getFinanceCollectedAmount,
    getFinanceStatusMeta,
    getPendingAmount,
    getRemainingDue,
    getVersementStatusMeta,
    isFinanceApproved,
    isFinanceRejected,
    REQUIRED_PAYMENT_AMOUNT,
} from "@/lib/finance";
import { getUserLabel } from "@/config/users.config";

export function PaymentModal({
    inscription,
    paiements = [],
    onClose,
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
}) {
    if (!inscription) return null;

    const formatMontant = (montant) => {
        return `${new Intl.NumberFormat("fr-FR").format(montant || 0)} FCFA`;
    };

    const formatDateTime = (value) => {
        if (!value) return "—";
        return new Date(value).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const statusMeta = getFinanceStatusMeta(inscription);
    const resteDu = getRemainingDue(inscription);
    const nonDu = getAbandonedAmount(inscription);
    const dedans = getFinanceCollectedAmount(inscription);
    const dehors = getPendingAmount(inscription);
    const canValidate =
        showActions &&
        !isFinanceApproved(inscription) &&
        !isFinanceRejected(inscription) &&
        (inscription.montant_total_paye || 0) > 0;
    const dossierVersements = paiements.filter((p) => p.inscription_id === inscription.id);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg p-6 animate-fade-in">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-lg font-bold text-text-main dark:text-white">
                        Détails de l'inscription
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-text-secondary hover:text-text-main"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-center">
                        <div className="h-24 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            {inscription.photo_url ? (
                                <img
                                    src={inscription.photo_url}
                                    alt={inscription.nom}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-3xl text-gray-400">
                                    {inscription.nom?.charAt(0)}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-text-secondary">Nom complet</p>
                            <p className="font-medium text-text-main dark:text-white">
                                {inscription.nom} {inscription.prenom}
                            </p>
                        </div>
                        <div>
                            <p className="text-text-secondary">Téléphone</p>
                            <p className="font-medium text-text-main dark:text-white">
                                {inscription.telephone || "N/A"}
                            </p>
                        </div>
                        <div>
                            <p className="text-text-secondary">Origine</p>
                            <p className="font-medium text-text-main dark:text-white">
                                {inscription.chef_quartier?.nom_complet ? (
                                    <span className="flex flex-col gap-1">
                                        {inscription.chef_quartier.nom_complet}
                                        <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                                            Président
                                        </span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="Inscription guichet (Secrétariat)">
                                        Guichet
                                    </span>
                                )}
                            </p>
                        </div>
                        <div>
                            <p className="text-text-secondary">Date d'inscription</p>
                            <p className="font-medium text-text-main dark:text-white">
                                {new Date(inscription.created_at).toLocaleDateString("fr-FR")}
                            </p>
                        </div>
                    </div>

                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-2 mb-3">
                            <DollarSign className="h-5 w-5 text-emerald-600" />
                            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                                Détails du paiement
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-emerald-700 dark:text-emerald-400">Reçu en caisse (dedans)</p>
                                <p className="font-bold text-emerald-600 text-lg">
                                    {formatMontant(dedans)}
                                </p>
                            </div>
                            <div>
                                <p className="text-emerald-700 dark:text-emerald-400">En attente (dehors)</p>
                                <p className="font-bold text-amber-600 text-lg">
                                    {formatMontant(dehors)}
                                </p>
                            </div>
                            <div>
                                <p className="text-emerald-700 dark:text-emerald-400">Montant déclaré</p>
                                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                    {formatMontant(inscription.montant_total_paye)}
                                </p>
                            </div>
                            <div>
                                <p className="text-emerald-700 dark:text-emerald-400">Reliquat non dû</p>
                                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                    {formatMontant(nonDu)}
                                </p>
                            </div>
                            <div>
                                <p className="text-emerald-700 dark:text-emerald-400">Montant requis</p>
                                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                    {formatMontant(inscription.montant_requis || REQUIRED_PAYMENT_AMOUNT)}
                                </p>
                            </div>
                            <div>
                                <p className="text-emerald-700 dark:text-emerald-400">Reste à payer</p>
                                <p className="font-bold text-red-600 text-lg">
                                    {formatMontant(resteDu)}
                                </p>
                                {nonDu > 0 && (
                                    <p className="text-xs text-text-secondary">
                                        Dont {formatMontant(nonDu)} non dus (abandonnés)
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                        <span className="text-text-secondary">Statut:</span>
                        <Badge className={getFinanceBadgeClasses(statusMeta.variant)}>{statusMeta.label}</Badge>
                    </div>

                    {dossierVersements.length > 0 && (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <p className="px-3 py-2 text-sm font-semibold text-text-main dark:text-white bg-gray-50 dark:bg-gray-800">
                                Versements ({dossierVersements.length})
                            </p>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {dossierVersements.map((versement) => {
                                    const meta = getVersementStatusMeta(versement);
                                    return (
                                        <div key={versement.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                                            <div>
                                                <p className="font-medium text-text-main dark:text-white">
                                                    {formatMontant(versement.montant)}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    Déclaré le {formatDateTime(versement.created_at)}
                                                    {versement.cree_par ? ` par ${getUserLabel(versement.cree_par)}` : ""}
                                                </p>
                                                {versement.statut === "validé" && (
                                                    <p className="text-xs text-emerald-600">
                                                        Reçu le {formatDateTime(versement.date_reception)}
                                                        {versement.recu_par ? ` par ${getUserLabel(versement.recu_par)}` : ""}
                                                    </p>
                                                )}
                                                {versement.statut === "refuse" && versement.motif_refus && (
                                                    <p className="text-xs text-red-600">Motif : {versement.motif_refus}</p>
                                                )}
                                            </div>
                                            <Badge className={getFinanceBadgeClasses(meta.variant)}>{meta.label}</Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="text-xs text-text-secondary space-y-1">
                        {inscription.valide_par_financier && (
                            <p>
                                Validé par {getUserLabel(inscription.valide_par_financier)}
                                {inscription.date_validation_financier
                                    ? ` le ${formatDateTime(inscription.date_validation_financier)}`
                                    : ""}
                            </p>
                        )}
                        {inscription.refuse_par && (
                            <p>
                                Refusé par {getUserLabel(inscription.refuse_par)}
                                {inscription.date_refus ? ` le ${formatDateTime(inscription.date_refus)}` : ""}
                                {inscription.motif_refus ? ` — ${inscription.motif_refus}` : ""}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 mt-6 flex-wrap">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Fermer
                    </Button>
                    {canValidate && (
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => onValidate?.(inscription.id)}
                            disabled={actionLoading}
                            title="Le dossier part au secrétariat ; la dette restante reste suivie"
                        >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Valider le dossier
                        </Button>
                    )}
                    {showAddPayment && canAddPayment(inscription) && (
                        <Button
                            variant="outline"
                            onClick={() => onAddPayment?.(inscription.id)}
                            disabled={actionLoading}
                            title="Ajouter un paiement"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Paiement
                        </Button>
                    )}
                    {showAbandon && canAbandonRemainder(inscription) && (
                        <Button
                            variant="outline"
                            onClick={() => onAbandon?.(inscription.id)}
                            disabled={actionLoading}
                            title={`Abandonner le reliquat restant (${formatMontant(resteDu)}) — geste irréversible`}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                            <Ban className="h-4 w-4 mr-2" />
                            Abandonner
                        </Button>
                    )}
                    {showCancelValidation && canCancelFinanceValidation(inscription) && (
                        <Button
                            variant="outline"
                            onClick={() => onCancelValidation?.(inscription.id)}
                            disabled={actionLoading}
                            title="Annuler la validation (le dossier retourne en attente finance)"
                        >
                            <Undo2 className="h-4 w-4 mr-2" />
                            Annuler
                        </Button>
                    )}
                    {showUnreject && canUnrejectFinance(inscription) && (
                        <Button
                            variant="outline"
                            onClick={() => onUnreject?.(inscription.id)}
                            disabled={actionLoading}
                            title="Annuler le refus (le dossier retourne en attente finance)"
                        >
                            <Undo2 className="h-4 w-4 mr-2" />
                            Rouvrir
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
}
