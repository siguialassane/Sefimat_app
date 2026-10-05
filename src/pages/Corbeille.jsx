import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Undo2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notify } from "@/components/ui/toast";
import { useAuth, useData } from "@/contexts";
import { getUserLabel } from "@/config/users.config";

// Corbeille secrétariat : dossiers archivés (suppression sans perte sèche),
// restaurables à l'identique (versements + notes + statut + workflow).
export function Corbeille() {
    const { user } = useAuth();
    const { refresh } = useData();
    const [archives, setArchives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const loadArchives = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("inscriptions_archive")
                .select("*")
                .is("restored_at", null)
                .order("deleted_at", { ascending: false });
            if (error) throw error;
            setArchives(data || []);
        } catch (err) {
            console.error("Erreur chargement corbeille:", err);
            notify.error("Chargement impossible", { title: "Corbeille" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Chargement réseau au montage (fetch-then-set).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadArchives();
    }, [loadArchives]);

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
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

    const handleRestore = async (archive) => {
        const snap = archive.snapshot || {};
        if (!confirm(`Restaurer le dossier de ${snap.nom || ""} ${snap.prenom || ""} ?`)) return;
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc("restore_inscription", {
                p_archive_id: archive.id,
                p_acteur: user?.id || null,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Restauration impossible");
            notify.success("Dossier restauré à l'identique.", { title: "Restauration réussie" });
            await loadArchives();
            await refresh();
        } catch (err) {
            console.error("Erreur restauration:", err);
            notify.error(err.message || "Erreur lors de la restauration", { title: "Restauration impossible" });
        } finally {
            setActionLoading(false);
        }
    };

    const filtered = archives.filter((a) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const snap = a.snapshot || {};
        return (
            `${snap.nom || ""} ${snap.prenom || ""}`.toLowerCase().includes(term) ||
            snap.reference_id?.toLowerCase().includes(term)
        );
    });

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight flex items-center gap-2">
                        <Trash2 className="h-6 w-6 text-amber-500" />
                        Corbeille
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Dossiers supprimés, conservés avec versements et notes — restaurables à tout moment
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        loadArchives();
                        notify.success("Corbeille actualisée.", { title: "Actualisation réussie" });
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
                    <Card className="p-4">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Rechercher un participant ou une référence..."
                            className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800 text-text-main dark:text-white text-sm"
                        />
                    </Card>

                    <Card className="overflow-hidden">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-text-secondary">Chargement...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Trash2 className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                                <p className="text-text-main dark:text-white text-lg font-medium">
                                    Corbeille vide
                                </p>
                                <p className="text-text-secondary">Aucun dossier archivé pour le moment.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                        <tr>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">Archivé le</th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">Participant</th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">Versements</th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">Notes</th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">Archivé par</th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                        {filtered.map((archive) => {
                                            const snap = archive.snapshot || {};
                                            const versements = Array.isArray(archive.versements) ? archive.versements : [];
                                            const notes = Array.isArray(archive.notes) ? archive.notes : [];
                                            const total = versements.reduce((acc, v) => acc + (v.montant || 0), 0);
                                            return (
                                                <tr key={archive.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                                    <td className="p-4 whitespace-nowrap text-text-secondary">
                                                        {formatDateTime(archive.deleted_at)}
                                                    </td>
                                                    <td className="p-4">
                                                        <p className="font-medium text-text-main dark:text-white">
                                                            {snap.nom} {snap.prenom}
                                                        </p>
                                                        <p className="text-xs font-mono text-primary">
                                                            {snap.reference_id || "—"}
                                                        </p>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <Badge variant="warning">{versements.length}</Badge>
                                                        <span className="block text-xs text-text-secondary mt-1">
                                                            {formatMontant(total)}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <Badge variant="secondary">{notes.length}</Badge>
                                                    </td>
                                                    <td className="p-4 text-text-secondary">
                                                        {archive.deleted_by ? getUserLabel(archive.deleted_by) : "—"}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 hover:bg-emerald-700"
                                                            onClick={() => handleRestore(archive)}
                                                            disabled={actionLoading}
                                                            title="Restaurer le dossier à l'identique"
                                                        >
                                                            <Undo2 className="h-4 w-4 mr-1" />
                                                            Restaurer
                                                        </Button>
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
    );
}
