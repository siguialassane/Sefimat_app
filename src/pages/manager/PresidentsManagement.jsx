import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Plus,
    Trash2,
    X,
    Copy,
    Check,
    Link as LinkIcon,
    RefreshCw,
    Eye,
    Search,
} from "lucide-react";
import { useData } from "@/contexts";
import { supabase } from "@/lib/supabase";
import { notify } from "@/components/ui/toast";

function generateLienUnique(existing) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 20; attempt++) {
        let code = "";
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (!existing.includes(code)) return code;
    }
    return null;
}

export function PresidentsManagement() {
    const { inscriptions, chefsQuartier, loading, refresh } = useData();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [copied, setCopied] = useState(false);
    const [createdPresident, setCreatedPresident] = useState(null);
    const [form, setForm] = useState({
        nom_complet: "",
        zone: "",
        telephone: "",
        email: "",
        ecole: "",
    });

    const rows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return (chefsQuartier || [])
            .filter((chef) => {
                if (!term) return true;
                return (
                    chef.nom_complet?.toLowerCase().includes(term) ||
                    chef.zone?.toLowerCase().includes(term)
                );
            })
            .map((chef) => {
                const dossiers = inscriptions.filter((i) => i.chef_quartier_id === chef.id);
                const totalEncaisse = dossiers.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0);
                return {
                    chef,
                    dossiers: dossiers.length,
                    totalEncaisse,
                    // Suppression autorisée uniquement sans inscription ni paiement lié
                    deletable: dossiers.length === 0 && totalEncaisse === 0,
                };
            })
            .sort((a, b) => a.chef.nom_complet.localeCompare(b.chef.nom_complet, "fr"));
    }, [inscriptions, chefsQuartier, searchTerm]);

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    const openModal = () => {
        setForm({ nom_complet: "", zone: "", telephone: "", email: "", ecole: "" });
        setCreatedPresident(null);
        setCopied(false);
        setModalOpen(true);
    };

    const handleCreate = async () => {
        if (!form.nom_complet.trim() || !form.zone.trim()) {
            notify.warning("Le nom complet et la section (zone) sont obligatoires.", {
                title: "Champs manquants",
            });
            return;
        }
        setSaving(true);
        try {
            const existingCodes = (chefsQuartier || []).map((c) => c.lien_unique).filter(Boolean);
            const lienUnique = generateLienUnique(existingCodes);
            if (!lienUnique) throw new Error("Impossible de générer un lien unique, réessayez.");

            const { data, error } = await supabase
                .from("chefs_quartier")
                .insert({
                    nom_complet: form.nom_complet.trim(),
                    zone: form.zone.trim(),
                    telephone: form.telephone.trim() || null,
                    email: form.email.trim() || null,
                    ecole: form.ecole.trim() || null,
                    lien_unique: lienUnique,
                })
                .select()
                .single();
            if (error) throw error;

            setCreatedPresident(data);
            await refresh();
            notify.success(`Président ${data.nom_complet} créé avec succès.`, { title: "Création réussie" });
        } catch (err) {
            console.error("Erreur création président:", err);
            notify.error(err.message || "Erreur lors de la création", { title: "Création impossible" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row) => {
        if (!row.deletable) {
            notify.warning(
                `Impossible de supprimer ${row.chef.nom_complet} : ${row.dossiers} inscription(s) et ${formatMontant(row.totalEncaisse)} lui sont liés.`,
                { title: "Suppression impossible" }
            );
            return;
        }
        if (!confirm(`Supprimer définitivement le président ${row.chef.nom_complet} (${row.chef.zone}) ?`)) return;
        setDeletingId(row.chef.id);
        try {
            const { error } = await supabase.from("chefs_quartier").delete().eq("id", row.chef.id);
            if (error) throw error;
            await refresh();
            notify.success("Président supprimé.", { title: "Suppression réussie" });
        } catch (err) {
            console.error("Erreur suppression président:", err);
            notify.error(err.message || "Erreur lors de la suppression", { title: "Suppression impossible" });
        } finally {
            setDeletingId(null);
        }
    };

    const copyLink = async (lienUnique) => {
        const url = `${window.location.origin}/president/${lienUnique}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            notify.success("Lien copié dans le presse-papiers.", { title: "Lien copié" });
            setTimeout(() => setCopied(false), 2000);
        } catch {
            notify.warning(url, { title: "Copiez ce lien manuellement" });
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-main dark:text-white">
                        Présidents de section
                    </h1>
                    <p className="text-text-secondary dark:text-gray-400 text-sm md:text-base mt-1">
                        {(chefsQuartier || []).length} président(s) enregistré(s)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => refresh()} disabled={loading} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                    <Button onClick={openModal} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nouveau président
                    </Button>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par nom ou section..."
                    className="pl-10"
                />
            </div>

            <Card className="overflow-hidden">
                {loading && !rows.length ? (
                    <div className="p-8 text-center">
                        <div className="h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                ) : rows.length === 0 ? (
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
                                    <th className="p-4 font-semibold text-text-main dark:text-white">Section</th>
                                    <th className="p-4 font-semibold text-text-main dark:text-white">Contact</th>
                                    <th className="p-4 font-semibold text-text-main dark:text-white text-center">Dossiers</th>
                                    <th className="p-4 font-semibold text-text-main dark:text-white text-center">Encaissé</th>
                                    <th className="p-4 font-semibold text-text-main dark:text-white text-center">Lien</th>
                                    <th className="p-4 font-semibold text-text-main dark:text-white text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                {rows.map((row) => (
                                    <tr key={row.chef.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                        <td className="p-4">
                                            <p className="font-medium text-text-main dark:text-white">{row.chef.nom_complet}</p>
                                            {row.chef.ecole && (
                                                <p className="text-xs text-text-secondary">{row.chef.ecole}</p>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="secondary">{row.chef.zone || "—"}</Badge>
                                        </td>
                                        <td className="p-4 text-text-secondary text-xs">
                                            {row.chef.telephone || "—"}
                                            {row.chef.email && <span className="block">{row.chef.email}</span>}
                                        </td>
                                        <td className="p-4 text-center font-medium">{row.dossiers}</td>
                                        <td className="p-4 text-center font-bold text-emerald-600">
                                            {formatMontant(row.totalEncaisse)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => copyLink(row.chef.lien_unique)}
                                                className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-800 font-mono text-xs"
                                                title="Copier le lien d'accès"
                                            >
                                                <LinkIcon className="h-3.5 w-3.5" />
                                                {row.chef.lien_unique}
                                            </button>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigate("/manager/presidents/" + row.chef.id)}
                                                title="Voir les stats et l'évolution"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                disabled={!row.deletable || deletingId === row.chef.id}
                                                onClick={() => handleDelete(row)}
                                                title={
                                                    row.deletable
                                                        ? "Supprimer ce président"
                                                        : "Suppression impossible : des inscriptions ou paiements sont liés"
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-text-main dark:text-white">
                                Nouveau président de section
                            </h3>
                            <button onClick={() => setModalOpen(false)} className="text-text-secondary hover:text-text-main">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {!createdPresident ? (
                            <>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="p-nom">Nom complet *</Label>
                                        <Input
                                            id="p-nom"
                                            value={form.nom_complet}
                                            onChange={(e) => setForm({ ...form, nom_complet: e.target.value })}
                                            placeholder="Ex : Aboubakar TRAORÉ"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="p-zone">Section (zone) *</Label>
                                        <Input
                                            id="p-zone"
                                            value={form.zone}
                                            onChange={(e) => setForm({ ...form, zone: e.target.value })}
                                            placeholder="Ex : Gonzague"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="p-tel">Téléphone</Label>
                                            <Input
                                                id="p-tel"
                                                value={form.telephone}
                                                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                                                placeholder="Ex : 0707010101"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="p-email">Email</Label>
                                            <Input
                                                id="p-email"
                                                type="email"
                                                value={form.email}
                                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                                placeholder="Ex : president@sefimap.ci"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="p-ecole">École / Structure</Label>
                                        <Input
                                            id="p-ecole"
                                            value={form.ecole}
                                            onChange={(e) => setForm({ ...form, ecole: e.target.value })}
                                            placeholder="Ex : École Saint Exupéry"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)} disabled={saving}>
                                        Annuler
                                    </Button>
                                    <Button className="flex-1" onClick={handleCreate} disabled={saving}>
                                        {saving ? "Création..." : "Créer et générer le lien"}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center">
                                    <Check className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                                    <p className="font-bold text-emerald-800 dark:text-emerald-300">
                                        {createdPresident.nom_complet} — {createdPresident.zone}
                                    </p>
                                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                                        Lien d'accès généré :
                                    </p>
                                    <p className="font-mono font-bold text-lg mt-1 break-all">
                                        {window.location.origin}/president/{createdPresident.lien_unique}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="flex-1 gap-2"
                                        onClick={() => copyLink(createdPresident.lien_unique)}
                                    >
                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        {copied ? "Copié !" : "Copier le lien"}
                                    </Button>
                                    <Button className="flex-1" onClick={() => setModalOpen(false)}>
                                        Terminer
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}
