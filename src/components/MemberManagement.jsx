import { useEffect, useRef, useState } from "react";
import { Copy, Download, RefreshCw, Trash2 } from "lucide-react";
import { memberClient } from "@/lib/memberAuth";
import { MemberBadge } from "@/components/MemberBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/ui/toast";

export function MemberManagement() {
    const [session, setSession] = useState(null);
    const [ready, setReady] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [members, setMembers] = useState([]);
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState(false);
    const badgeRef = useRef(null);
    const siteOrigin = import.meta.env.VITE_PUBLIC_SITE_URL ||
        (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
            ? "https://sefimat-app.vercel.app" : window.location.origin);
    const registrationLink = `${siteOrigin.replace(/\/$/, "")}/inscription-membre`;

    const load = async () => {
        const access = await memberClient.rpc("peut_gerer_membres");
        if (access.error || access.data !== true) {
            notify.error("Ce compte n'est pas autorisé à gérer les membres.", { title: "Accès refusé" });
            await memberClient.auth.signOut();
            return;
        }
        const { data, error } = await memberClient.from("membres_organisation").select("*").order("created_at", { ascending: false });
        if (error) { notify.error(error.message, { title: "Chargement impossible" }); return; }
        const rows = data || [];
        const paths = rows.map((item) => {
            try { return decodeURIComponent(new URL(item.photo_url).pathname.split("/").pop()); }
            catch { return ""; }
        });
        const validPaths = paths.filter(Boolean);
        const { data: signedPhotos, error: photoError } = validPaths.length
            ? await memberClient.storage.from("photos-membres").createSignedUrls(validPaths, 3600)
            : { data: [] };
        if (photoError) notify.error("Les photos des membres n'ont pas pu être chargées.");
        const signedByPath = new Map((signedPhotos || []).map((photo) => [photo.path, photo.signedUrl]));
        const membersWithPhotos = rows.map((item, index) => ({ ...item, photo_path: paths[index], photo_url: signedByPath.get(paths[index]) || "" }));
        setMembers(membersWithPhotos);
        setSelected((old) => membersWithPhotos.find((item) => item.id === old?.id) || membersWithPhotos[0] || null);
    };

    useEffect(() => {
        let active = true;
        memberClient.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } });
        const { data } = memberClient.auth.onAuthStateChange((_event, next) => setSession(next));
        return () => { active = false; data.subscription.unsubscribe(); };
    }, []);
    useEffect(() => { if (session) load(); else { setMembers([]); setSelected(null); } }, [session]);
    useEffect(() => {
        if (!session) return undefined;
        const channel = memberClient.channel("membres-organisation")
            .on("postgres_changes", { event: "*", schema: "public", table: "membres_organisation" }, () => { load(); })
            .subscribe();
        return () => { memberClient.removeChannel(channel); };
    }, [session]);

    const login = async (event) => {
        event.preventDefault();
        setBusy(true);
        const { error } = await memberClient.auth.signInWithPassword({ email, password });
        if (error) notify.error(error.message, { title: "Connexion impossible" });
        setBusy(false);
    };
    const remove = async (member) => {
        if (!window.confirm(`Supprimer l'inscription de ${member.nom} ${member.prenom} ?`)) return;
        setBusy(true);
        const { error, data } = await memberClient.from("membres_organisation").delete().eq("id", member.id).select("id");
        if (error || !data?.length) notify.error(error?.message || "Suppression non autorisée.");
        else {
            const { error: photoError } = member.photo_path
                ? await memberClient.storage.from("photos-membres").remove([member.photo_path])
                : { error: null };
            if (photoError) notify.warning("Membre supprimé, mais la photo n'a pas pu être supprimée du stockage.");
            else notify.success("Membre et photo supprimés.");
            await load();
        }
        setBusy(false);
    };
    const download = async () => {
        if (!badgeRef.current || !selected) return;
        setBusy(true);
        try {
            const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
            const canvas = await html2canvas(badgeRef.current, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
            pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 105, 148);
            pdf.save(`badge-membre-${selected.nom}-${selected.prenom}.pdf`);
        } catch (error) { notify.error(error.message || "Impossible de générer le badge."); }
        finally { setBusy(false); }
    };
    const copyLink = async () => {
        try { await navigator.clipboard.writeText(registrationLink); notify.success("Lien copié."); }
        catch { notify.error("Impossible de copier le lien. Sélectionnez-le pour le copier."); }
    };
    const filtered = members.filter((member) => `${member.nom} ${member.prenom} ${member.commission}`.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <div><h2 className="text-2xl font-bold text-text-main dark:text-white">Badges des membres</h2><p className="text-sm text-text-secondary mt-1">Partagez le lien d'inscription, puis préparez les badges des commissions.</p></div>
            <Card className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center"><Input readOnly value={registrationLink} aria-label="Lien d'inscription des membres" /><Button variant="outline" onClick={copyLink} className="gap-2 shrink-0"><Copy className="h-4 w-4" /> Copier le lien</Button></Card>
            {!ready ? <p className="text-text-secondary">Chargement...</p> : !session ? (
                <Card className="p-6 max-w-md"><h3 className="font-semibold mb-2">Connexion à la gestion des membres</h3><p className="text-sm text-text-secondary mb-4">Utilisez le compte dédié à la gestion des membres pour accéder aux coordonnées.</p><form onSubmit={login} className="space-y-3"><Input type="email" placeholder="Email" aria-label="Email du compte membres" value={email} onChange={(e) => setEmail(e.target.value)} required /><Input type="password" placeholder="Mot de passe" aria-label="Mot de passe du compte membres" value={password} onChange={(e) => setPassword(e.target.value)} required /><Button type="submit" disabled={busy}>Se connecter</Button></form></Card>
            ) : (
                <div className="grid lg:grid-cols-2 gap-6">
                    <Card className="overflow-hidden"><div className="p-4 space-y-3"><div className="flex items-center justify-between"><h3 className="font-semibold">Membres ({filtered.length})</h3><Button variant="outline" size="sm" onClick={load} aria-label="Actualiser la liste"><RefreshCw className="h-4 w-4" /></Button></div><Input placeholder="Rechercher un membre ou une commission" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="divide-y divide-border-light dark:divide-border-dark max-h-[600px] overflow-y-auto">{filtered.length === 0 ? <p className="p-5 text-text-secondary text-sm">Aucun membre trouvé.</p> : filtered.map((member) => <div key={member.id} className="p-4 flex items-center gap-3"><button type="button" onClick={() => setSelected(member)} className="flex items-center gap-3 text-left flex-1 min-w-0">{member.photo_url ? <img src={member.photo_url} alt="" className="h-11 w-11 rounded-full object-cover bg-gray-100" /> : <span className="h-11 w-11 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">{member.nom?.charAt(0)}</span>}<span className="min-w-0"><span className="block font-semibold truncate">{member.nom} {member.prenom}</span><span className="block text-xs text-text-secondary truncate">{member.commission}</span></span></button><Button variant="outline" size="sm" onClick={() => remove(member)} disabled={busy} aria-label={`Supprimer ${member.nom} ${member.prenom}`}><Trash2 className="h-4 w-4 text-red-600" /></Button></div>)}</div></Card>
                    <Card className="p-5"><h3 className="font-semibold mb-4">Prévisualisation</h3>{selected ? <><div className="overflow-x-auto"><MemberBadge member={selected} badgeRef={badgeRef} /></div><div className="text-sm text-text-secondary mt-4 space-y-1"><p>{selected.telephone}</p><p>{selected.email}</p></div><Button className="mt-4 gap-2" onClick={download} disabled={busy}><Download className="h-4 w-4" /> Télécharger le badge PDF</Button></> : <p className="text-text-secondary">Sélectionnez un membre pour voir son badge.</p>}</Card>
                </div>
            )}
        </div>
    );
}
