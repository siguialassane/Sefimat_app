import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserPlus, Ticket, Copy, CheckCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, useData } from "@/contexts";
import { notify } from "@/components/ui/toast";
import { REQUIRED_PAYMENT_AMOUNT } from "@/lib/finance";

const MONTANT_REQUIS = REQUIRED_PAYMENT_AMOUNT;

// Préinscription présentielle (cellule finance) : nom + prénom + montant
// encaissé (> 0, dedans direct). Le trigger trigger_set_reference_id génère
// le code SEFI- que le participant présente au secrétariat pour finaliser.
export function Preinscription() {
    const { user } = useAuth();
    const { refresh } = useData();
    const [nom, setNom] = useState("");
    const [prenom, setPrenom] = useState("");
    const [montant, setMontant] = useState("");
    const [mode, setMode] = useState("especes");
    const [saving, setSaving] = useState(false);
    const [resultat, setResultat] = useState(null);

    const handleSubmit = async (e) => {
        e?.preventDefault();
        const nomClean = nom.trim();
        const prenomClean = prenom.trim();
        const value = Math.floor(Number(montant));
        if (nomClean.length < 2 || prenomClean.length < 2) {
            notify.warning("Nom et prénom (2 caractères minimum) sont obligatoires.", { title: "Identité incomplète" });
            return;
        }
        if (!value || value <= 0) {
            notify.warning("Le montant encaissé est obligatoire (minimum 1 FCFA).", { title: "Montant invalide" });
            return;
        }
        if (value > MONTANT_REQUIS) {
            notify.warning(`Le montant ne peut pas dépasser ${MONTANT_REQUIS.toLocaleString("fr-FR")} FCFA.`, { title: "Montant invalide" });
            return;
        }
        setSaving(true);
        try {
            const now = new Date().toISOString();
            const { data: inscription, error } = await supabase
                .from("inscriptions")
                .insert({
                    nom: nomClean,
                    prenom: prenomClean,
                    type_inscription: "presentielle",
                    created_by: "finance",
                    admin_id: user?.id || null,
                    statut: "en_attente",
                    statut_paiement: value >= MONTANT_REQUIS ? "soldé" : "partiel",
                    montant_total_paye: value,
                    montant_requis: MONTANT_REQUIS,
                    dossier_complet: false,
                })
                .select("id, reference_id")
                .single();
            if (error) throw error;

            const { error: paiementError } = await supabase.from("paiements").insert({
                inscription_id: inscription.id,
                montant: value,
                mode_paiement: mode,
                statut: "validé",
                cree_par: user?.id || null,
                recu_par: user?.id || null,
                date_reception: now,
                type_paiement: "inscription",
                valide_par: user?.id || null,
            });
            if (paiementError) throw paiementError;

            await refresh();
            setResultat({ code: inscription.reference_id, nom: nomClean, prenom: prenomClean, montant: value });
            setNom("");
            setPrenom("");
            setMontant("");
            notify.success(`Préinscription ${inscription.reference_id} créée — argent en caisse.`, { title: "Code généré" });
        } catch (err) {
            console.error("Erreur préinscription:", err);
            notify.error(err.message || "Création impossible", { title: "Erreur" });
        } finally {
            setSaving(false);
        }
    };

    const copierCode = async () => {
        if (!resultat?.code) return;
        try {
            await navigator.clipboard.writeText(resultat.code);
            notify.success("Code copié.", { title: "Copié" });
        } catch {
            notify.warning("Copie impossible, notez le code affiché.", { title: "Copie" });
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto px-6 py-8">
            <header className="flex flex-col gap-2 mb-8">
                <h1 className="text-text-main dark:text-white text-3xl font-black tracking-tight flex items-center gap-3">
                    <UserPlus className="h-8 w-8 text-primary" />
                    Préinscription présentielle
                </h1>
                <p className="text-text-secondary dark:text-gray-400">
                    Encaissez et générez le code que le participant présentera au secrétariat pour finaliser son dossier.
                </p>
            </header>

            {resultat ? (
                <Card className="border-emerald-500/50">
                    <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
                        <CheckCircle className="h-12 w-12 text-emerald-500" />
                        <p className="text-text-secondary dark:text-gray-400">
                            {resultat.nom} {resultat.prenom} — {resultat.montant.toLocaleString("fr-FR")} FCFA encaissés
                        </p>
                        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-6 py-4">
                            <Ticket className="h-6 w-6 text-primary" />
                            <span className="text-3xl font-black font-mono text-primary tracking-wider">{resultat.code}</span>
                            <Button variant="ghost" size="sm" onClick={copierCode} title="Copier le code">
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-sm text-text-secondary dark:text-gray-400">
                            Communiquez ce code au participant : le secrétariat finalisera son inscription avec.
                        </p>
                        <Button variant="outline" className="gap-2" onClick={() => setResultat(null)}>
                            <RotateCcw className="h-4 w-4" />
                            Nouvelle préinscription
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Nouvelle préinscription</CardTitle>
                        <CardDescription>Nom, prénom et montant encaissé. Le reste sera complété au secrétariat.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="pre-nom">Nom *</Label>
                                    <Input id="pre-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du participant" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="pre-prenom">Prénom *</Label>
                                    <Input id="pre-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom du participant" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="pre-montant">Montant encaissé (FCFA) *</Label>
                                    <Input id="pre-montant" type="number" min="1" max={MONTANT_REQUIS} value={montant} onChange={(e) => setMontant(e.target.value)} placeholder={`1 – ${MONTANT_REQUIS}`} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="pre-mode">Mode de paiement</Label>
                                    <Select id="pre-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                                        <option value="especes">Espèces</option>
                                        <option value="mobile_money">Mobile Money</option>
                                        <option value="virement">Virement</option>
                                    </Select>
                                </div>
                            </div>
                            <Button type="submit" disabled={saving} className="mt-2">
                                {saving ? "Création..." : "Encaisser et générer le code"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
