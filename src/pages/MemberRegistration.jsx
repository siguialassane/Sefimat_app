import { useState } from "react";
import { Link } from "react-router-dom";
import { PhotoCapture } from "@/components/ui/photo-capture";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { COMMISSIONS } from "@/lib/commissions";
import { supabase } from "@/lib/supabase";
import { notify } from "@/components/ui/toast";

export function MemberRegistration() {
    const [form, setForm] = useState({ nom: "", prenom: "", telephone: "", email: "", commission: "" });
    const [photo, setPhoto] = useState(null);
    const [loading, setLoading] = useState(false);
    const [complete, setComplete] = useState(false);

    const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    const submit = async (event) => {
        event.preventDefault();
        if (loading) return;
        if (!photo) return notify.warning("Veuillez ajouter une photo.");
        setLoading(true);
        try {
            const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
            const path = `${crypto.randomUUID()}.${extension}`;
            const { error: uploadError } = await supabase.storage.from("photos-membres").upload(path, photo, { contentType: photo.type, upsert: false });
            if (uploadError) throw uploadError;
            const { data: photoData } = supabase.storage.from("photos-membres").getPublicUrl(path);
            const photo_url = photoData.publicUrl;
            const { error } = await supabase.from("membres_organisation").insert({
                nom: form.nom.trim(), prenom: form.prenom.trim(), telephone: form.telephone.trim(),
                email: form.email.trim().toLowerCase(), commission: form.commission, photo_url,
            });
            if (error) throw error;
            setComplete(true);
        } catch (error) {
            notify.error(error.message || "Veuillez réessayer.", { title: "Inscription impossible" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-background-light dark:bg-background-dark px-4 py-8 sm:py-12">
            <div className="max-w-2xl mx-auto space-y-6">
                <header>
                    <Link to="/" className="text-sm font-semibold text-primary">SEFIMAP · Port-Bouët</Link>
                    <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-text-main dark:text-white">Inscription des membres</h1>
                    <p className="mt-2 text-sm text-text-secondary">Renseignez vos informations pour préparer votre badge d'organisation.</p>
                </header>
                {complete ? (
                    <Card className="p-6 space-y-3"><h2 className="text-xl font-bold">Inscription enregistrée</h2><p className="text-text-secondary">Vos informations ont été transmises au secrétariat pour la préparation de votre badge.</p><Link className="text-primary font-semibold" to="/">Retour à l'accueil</Link></Card>
                ) : (
                    <Card className="p-5 sm:p-7">
                        <form onSubmit={submit} className="space-y-5">
                            <div><Label>Photo du membre *</Label><div className="mt-2"><PhotoCapture onPhotoCapture={setPhoto} /></div></div>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div><Label htmlFor="member-nom">Nom *</Label><Input id="member-nom" name="nom" value={form.nom} onChange={update} maxLength={100} required /></div>
                                <div><Label htmlFor="member-prenom">Prénom(s) *</Label><Input id="member-prenom" name="prenom" value={form.prenom} onChange={update} maxLength={150} required /></div>
                                <div><Label htmlFor="member-tel">Téléphone *</Label><Input id="member-tel" name="telephone" type="tel" value={form.telephone} onChange={update} maxLength={30} required /></div>
                                <div><Label htmlFor="member-email">Email *</Label><Input id="member-email" name="email" type="email" value={form.email} onChange={update} maxLength={254} required /></div>
                            </div>
                            <div><Label htmlFor="member-commission">Commission *</Label><Select id="member-commission" name="commission" value={form.commission} onChange={update} required><option value="">Choisissez votre commission</option>{COMMISSIONS.map((item) => <option value={item.nom} key={item.nom}>{item.nom}</option>)}</Select></div>
                            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Enregistrement..." : "Valider mon inscription"}</Button>
                        </form>
                    </Card>
                )}
            </div>
        </main>
    );
}
