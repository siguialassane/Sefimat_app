import { useState } from "react";
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

export function Exports() {
    const [filters, setFilters] = useState({
        neighborhood: "",
        status: "",
        type: "",
        date: "",
    });
    const [isExporting, setIsExporting] = useState(null);

    // Mock filtered count
    const filteredCount = 142;

    const handleExport = async (format, filtered = false) => {
        const exportKey = `${format}-${filtered ? "filtered" : "full"}`;
        setIsExporting(exportKey);
        try {
            // TODO: Implement actual export logic
            await new Promise((resolve) => setTimeout(resolve, 1500));
            console.log(`Exporting ${filtered ? "filtered" : "full"} data as ${format}`);
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
                                <option value="abobo">Abobo</option>
                                <option value="cocody">Cocody</option>
                                <option value="yopougon">Yopougon</option>
                                <option value="plateau">Plateau</option>
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
                                <option value="validated">Validé</option>
                                <option value="pending">En attente</option>
                                <option value="rejected">Rejeté</option>
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
                                <option value="online">Inscription en ligne</option>
                                <option value="inperson">Présentiel</option>
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
