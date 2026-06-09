import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, DollarSign, CheckCircle, XCircle } from "lucide-react";
import {
    getFinanceBadgeClasses,
    getFinanceCollectedAmount,
    getFinanceStatusMeta,
    isFinanceApproved,
    isFinanceRejected,
} from "@/lib/finance";

export function PaymentModal({
    inscription,
    onClose,
    onValidate,
    onReject,
    actionLoading,
    showActions = true,
}) {
    if (!inscription) return null;

    const formatMontant = (montant) => {
        return `${new Intl.NumberFormat("fr-FR").format(montant || 0)} FCFA`;
    };

    const statusMeta = getFinanceStatusMeta(inscription);
    const countedAmount = getFinanceCollectedAmount(inscription);
    const canValidate =
        showActions &&
        !isFinanceApproved(inscription) &&
        !isFinanceRejected(inscription) &&
        (inscription.montant_total_paye || 0) > 0;

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
                            <p className="text-text-secondary">Président de section</p>
                            <p className="font-medium text-text-main dark:text-white">
                                {inscription.chef_quartier?.nom_complet || (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                        Présentiel
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
                                <p className="text-emerald-700 dark:text-emerald-400">Montant déclaré</p>
                                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                    {formatMontant(inscription.montant_total_paye)}
                                </p>
                            </div>
                            <div>
                                <p className="text-emerald-700 dark:text-emerald-400">Montant compté</p>
                                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                    {formatMontant(countedAmount)}
                                </p>
                            </div>
                            <div>
                                <p className="text-emerald-700 dark:text-emerald-400">Montant requis</p>
                                <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                                    {formatMontant(inscription.montant_requis || 4000)}
                                </p>
                            </div>
                            <div>
                                <p className="text-emerald-700 dark:text-emerald-400">Reste à payer</p>
                                <p className="font-bold text-red-600 text-lg">
                                    {formatMontant(
                                        Math.max(
                                            0,
                                            (inscription.montant_requis || 4000) - (inscription.montant_total_paye || 0)
                                        )
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                        <span className="text-text-secondary">Statut:</span>
                        <Badge className={getFinanceBadgeClasses(statusMeta.variant)}>{statusMeta.label}</Badge>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Fermer
                    </Button>
                    {canValidate && (
                        <>
                            <Button
                                variant="destructive"
                                onClick={() => onReject?.(inscription.id)}
                                disabled={actionLoading}
                            >
                                <XCircle className="h-4 w-4 mr-2" />
                                Refuser
                            </Button>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => onValidate?.(inscription.id)}
                                disabled={actionLoading}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Valider
                            </Button>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}
