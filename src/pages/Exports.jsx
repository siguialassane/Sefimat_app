import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Database,
    Filter,
    FileText,
    FileSpreadsheet,
    CheckCircle,
    Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notify } from "@/components/ui/toast";

export function Exports() {
    const [filters, setFilters] = useState({
        neighborhood: "",
        status: "",
        type: "",
        date: "",
    });
    const [isExporting, setIsExporting] = useState(null);
    const [filteredCount, setFilteredCount] = useState(0);
    const [chefsQuartier, setChefsQuartier] = useState([]);

    const formatType = (type) => {
        if (type === "en_ligne") return "En ligne";
        if (type === "presentielle") return "Présentiel";
        return type || "-";
    };

    const formatStatus = (status) => {
        if (status === "valide") return "Validé";
        if (status === "en_attente") return "En attente";
        if (status === "rejete") return "Rejeté";
        return status || "-";
    };

    const formatDate = (value) => {
        if (!value) return "-";
        return new Date(value).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const applyFiltersToQuery = (query) => {
        let nextQuery = query;

        if (filters.status) {
            nextQuery = nextQuery.eq("statut", filters.status);
        }
        if (filters.type) {
            nextQuery = nextQuery.eq("type_inscription", filters.type);
        }
        if (filters.neighborhood) {
            if (filters.neighborhood === "presentiel") {
                nextQuery = nextQuery.is("chef_quartier_id", null);
            } else {
                nextQuery = nextQuery.eq("chef_quartier_id", filters.neighborhood);
            }
        }
        if (filters.date) {
            const start = `${filters.date}T00:00:00.000Z`;
            const endDate = new Date(`${filters.date}T00:00:00.000Z`);
            endDate.setUTCDate(endDate.getUTCDate() + 1);
            const end = endDate.toISOString();
            nextQuery = nextQuery.gte("created_at", start).lt("created_at", end);
        }

        return nextQuery;
    };

    const downloadTextFile = (content, fileName, mimeType = "text/plain;charset=utf-8") => {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    const exportToCSV = (rows, filtered) => {
        const headers = [
            "Référence",
            "Nom",
            "Prénom",
            "Âge",
            "Sexe",
            "Téléphone",
            "Président de section",
            "Type inscription",
            "Statut",
            "Montant payé",
            "Date inscription",
        ];

        const csvRows = rows.map((item) => [
            item.reference_id || "",
            item.nom || "",
            item.prenom || "",
            item.age || "",
            item.sexe || "",
            item.telephone || "",
            item.chef_quartier?.nom_complet || "Présentiel",
            formatType(item.type_inscription),
            formatStatus(item.statut),
            item.montant_total_paye || 0,
            formatDate(item.created_at),
        ]);

        const escaped = [headers, ...csvRows].map((line) =>
            line
                .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
                .join(";")
        );

        const bom = "\uFEFF";
        const csvContent = `${bom}${escaped.join("\n")}`;
        const fileName = `${filtered ? "export_filtre" : "export_complet"}_${new Date().toISOString().split("T")[0]}.csv`;

        downloadTextFile(csvContent, fileName, "text/csv;charset=utf-8");
    };

    const exportToPDF = (rows, filtered) => {
        const run = async () => {
        const { default: jsPDF } = await import("jspdf");
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;
        let y = 16;

        const truncate = (value, maxChars) => {
            const text = String(value ?? "");
            return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
        };

        const columns = [
            { label: "Réf", key: "reference_id", width: 24, max: 12 },
            { label: "Nom", key: "nom", width: 30, max: 18 },
            { label: "Prénom", key: "prenom", width: 30, max: 18 },
            { label: "Sexe", key: "sexe", width: 12, max: 8 },
            { label: "Téléphone", key: "telephone", width: 28, max: 16 },
            { label: "Type", key: "type_inscription", width: 24, max: 12 },
            { label: "Statut", key: "statut", width: 24, max: 12 },
            { label: "Montant", key: "montant_total_paye", width: 20, max: 10 },
            { label: "Président", key: "chef_quartier", width: 55, max: 32 },
            { label: "Date", key: "created_at", width: 30, max: 16 },
        ];

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`SEFIMAP - ${filtered ? "Export filtré" : "Export complet"}`, margin, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`, margin, y);
        y += 8;

        const drawHeader = () => {
            let x = margin;
            doc.setFillColor(30, 41, 59);
            doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            columns.forEach((col) => {
                doc.text(col.label, x + 1.5, y + 5.2);
                x += col.width;
            });
            y += 8;
        };

        drawHeader();

        rows.forEach((item, index) => {
            if (y > 194) {
                doc.addPage();
                y = 16;
                drawHeader();
            }

            if (index % 2 === 0) {
                doc.setFillColor(245, 247, 250);
                doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
            }

            let x = margin;
            doc.setTextColor(20, 20, 20);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);

            columns.forEach((col) => {
                let value = item[col.key];
                if (col.key === "type_inscription") value = formatType(item.type_inscription);
                if (col.key === "statut") value = formatStatus(item.statut);
                if (col.key === "montant_total_paye") value = `${item.montant_total_paye || 0}`;
                if (col.key === "chef_quartier") value = item.chef_quartier?.nom_complet || "Présentiel";
                if (col.key === "created_at") value = formatDate(item.created_at);

                doc.text(truncate(value, col.max), x + 1.5, y + 4.8);
                x += col.width;
            });

            y += 7;
        });

        const fileName = `${filtered ? "export_filtre" : "export_complet"}_${new Date().toISOString().split("T")[0]}.pdf`;
        doc.save(fileName);
        };

        return run();
    };

    useEffect(() => {
        async function loadChefsQuartier() {
            try {
                const { data, error } = await supabase
                    .from("chefs_quartier")
                    .select("id, nom_complet, zone")
                    .order("nom_complet");

                if (error) throw error;
                setChefsQuartier(data || []);
            } catch (error) {
                console.error("Erreur chargement chefs quartier:", error);
                notify.error("Impossible de charger les quartiers", { title: "Chargement impossible" });
            }
        }

        loadChefsQuartier();
    }, []);

    // Charger le nombre d'inscriptions filtrées
    useEffect(() => {
        async function countFiltered() {
            try {
                let query = supabase.from('inscriptions').select('id', { count: 'exact', head: true });
                query = applyFiltersToQuery(query);

                const { count, error } = await query;
                if (error) throw error;

                setFilteredCount(count || 0);
            } catch (error) {
                console.error('Erreur comptage:', error);
                notify.error("Erreur lors du chargement des résultats filtrés", { title: "Chargement impossible" });
            }
        }

        countFiltered();
    }, [filters]);

    const handleExport = async (format, filtered = false) => {
        const exportKey = `${format}-${filtered ? "filtered" : "full"}`;
        setIsExporting(exportKey);
        try {
            let query = supabase
                .from("inscriptions")
                .select(`
                    id,
                    reference_id,
                    nom,
                    prenom,
                    age,
                    sexe,
                    telephone,
                    type_inscription,
                    statut,
                    montant_total_paye,
                    created_at,
                    chef_quartier:chefs_quartier(nom_complet, zone)
                `)
                .order("created_at", { ascending: false });

            if (filtered) {
                query = applyFiltersToQuery(query);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                notify.warning("Aucune inscription à exporter avec ces critères.", { title: "Export vide" });
                return;
            }

            if (format === "excel") {
                exportToCSV(data, filtered);
            } else if (format === "pdf") {
                await exportToPDF(data, filtered);
            } else {
                throw new Error("Format d'export non supporté");
            }

            notify.success(
                `${data.length} inscription(s) exportée(s) en ${format.toUpperCase()} (${filtered ? "filtré" : "complet"}).`,
                { title: "Export terminé" }
            );
        } catch (error) {
            console.error("Erreur export:", error);
            notify.error(error.message || "Erreur lors de l'export", { title: "Export impossible" });
        } finally {
            setIsExporting(null);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8 md:px-10 lg:px-12">
            {/* Page Header */}
            <header className="flex flex-col gap-2 mb-8">
                <h1 className="text-text-main dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">
                    Exports de Données
                </h1>
                <p className="text-text-secondary dark:text-gray-400 text-base md:text-lg">
                    Téléchargez les listes d'inscription, générez des rapports et analysez les données du
                    séminaire.
                </p>
            </header>

            {/* Card 1: Full Database Export */}
            <Card className="mb-8 overflow-hidden">
                <CardContent className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-col gap-2 max-w-2xl">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Database className="h-6 w-6 text-primary" />
                            </div>
                            <h2 className="text-text-main dark:text-white text-xl font-bold leading-tight">
                                Exporter la base complète
                            </h2>
                        </div>
                        <p className="text-text-secondary dark:text-gray-400 text-sm md:text-base">
                            Téléchargez la liste brute de tous les participants inscrits, tous quartiers, statuts
                            et types d'inscription confondus. Ceci inclut des données sensibles.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => handleExport("pdf", false)}
                            disabled={isExporting !== null}
                        >
                            {isExporting === "pdf-full" ? (
                                <span className="h-4 w-4 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                            ) : (
                                <FileText className="h-5 w-5 text-red-600" />
                            )}
                            Télécharger PDF
                        </Button>
                        <Button
                            className="gap-2"
                            onClick={() => handleExport("excel", false)}
                            disabled={isExporting !== null}
                        >
                            {isExporting === "excel-full" ? (
                                <span className="h-4 w-4 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                            ) : (
                                <FileSpreadsheet className="h-5 w-5" />
                            )}
                            Télécharger Excel
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Card 2: Filtered Export */}
            <Card>
                <CardHeader className="px-6 pt-6 pb-4 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Filter className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Exporter avec filtres</CardTitle>
                            <CardDescription className="mt-1">
                                Configurez des critères spécifiques pour générer un rapport ciblé.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-8">
                    {/* Filters Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Filter 1: Neighborhood */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                Quartier
                            </Label>
                            <Select
                                value={filters.neighborhood}
                                onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })}
                            >
                                <option value="">Tous les quartiers</option>
                                <option value="presentiel">Présentiel (sans quartier)</option>
                                {chefsQuartier.map((chef) => (
                                    <option key={chef.id} value={chef.id}>
                                        {chef.nom_complet} {chef.zone ? `- ${chef.zone}` : ""}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        {/* Filter 2: Status */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                Statut
                            </Label>
                            <Select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            >
                                <option value="">Tous les statuts</option>
                                <option value="valide">Validé</option>
                                <option value="en_attente">En attente</option>
                                <option value="rejete">Rejeté</option>
                            </Select>
                        </div>

                        {/* Filter 3: Type */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                Type
                            </Label>
                            <Select
                                value={filters.type}
                                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            >
                                <option value="">Tous les types</option>
                                <option value="en_ligne">Inscription en ligne</option>
                                <option value="presentielle">Présentiel</option>
                            </Select>
                        </div>

                        {/* Filter 4: Date Range */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                Plage de dates
                            </Label>
                            <Input
                                type="date"
                                value={filters.date}
                                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Result & Actions Footer */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-6 border-t border-border-light dark:border-border-dark">
                        <div className="flex items-center gap-3 bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
                            <CheckCircle className="h-5 w-5 text-green-700 dark:text-green-400" />
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                <span className="font-bold">{filteredCount}</span> inscriptions correspondent aux
                                critères
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <Button
                                variant="outline"
                                className="flex-1 md:flex-initial gap-2"
                                onClick={() => handleExport("pdf", true)}
                                disabled={isExporting !== null}
                            >
                                {isExporting === "pdf-filtered" ? (
                                    <span className="h-4 w-4 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                                ) : (
                                    <FileText className="h-5 w-5 text-red-600" />
                                )}
                                PDF Filtré
                            </Button>
                            <Button
                                className="flex-1 md:flex-initial gap-2"
                                onClick={() => handleExport("excel", true)}
                                disabled={isExporting !== null}
                            >
                                {isExporting === "excel-filtered" ? (
                                    <span className="h-4 w-4 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                                ) : (
                                    <FileSpreadsheet className="h-5 w-5" />
                                )}
                                Excel Filtré
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Export History Section */}
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        Historique des exports
                    </CardTitle>
                    <CardDescription>Vos derniers téléchargements</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="divide-y divide-border-light dark:divide-border-dark">
                        {[
                            {
                                name: "export_complet_20241012.xlsx",
                                type: "Excel",
                                date: "12/10/2024 à 14:32",
                                size: "245 KB",
                            },
                            {
                                name: "inscriptions_validees.pdf",
                                type: "PDF",
                                date: "11/10/2024 à 09:15",
                                size: "1.2 MB",
                            },
                            {
                                name: "rapport_abobo_zone1.xlsx",
                                type: "Excel",
                                date: "10/10/2024 à 16:48",
                                size: "89 KB",
                            },
                        ].map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                            >
                                <div className="flex items-center gap-3">
                                    {file.type === "Excel" ? (
                                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                            <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        </div>
                                    ) : (
                                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                            <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-text-main dark:text-white">
                                            {file.name}
                                        </span>
                                        <span className="text-xs text-text-secondary dark:text-gray-400">
                                            {file.date} • {file.size}
                                        </span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" className="gap-1">
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Télécharger</span>
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
