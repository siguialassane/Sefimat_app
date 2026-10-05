import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Wallet, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notify } from "@/components/ui/toast";
import { useData } from "@/contexts";
import { useAuth } from "@/contexts/AuthContext";
import { getUserLabel } from "@/config/users.config";
import {
    getFinanceBadgeClasses,
    getPostReceptionDossierUpdate,
    getVersementStatusMeta,
    isVersementPending,
    isVersementRefused,
} from "@/lib/finance";
import { PaymentFilters } from "./components/PaymentFilters";

// Caisse finance : réception des versements président (dehors -> dedans).
// - "En attente" : déclaré par le président, pas encore reçu (argent DEHORS).
// - "Reçu" : coché par la finance, avec date/heure + acteur (argent DEDANS).
// - "Refusé" : écart constaté, annulé avec motif (ni dedans ni dehors ;
//   le reste à collecter augmente d'autant, le président ré-encaisse).
export default function Caisse() {
    const { paiements, inscriptions, chefsQuartier, stats, refresh, updatePaiementLocal, updateInscriptionLocal } = useData();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [filterChef, setFilterChef] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    const formatMontant = (montant) => {
        return `${new Intl.NumberFormat("fr-FR").format(montant || 0)} FCFA`;
    };

    const formatDateHeure = (iso) => {
        if (!iso) return "—";
        const d = new Date(iso);
        return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    };

    const inscriptionById = useMemo(() => {
        const map = new Map();
        for (const i of inscriptions || []) map.set(i.id, i);
        return map;
    }, [inscriptions]);

    const chefById = useMemo(() => {
        const map = new Map();
        for (const c of chefsQuartier || []) map.set(c.id, c);
        return map;
    }, [chefsQuartier]);

    const versementMatches = (v) => {
        const inscription = v.inscription || inscriptionById.get(v.inscription_id);
        if (filterChef) {
            if (filterChef === "presentiel") {
                if (inscription?.chef_quartier_id) return false;
            } else if (inscription?.chef_quartier_id !== filterChef) {
                return false;
            }
        }
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            const chef = chefById.get(inscription?.chef_quartier_id);
            const hay = [
                inscription?.nom, inscription?.prenom, inscription?.reference_id,
                inscription?.telephone, chef?.nom_complet,
            ].filter(Boolean).join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    };

    const versementsAttente = useMemo(() => {
        return (paiements || [])
            .filter((v) => isVersementPending(v) && versementMatches(v))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paiements, inscriptions, chefsQuartier, searchTerm, filterChef]);

    const versementsRefuses = useMemo(() => {
        return (paiements || [])
            .filter((v) => isVersementRefused(v) && versementMatches(v))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paiements, inscriptions, chefsQuartier, searchTerm, filterChef]);

    const montantRefuse = useMemo(() => {
        return versementsRefuses.reduce((acc, v) => acc + (v.montant || 0), 0);
    }, [versementsRefuses]);

    const handleReceive = async (versement) => {
        setActionLoading(true);
        try {
            const payload = {
                statut: "validé",
                date_reception: new Date().toISOString(),
                recu_par: user?.id || null,
                motif_refus: null,
            };
            const { error } = await supabase
                .from("paiements")
                .update(payload)
                .eq("id", versement.id)
                .or("statut.eq.attente,statut.is.null");
            if (error) throw error;
            updatePaiementLocal(versement.id, payload);
            // Scénario 1 : si cette réception solde le dossier, il part
            // automatiquement au secrétariat (plus besoin de le valider).
            const dossier = inscriptionById.get(versement.inscription_id);
            const transition = dossier
                ? getPostReceptionDossierUpdate(dossier, versement.montant, user?.id, payload.date_reception)
                : null;
            if (transition) {
                const { error: dossierError } = await supabase
                    .from("inscriptions")
                    .update(transition.update)
                    .eq("id", dossier.id);
                if (dossierError) throw dossierError;
                updateInscriptionLocal(dossier.id, transition.update);
            }
            await refresh();
            notify.success(`${formatMontant(versement.montant)} réceptionné en caisse.`, {
                title: "Versement reçu",
            });
            if (transition?.autoAdvanced) {
                notify.info(`Dossier de ${dossier.nom} ${dossier.prenom} soldé — envoyé au secrétariat.`, {
                    title: "Dossier soldé",
                });
            } else if (transition) {
                notify.info(`Dossier de ${dossier.nom} ${dossier.prenom} soldé.`, {
                    title: "Dossier soldé",
                });
            }
        } catch (err) {
            console.error("Erreur réception versement:", err);
            notify.error("Réception impossible (déjà traité ?).", { title: "Erreur" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRefuse = async (versement) => {
        const motif = window.prompt("Motif du refus (visible par le président) :");
        if (motif === null) return;
        if (!motif.trim()) {
            notify.warning("Le motif est obligatoire pour refuser un versement.", {
                title: "Motif manquant",
            });
            return;
        }
        setActionLoading(true);
        try {
            const payload = {
                statut: "refuse",
                motif_refus: motif.trim(),
                recu_par: user?.id || null,
            };
            const { error } = await supabase
                .from("paiements")
                .update(payload)
                .eq("id", versement.id)
                .or("statut.eq.attente,statut.is.null");
            if (error) throw error;
            updatePaiementLocal(versement.id, payload);
            await refresh();
            notify.success("Versement refusé : le reste à collecter augmente d'autant.", {
                title: "Versement refusé",
            });
        } catch (err) {
            console.error("Erreur refus versement:", err);
            notify.error("Refus impossible (déjà traité ?).", { title: "Erreur" });
        } finally {
            setActionLoading(false);
        }
    };

    const renderParticipant = (versement) => {
        const inscription = versement.inscription || inscriptionById.get(versement.inscription_id) || {};
        const chef = chefById.get(inscription.chef_quartier_id);
        return (
            <div>
                <p className="font-medium text-text-main dark:text-white">
                    {inscription.nom || "—"} {inscription.prenom || ""}
                </p>
                <p className="text-xs text-text-secondary">
                    {inscription.reference_id || ""} · {chef ? chef.nom_complet : "Guichet"}
                </p>
            </div>
        );
    };

    const renderCollecteur = (versement) => {
        const inscription = versement.inscription || inscriptionById.get(versement.inscription_id) || {};
        if (versement.cree_par) return getUserLabel(versement.cree_par);
        const chef = chefById.get(inscription.chef_quartier_id);
        if (chef) return chef.nom_complet;
        return "—";
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                        Caisse
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Réception des versements : cocher ce qui est vraiment rentré
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                    <ArrowUpFromLine className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Dehors (en attente)</p>
                                    <p className="text-xl font-bold text-amber-600">
                                        {formatMontant(stats.montantDehors)}
                                    </p>
                                    <p className="text-xs text-text-secondary">
                                        {stats.versementsEnAttente} versement(s)
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                    <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Dedans (reçu)</p>
                                    <p className="text-xl font-bold text-emerald-600">
                                        {formatMontant(stats.montantDedans)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                                    <Wallet className="h-5 w-5 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Refusés (à ré-encaisser)</p>
                                    <p className="text-xl font-bold text-red-500">
                                        {formatMontant(montantRefuse)}
                                    </p>
                                    <p className="text-xs text-text-secondary">
                                        {versementsRefuses.length} versement(s)
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <PaymentFilters
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        filterChef={filterChef}
                        onChefChange={setFilterChef}
                        chefsQuartier={chefsQuartier}
                    />

                    <Card className="overflow-hidden">
                        <div className="px-4 pt-4">
                            <h2 className="font-semibold text-text-main dark:text-white">
                                En attente de réception ({versementsAttente.length})
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                    <tr>
                                        <th className="p-4 font-semibold text-text-main dark:text-white">Collecté le</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white">Participant</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white">Collecté par</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Montant</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Mode</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                    {versementsAttente.map((v) => (
                                        <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                            <td className="p-4 whitespace-nowrap text-text-secondary">
                                                {formatDateHeure(v.created_at)}
                                            </td>
                                            <td className="p-4">{renderParticipant(v)}</td>
                                            <td className="p-4 text-text-secondary">{renderCollecteur(v)}</td>
                                            <td className="p-4 text-center font-bold text-amber-600">
                                                {formatMontant(v.montant)}
                                            </td>
                                            <td className="p-4 text-center text-text-secondary">
                                                {v.mode_paiement || "—"}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700"
                                                        onClick={() => handleReceive(v)}
                                                        disabled={actionLoading}
                                                        title="Confirmer la réception en caisse"
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                        Reçu
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleRefuse(v)}
                                                        disabled={actionLoading}
                                                        title="Refuser (écart) avec motif"
                                                    >
                                                        <XCircle className="h-4 w-4 mr-1" />
                                                        Refuser
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {versementsAttente.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <CheckCircle className="h-12 w-12 text-emerald-500 mb-3" />
                                    <p className="text-text-main dark:text-white font-medium">Caisse à jour</p>
                                    <p className="text-sm text-text-secondary">Aucun versement en attente.</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {versementsRefuses.length > 0 && (
                        <Card className="overflow-hidden">
                            <div className="px-4 pt-4">
                                <h2 className="font-semibold text-text-main dark:text-white">
                                    Versements refusés ({versementsRefuses.length})
                                </h2>
                                <p className="text-xs text-text-secondary">
                                    Annulés : le reste à collecter a augmenté d'autant.
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                        <tr>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">Collecté le</th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">Participant</th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">Montant</th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">Motif</th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white text-center">Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                        {versementsRefuses.map((v) => {
                                            const meta = getVersementStatusMeta(v);
                                            return (
                                                <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                                    <td className="p-4 whitespace-nowrap text-text-secondary">
                                                        {formatDateHeure(v.created_at)}
                                                    </td>
                                                    <td className="p-4">{renderParticipant(v)}</td>
                                                    <td className="p-4 text-center font-bold text-red-500">
                                                        {formatMontant(v.montant)}
                                                    </td>
                                                    <td className="p-4 text-text-secondary">
                                                        {v.motif_refus || "—"}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <Badge className={getFinanceBadgeClasses(meta.variant)}>
                                                            {meta.label}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
