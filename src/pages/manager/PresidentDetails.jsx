import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Users,
    DollarSign,
    CheckCircle,
    Clock,
    Wallet,
    Hourglass,
    Copy,
    Check,
    ExternalLink,
    Phone,
    Mail,
    School,
} from "lucide-react";
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { useData } from "@/contexts";
import { notify } from "@/components/ui/toast";
import {
    getAbandonedAmount,
    getFinanceStatusMeta,
    getRemainingDue,
    isFinanceApproved,
    isFinanceValidationPending,
    isFullyPaid,
} from "@/lib/finance";

const NB_SEMAINES = 8;

function startOfWeek(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = (date.getDay() + 6) % 7; // lundi = 0
    date.setDate(date.getDate() - day);
    return date;
}

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-900 p-3 shadow-lg text-sm">
            <p className="font-bold text-text-main dark:text-white mb-1">Semaine du {label}</p>
            {payload.map((p) => (
                <p key={p.dataKey} className="text-text-secondary dark:text-gray-300">
                    {p.name} :{" "}
                    <span className="font-bold text-text-main dark:text-white">
                        {p.dataKey === "montant"
                            ? new Intl.NumberFormat("fr-FR").format(p.value) + " FCFA"
                            : p.value}
                    </span>
                </p>
            ))}
        </div>
    );
}

export function PresidentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { inscriptions, paiements, chefsQuartier, loading } = useData();
    const [copied, setCopied] = useState(false);

    const president = useMemo(
        () => (chefsQuartier || []).find((c) => String(c.id) === String(id)),
        [chefsQuartier, id]
    );

    const dossiers = useMemo(
        () => inscriptions.filter((i) => i.chef_quartier_id === id || String(i.chef_quartier_id) === String(id)),
        [inscriptions, id]
    );

    const versements = useMemo(
        () =>
            (paiements || []).filter(
                (p) =>
                    (p.inscription_id && dossiers.some((d) => d.id === p.inscription_id)) ||
                    (p.inscription && String(p.inscription.chef_quartier_id) === String(id))
            ),
        [paiements, dossiers, id]
    );

    const stats = useMemo(() => {
        return {
            dossiers: dossiers.length,
            encaisse: dossiers.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0),
            valides: dossiers.filter(isFinanceApproved).length,
            enAttente: dossiers.filter(isFinanceValidationPending).length,
            soldes: dossiers.filter(isFullyPaid).length,
            nonDu: dossiers.reduce((acc, i) => acc + getAbandonedAmount(i), 0),
            resteDu: dossiers.reduce((acc, i) => acc + getRemainingDue(i), 0),
            pendingFinance: dossiers.filter((i) => i.workflow_status === "pending_finance").length,
            pendingSecretariat: dossiers.filter((i) => i.workflow_status === "pending_secretariat").length,
            completed: dossiers.filter((i) => i.workflow_status === "completed").length,
            rejected: dossiers.filter((i) => i.workflow_status === "rejected").length,
        };
    }, [dossiers]);

    const evolution = useMemo(() => {
        const weeks = [];
        const current = startOfWeek(new Date());
        for (let w = NB_SEMAINES - 1; w >= 0; w--) {
            const start = new Date(current);
            start.setDate(start.getDate() - w * 7);
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            const inWeek = (dateStr) => {
                if (!dateStr) return false;
                const d = new Date(dateStr);
                return d >= start && d < end;
            };
            weeks.push({
                semaine: start.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
                inscriptions: dossiers.filter((i) => inWeek(i.created_at)).length,
                montant: versements
                    .filter((p) => ["validé", "attente"].includes(p.statut) && inWeek(p.date_paiement || p.created_at))
                    .reduce((acc, p) => acc + (p.montant || 0), 0),
            });
        }
        return weeks;
    }, [dossiers, versements]);

    const recents = useMemo(
        () =>
            [...dossiers]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 10),
        [dossiers]
    );

    const formatMontant = (montant) => new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    const fullLink = president ? `${window.location.origin}/president/${president.lien_unique}` : "";

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(fullLink);
            setCopied(true);
            notify.success("Lien copié dans le presse-papiers.", { title: "Lien copié" });
            setTimeout(() => setCopied(false), 2000);
        } catch {
            notify.warning(fullLink, { title: "Copiez ce lien manuellement" });
        }
    };

    if (loading && !president) {
        return (
            <div className="p-8 text-center">
                <div className="h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
        );
    }

    if (!president) {
        return (
            <div className="p-4 md:p-8 max-w-3xl mx-auto text-center flex flex-col gap-4 items-center">
                <Users className="h-12 w-12 text-gray-400" />
                <p className="text-text-secondary">Président introuvable.</p>
                <Button variant="outline" onClick={() => navigate("/manager/presidents")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour à la liste
                </Button>
            </div>
        );
    }

    const kpis = [
        { title: "Dossiers", value: stats.dossiers.toString(), icon: Users, iconBg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600" },
        { title: "Encaissé", value: formatMontant(stats.encaisse), icon: DollarSign, iconBg: "bg-emerald-50 dark:bg-emerald-900/20", iconColor: "text-emerald-600" },
        { title: "Validés finance", value: stats.valides.toString(), icon: CheckCircle, iconBg: "bg-green-50 dark:bg-green-900/20", iconColor: "text-green-600" },
        { title: "En attente", value: stats.enAttente.toString(), icon: Clock, iconBg: "bg-amber-50 dark:bg-amber-900/20", iconColor: "text-amber-600" },
        { title: "Soldés", value: stats.soldes.toString(), icon: Hourglass, iconBg: "bg-indigo-50 dark:bg-indigo-900/20", iconColor: "text-indigo-600" },
        { title: "Reste dû", value: formatMontant(stats.resteDu), icon: Wallet, iconBg: "bg-red-50 dark:bg-red-900/20", iconColor: "text-red-600" },
    ];

    const funnel = [
        { label: "En attente finance", value: stats.pendingFinance, color: "bg-amber-500" },
        { label: "En attente secrétariat", value: stats.pendingSecretariat, color: "bg-orange-500" },
        { label: "Terminés", value: stats.completed, color: "bg-emerald-500" },
        { label: "Rejetés", value: stats.rejected, color: "bg-red-500" },
    ];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
            <Button variant="outline" size="sm" className="w-fit" onClick={() => navigate("/manager/presidents")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tous les présidents
            </Button>

            {/* Identité + lien permanent */}
            <Card className="p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                    <div className="h-16 w-16 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-600 font-black text-2xl shrink-0">
                        {president.nom_complet?.charAt(0) || "P"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-black text-text-main dark:text-white">
                                {president.nom_complet}
                            </h1>
                            <Badge variant="secondary">{president.zone || "Section non précisée"}</Badge>
                            {stats.dossiers > 0 ? (
                                <Badge variant="success">Actif</Badge>
                            ) : (
                                <Badge variant="warning">Nouveau</Badge>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-text-secondary">
                            {president.telephone && (
                                <span className="inline-flex items-center gap-1">
                                    <Phone className="h-3.5 w-3.5" /> {president.telephone}
                                </span>
                            )}
                            {president.email && (
                                <span className="inline-flex items-center gap-1">
                                    <Mail className="h-3.5 w-3.5" /> {president.email}
                                </span>
                            )}
                            {president.ecole && (
                                <span className="inline-flex items-center gap-1">
                                    <School className="h-3.5 w-3.5" /> {president.ecole}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Input readOnly value={fullLink} className="font-mono text-sm" aria-label="Lien d'accès du président" />
                    <div className="flex gap-2 shrink-0">
                        <Button variant="outline" onClick={copyLink} className="gap-2">
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? "Copié !" : "Copier"}
                        </Button>
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => window.open(`/president/${president.lien_unique}/dashboard`, "_blank")}
                        >
                            <ExternalLink className="h-4 w-4" />
                            Ouvrir l'espace
                        </Button>
                    </div>
                </div>
            </Card>

            {/* KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {kpis.map((kpi, index) => (
                    <Card key={index} className="p-4 flex flex-col gap-2">
                        <div className={`p-2 rounded-lg w-fit ${kpi.iconBg}`}>
                            <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                        </div>
                        <div>
                            <p className="text-text-secondary dark:text-gray-400 text-xs font-medium">{kpi.title}</p>
                            <p className="text-lg font-bold text-text-main dark:text-white mt-0.5">{kpi.value}</p>
                        </div>
                    </Card>
                ))}
            </div>
            {stats.nonDu > 0 && (
                <p className="text-sm text-text-secondary -mt-2">
                    Dont {formatMontant(stats.nonDu)} de reliquats non dus (abandonnés à la validation).
                </p>
            )}

            {/* Évolution */}
            <Card className="overflow-hidden">
                <CardHeader className="border-b border-border-light dark:border-border-dark">
                    <CardTitle>Évolution des {NB_SEMAINES} dernières semaines</CardTitle>
                    <CardDescription>Inscriptions et montants encaissés par semaine</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                    <div className="h-72 w-full text-text-secondary">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={evolution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="semaine" tick={{ fill: "currentColor", fontSize: 12 }} />
                                <YAxis
                                    yAxisId="left"
                                    tick={{ fill: "currentColor", fontSize: 12 }}
                                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                                />
                                <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fill: "currentColor", fontSize: 12 }} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="montant" name="Encaissé (FCFA)" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="inscriptions" name="Inscriptions" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Circuit + dossiers récents */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border-light dark:border-border-dark">
                        <CardTitle>Circuit des dossiers</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 flex flex-col gap-4">
                        {funnel.map((step, index) => (
                            <div key={index} className="flex flex-col gap-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-text-secondary">{step.label}</span>
                                    <span className="font-bold text-text-main dark:text-white">{step.value}</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${step.color}`}
                                        style={{
                                            width: `${stats.dossiers > 0 ? Math.round((step.value / stats.dossiers) * 100) : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="overflow-hidden lg:col-span-2">
                    <CardHeader className="border-b border-border-light dark:border-border-dark">
                        <CardTitle>Dossiers récents</CardTitle>
                        <CardDescription>Les 10 dernières inscriptions</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recents.length === 0 ? (
                            <p className="p-6 text-sm text-text-secondary">Aucun dossier pour ce président.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                        <tr>
                                            <th className="p-3 font-semibold text-text-main dark:text-white">Participant</th>
                                            <th className="p-3 font-semibold text-text-main dark:text-white text-center">Payé</th>
                                            <th className="p-3 font-semibold text-text-main dark:text-white text-center">Finance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                        {recents.map((i) => {
                                            const meta = getFinanceStatusMeta(i);
                                            return (
                                                <tr key={i.id}>
                                                    <td className="p-3">
                                                        <p className="font-medium text-text-main dark:text-white">
                                                            {i.nom} {i.prenom}
                                                        </p>
                                                        <p className="text-xs text-text-secondary">
                                                            {i.created_at
                                                                ? new Date(i.created_at).toLocaleDateString("fr-FR")
                                                                : "—"}
                                                        </p>
                                                    </td>
                                                    <td className="p-3 text-center font-bold text-emerald-600">
                                                        {formatMontant(i.montant_total_paye)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <Badge variant={meta.variant}>{meta.label}</Badge>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
