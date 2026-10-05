import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, Banknote, HandCoins, Hourglass, XCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useData } from "@/contexts";
import { PaymentModal } from "./components";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/components/ui/toast";
import {
    getFinanceBadgeClasses,
    getVersementStatusMeta,
} from "@/lib/finance";
import { getUserLabel } from "@/config/users.config";

export function PaymentList() {
    const {
        inscriptions: allInscriptions,
        paiements,
        chefsQuartier,
        loading,
        refresh,
    } = useData();

    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const [filterChef, setFilterChef] = useState(location.state?.filterChef || "");
    const [filterStatut, setFilterStatut] = useState("tous");
    const [selectedInscription, setSelectedInscription] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);

    const inscriptionById = useMemo(() => {
        const map = new Map();
        for (const inscription of allInscriptions) {
            map.set(inscription.id, inscription);
        }
        return map;
    }, [allInscriptions]);

    const chefById = useMemo(() => {
        const map = new Map();
        for (const chef of chefsQuartier || []) {
            map.set(chef.id, chef);
        }
        return map;
    }, [chefsQuartier]);

    // Traçabilité déclarant : acteur tracé, sinon président de la section.
    const getDeclarantLabel = (versement, inscription) => {
        if (versement.cree_par) return getUserLabel(versement.cree_par);
        const chef = chefById.get(inscription?.chef_quartier_id);
        if (chef) return `${chef.nom_complet} (président)`;
        if (inscription?.chef_quartier_id) return "Président de section";
        return "—";
    };

    const stats = useMemo(() => {
        let declare = 0;
        let recu = 0;
        let attente = 0;
        let refuses = 0;
        for (const paiement of paiements) {
            const montant = paiement.montant || 0;
            if (paiement.statut === "refuse") {
                refuses += 1;
            } else if (paiement.statut === "validé") {
                recu += montant;
                declare += montant;
            } else {
                attente += montant;
                declare += montant;
            }
        }
        return { total: paiements.length, declare, recu, attente, refuses };
    }, [paiements]);

    const filteredVersements = useMemo(() => {
        let filtered = [...paiements];

        if (filterStatut !== "tous") {
            if (filterStatut === "attente") {
                filtered = filtered.filter((p) => p.statut !== "validé" && p.statut !== "refuse");
            } else {
                filtered = filtered.filter((p) => p.statut === filterStatut);
            }
        }

        if (filterChef) {
            filtered = filtered.filter((p) => {
                const inscription = inscriptionById.get(p.inscription_id);
                if (filterChef === "guichet") {
                    return inscription && !inscription.chef_quartier_id;
                }
                return inscription?.chef_quartier_id === filterChef;
            });
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter((p) => {
                const inscription = inscriptionById.get(p.inscription_id);
                const nom = inscription ? `${inscription.nom} ${inscription.prenom}` : "";
                return (
                    nom.toLowerCase().includes(term) ||
                    inscription?.reference_id?.toLowerCase().includes(term)
                );
            });
        }

        return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [paiements, filterStatut, filterChef, searchTerm, inscriptionById]);

    const handleRefresh = useCallback(() => {
        refresh();
        notify.success("Liste des versements actualisée.", { title: "Actualisation réussie" });
    }, [refresh]);

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

    const openDossier = (versement) => {
        const inscription = inscriptionById.get(versement.inscription_id);
        if (!inscription) {
            notify.warning("Dossier introuvable pour ce versement.", { title: "Dossier inconnu" });
            return;
        }
        setSelectedInscription(inscription);
        setModalOpen(true);
    };

    const exportToCSV = () => {
        const headers = ["Date déclaration", "Référence", "Nom", "Prénom", "Origine", "Montant", "Statut", "Déclaré par", "Reçu le", "Reçu par", "Motif refus"];
        const rows = filteredVersements.map((p) => {
            const inscription = inscriptionById.get(p.inscription_id);
            const meta = getVersementStatusMeta(p);
            return [
                p.created_at ? new Date(p.created_at).toLocaleString("fr-FR") : "",
                inscription?.reference_id || "",
                inscription?.nom || "",
                inscription?.prenom || "",
                inscription?.chef_quartier_id ? "Président" : "Guichet",
                p.montant || 0,
                meta.label,
                getDeclarantLabel(p, inscription),
                p.date_reception ? new Date(p.date_reception).toLocaleString("fr-FR") : "",
                p.recu_par ? getUserLabel(p.recu_par) : "",
                p.statut === "refuse" ? (p.motif_refus || "") : "",
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8," +
            [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `versements_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notify.success("Export CSV généré avec succès.", { title: "Export réussi" });
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                        Versements
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Tous les versements déclarés, reçus ou refusés — traçabilité complète
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Actualiser
                    </Button>
                    <Button onClick={exportToCSV} className="gap-2">
                        <Download className="h-4 w-4" />
                        Exporter CSV
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                    <Banknote className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Versements</p>
                                    <p className="text-xl font-bold text-blue-600">{stats.total}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                    <HandCoins className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Reçu (dedans)</p>
                                    <p className="text-xl font-bold text-emerald-600">{formatMontant(stats.recu)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                    <Hourglass className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">En attente (dehors)</p>
                                    <p className="text-xl font-bold text-amber-600">{formatMontant(stats.attente)}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                                    <XCircle className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Versements refusés</p>
                                    <p className="text-xl font-bold text-red-600">{stats.refuses}</p>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Banknote className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-text-secondary">Total déclaré</p>
                                    <p className="text-xl font-bold text-primary">{formatMontant(stats.declare)}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <Card className="p-4">
                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Rechercher un participant ou une référence..."
                                className="flex-1 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800 text-text-main dark:text-white text-sm"
                            />
                            <select
                                value={filterStatut}
                                onChange={(e) => setFilterStatut(e.target.value)}
                                className="px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800 text-text-main dark:text-white text-sm"
                            >
                                <option value="tous">Tous les statuts</option>
                                <option value="attente">En attente</option>
                                <option value="validé">Reçus</option>
                                <option value="refuse">Refusés</option>
                            </select>
                            <select
                                value={filterChef}
                                onChange={(e) => setFilterChef(e.target.value)}
                                className="px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800 text-text-main dark:text-white text-sm"
                            >
                                <option value="">Toutes les origines</option>
                                <option value="guichet">Guichet</option>
                                {chefsQuartier.map((chef) => (
                                    <option key={chef.id} value={chef.id}>
                                        {chef.nom_complet}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                    <tr>
                                        <th className="p-4 font-semibold text-text-main dark:text-white">Déclaré le</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white">Participant</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white">Origine</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-right">Montant</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-center">Statut</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white">Déclaré par</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white">Réception</th>
                                        <th className="p-4 font-semibold text-text-main dark:text-white text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                    {filteredVersements.map((versement) => {
                                        const inscription = inscriptionById.get(versement.inscription_id);
                                        const meta = getVersementStatusMeta(versement);
                                        return (
                                            <tr key={versement.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                                <td className="p-4 whitespace-nowrap text-text-secondary">
                                                    {formatDateTime(versement.created_at)}
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-medium text-text-main dark:text-white">
                                                        {inscription ? `${inscription.nom} ${inscription.prenom}` : "Dossier inconnu"}
                                                    </p>
                                                    <p className="text-xs font-mono text-primary">
                                                        {inscription?.reference_id || "—"}
                                                    </p>
                                                </td>
                                                <td className="p-4">
                                                    {inscription?.chef_quartier_id ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                                                            Président
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                                            Guichet
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right font-bold text-text-main dark:text-white">
                                                    {formatMontant(versement.montant)}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Badge className={getFinanceBadgeClasses(meta.variant)}>{meta.label}</Badge>
                                                    {versement.statut === "refuse" && versement.motif_refus && (
                                                        <p className="text-xs text-red-600 mt-1">{versement.motif_refus}</p>
                                                    )}
                                                </td>
                                                <td className="p-4 text-text-secondary">
                                                    {getDeclarantLabel(versement, inscription)}
                                                </td>
                                                <td className="p-4 text-text-secondary text-xs">
                                                    {versement.statut === "validé" ? (
                                                        <>
                                                            <p>{formatDateTime(versement.date_reception)}</p>
                                                            <p>{versement.recu_par ? getUserLabel(versement.recu_par) : "—"}</p>
                                                        </>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openDossier(versement)}
                                                    >
                                                        Dossier
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredVersements.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-text-secondary">
                                                Aucun versement ne correspond à vos critères.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-surface-light dark:bg-surface-dark px-4 py-3 flex items-center justify-between border-t border-border-light dark:border-border-dark">
                            <p className="text-sm text-text-secondary">
                                <span className="font-medium text-text-main dark:text-white">
                                    {filteredVersements.length}
                                </span>{" "}
                                versements affichés
                            </p>
                        </div>
                    </Card>
                </div>
            </div>

            {modalOpen && selectedInscription && (
                <PaymentModal
                    inscription={selectedInscription}
                    paiements={paiements}
                    onClose={() => {
                        setModalOpen(false);
                        setSelectedInscription(null);
                    }}
                    showActions={false}
                />
            )}
        </div>
    );
}
