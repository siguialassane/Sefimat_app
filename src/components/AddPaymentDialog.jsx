import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notify } from "@/components/ui/toast";

/**
 * Dialogue partagé "Ajouter un paiement" (staff : finance / secrétariat).
 * Enregistre le versement via la RPC add_payment SANS toucher au workflow :
 * un complément ne fait jamais reculer un dossier validé.
 *
 * Props :
 * - inscription : ligne inscriptions concernée
 * - onClose : fermer le dialogue
 * - onSuccess : (id, updates) appelé après enregistrement (updates inclut montant_total_paye)
 */
export function AddPaymentDialog({ inscription, onClose, onSuccess }) {
    const [amount, setAmount] = useState("");
    const [mode, setMode] = useState("especes");
    const [submitting, setSubmitting] = useState(false);

    if (!inscription) return null;

    const requis = inscription.montant_requis || 4000;
    const totalPaye = inscription.montant_total_paye || 0;
    const remaining = Math.max(0, requis - totalPaye);

    const handleSubmit = async () => {
        const value = Math.floor(Number(amount));
        if (!value || value <= 0) {
            notify.warning("Veuillez saisir un montant supérieur à 0.", { title: "Montant invalide" });
            return;
        }
        if (value > remaining) {
            notify.warning(`Le montant ne peut pas dépasser le reste (${remaining.toLocaleString("fr-FR")} FCFA).`, {
                title: "Montant invalide",
            });
            return;
        }

        setSubmitting(true);
        try {
            const { data, error } = await supabase.rpc("add_payment", {
                p_inscription_id: inscription.id,
                p_montant: value,
                p_mode_paiement: mode,
                p_type_paiement: "inscription",
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Erreur lors de l'ajout du paiement");

            const newTotal = data.new_total ?? totalPaye + value;
            const updates = {
                montant_total_paye: newTotal,
                statut_paiement: newTotal >= requis ? "soldé" : newTotal > 0 ? "partiel" : "non_payé",
            };
            // Si la finance avait abandonné un reliquat, le réduire du montant ajouté
            if (["pending_secretariat", "completed"].includes(inscription.workflow_status)) {
                updates.montant_non_du = Math.max(0, requis - newTotal);
            }

            const { error: updateError } = await supabase
                .from("inscriptions")
                .update(updates)
                .eq("id", inscription.id);
            if (updateError) throw updateError;

            notify.success(
                `Paiement de ${value.toLocaleString("fr-FR")} FCFA enregistré. Nouveau total : ${newTotal.toLocaleString("fr-FR")} FCFA.`,
                { title: "Paiement enregistré" }
            );
            onSuccess?.(inscription.id, updates);
            onClose?.();
        } catch (err) {
            console.error("AddPaymentDialog: erreur:", err);
            notify.error(err.message || "Erreur lors de l'ajout du paiement", { title: "Échec paiement" });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6 animate-fade-in">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-text-main dark:text-white flex items-center gap-2">
                        <Plus className="h-5 w-5 text-emerald-600" />
                        Ajouter un paiement
                    </h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-main">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <p className="text-sm text-text-secondary mb-1">
                    {inscription.nom} {inscription.prenom}
                </p>
                <p className="text-sm mb-4">
                    <span className="text-emerald-600 font-medium">
                        Payé : {totalPaye.toLocaleString("fr-FR")} FCFA
                    </span>
                    <span className="text-text-secondary"> • </span>
                    <span className="text-red-500">
                        Reste : {remaining.toLocaleString("fr-FR")} FCFA
                    </span>
                </p>

                <div className="space-y-4">
                    <div>
                        <Label htmlFor="staff-payment-amount">Montant (FCFA) *</Label>
                        <Input
                            id="staff-payment-amount"
                            type="number"
                            min="1"
                            max={remaining}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`Max ${remaining.toLocaleString("fr-FR")}`}
                        />
                    </div>
                    <div>
                        <Label htmlFor="staff-payment-mode">Mode de paiement</Label>
                        <Select id="staff-payment-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                            <option value="especes">Espèces</option>
                            <option value="mobile_money">Mobile Money</option>
                            <option value="virement">Virement</option>
                        </Select>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                        Annuler
                    </Button>
                    <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleSubmit}
                        disabled={submitting || remaining <= 0}
                    >
                        {submitting ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
