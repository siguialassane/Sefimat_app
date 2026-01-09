import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle, XCircle } from "lucide-react";

export function PaymentTable({
    inscriptions,
    loading,
    onViewDetails,
    onValidate,
    onReject,
    actionLoading,
    showActions = true,
    emptyMessage = "Aucun résultat",
    emptyDescription = "Aucune inscription ne correspond à vos critères.",
}) {
    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const getStatutBadge = (inscription) => {
        if (inscription.statut_paiement === "valide_financier") {
            return <Badge className="bg-emerald-500 text-white">Validé</Badge>;
        }
        if (inscription.statut_paiement === "soldé" || (inscription.montant_total_paye || 0) >= (inscription.montant_requis || 4000)) {
            return <Badge className="bg-blue-500 text-white">Soldé</Badge>;
        }
        if (inscription.statut_paiement === "refuse") {
            return <Badge variant="destructive">Refusé</Badge>;
        }
        if (inscription.statut_paiement === "partiel") {
            return <Badge className="bg-orange-500 text-white">Partiel</Badge>;
        }
        return <Badge variant="secondary">Non payé</Badge>;
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
                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                Participant
                            </th>
                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                Référence
                            </th>
                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                Président de section
                            </th>
                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">
                                Montant payé
                            </th>
                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">
                                Reste
                            </th>
                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">
                                Statut
                            </th>
                            <th className="p-4 font-semibold text-text-main dark:text-white text-right">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                        {inscriptions.map((inscription) => {
                            const isPresentiel = !inscription.chef_quartier_id;
                            const isComplete = (inscription.montant_total_paye || 0) >= (inscription.montant_requis || 4000);
                            const isValidated = inscription.statut_paiement === "valide_financier" || inscription.statut_paiement === "soldé";
                            const canValidate = showActions && !isComplete && !isValidated;

                            return (
                                <tr
                                    key={inscription.id}
                                    className={`transition-colors ${
                                        isComplete || isValidated
                                            ? "bg-emerald-50/30 dark:bg-emerald-900/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20"
                                            : "hover:bg-gray-50 dark:hover:bg-white/5"
                                    }`}
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
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                                🏢 Présentiel
                                            </span>
                                        ) : (
                                            <span className="text-text-secondary">
                                                {inscription.chef_quartier?.nom_complet}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`font-bold ${isComplete ? "text-emerald-600" : "text-blue-600"}`}>
                                            {formatMontant(inscription.montant_total_paye)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {isComplete ? (
                                            <span className="text-emerald-600 font-medium">Soldé</span>
                                        ) : (
                                            <span className="text-red-500">
                                                {formatMontant(
                                                    (inscription.montant_requis || 4000) -
                                                    (inscription.montant_total_paye || 0)
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        {getStatutBadge(inscription)}
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
                                                <>
                                                    <Button
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700"
                                                        onClick={() => onValidate?.(inscription.id)}
                                                        disabled={actionLoading}
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                        Valider
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => onReject?.(inscription.id)}
                                                        disabled={actionLoading}
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
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
