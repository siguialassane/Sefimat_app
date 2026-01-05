import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Search,
    Download,
    Printer,
    Eye,
    X,
    IdCard,
    Users,
    CheckCircle,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Mapping niveau formation
const niveauFormationMap = {
    debutant: "Débutant",
    normal: "Normal",
    superieur: "Supérieur"
};

// Composant Badge - Reproduit le design du badge.jpeg
function BadgePreview({ participant, badgeRef }) {
    return (
        <div
            ref={badgeRef}
            className="relative bg-white"
            style={{
                width: "350px",
                height: "495px", // Ratio A6 portrait
                fontFamily: "Arial, sans-serif",
            }}
        >
            {/* Image de fond */}
            <img
                src="/images/badge.jpeg"
                alt="Badge background"
                className="absolute inset-0 w-full h-full object-cover"
                crossOrigin="anonymous"
            />

            {/* Photo du participant - positionnée sur le cadre blanc */}
            <div
                className="absolute flex items-center justify-center overflow-hidden"
                style={{
                    top: "105px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "165px",
                    height: "165px",
                    borderRadius: "8px",
                }}
            >
                {participant.photo_url ? (
                    <img
                        src={participant.photo_url}
                        alt={`${participant.nom} ${participant.prenom}`}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-4xl font-bold text-gray-400">
                            {participant.nom?.[0]?.toUpperCase()}{participant.prenom?.[0]?.toUpperCase()}
                        </span>
                    </div>
                )}
            </div>

            {/* Zone informations - positionnée sur le cadre blanc du bas */}
            <div
                className="absolute flex flex-col items-center justify-center px-4"
                style={{
                    bottom: "15px",
                    left: "22px",
                    right: "22px",
                    height: "145px",
                }}
            >
                {/* ID */}
                <div className="text-center mb-1">
                    <span
                        className="font-bold text-green-700"
                        style={{ fontSize: "16px" }}
                    >
                        {participant.reference_id || "SEFI-00"}
                    </span>
                </div>

                {/* Nom */}
                <div className="text-center">
                    <span
                        className="font-bold text-gray-900 uppercase"
                        style={{ fontSize: "20px", letterSpacing: "1px" }}
                    >
                        {participant.nom || "NOM"}
                    </span>
                </div>

                {/* Prénom */}
                <div className="text-center">
                    <span
                        className="font-semibold text-gray-700"
                        style={{ fontSize: "16px" }}
                    >
                        {participant.prenom || "Prénom"}
                    </span>
                </div>

                {/* Dortoir */}
                <div className="text-center mt-2 px-4 py-1 bg-green-600 rounded-full">
                    <span
                        className="font-bold text-white"
                        style={{ fontSize: "12px" }}
                    >
                        {participant.dortoir_nom || "Non assigné"}
                    </span>
                </div>

                {/* Niveau de formation */}
                <div className="text-center mt-1">
                    <span
                        className="text-gray-600"
                        style={{ fontSize: "11px" }}
                    >
                        Niveau: {niveauFormationMap[participant.niveau_formation] || "Non défini"}
                    </span>
                </div>
            </div>
        </div>
    );
}

export function BadgeManagement() {
    const { user } = useAuth();
    const [participants, setParticipants] = useState([]);
    const [filteredParticipants, setFilteredParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [dortoirFilter, setDortoirFilter] = useState("");
    const [dortoirs, setDortoirs] = useState([]);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [generating, setGenerating] = useState(false);
    const badgeRef = useRef(null);

    // Charger les participants validés
    useEffect(() => {
        async function loadParticipants() {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from("inscriptions")
                    .select(`
                        *,
                        dortoir:dortoirs(id, nom)
                    `)
                    .eq("statut", "valide")
                    .order("nom");

                if (error) throw error;

                const formatted = data.map((p) => ({
                    ...p,
                    dortoir_nom: p.dortoir?.nom || "Non assigné",
                }));

                setParticipants(formatted);
                setFilteredParticipants(formatted);
            } catch (error) {
                console.error("Erreur chargement participants:", error);
            } finally {
                setLoading(false);
            }
        }

        loadParticipants();
    }, []);

    // Charger les dortoirs pour le filtre
    useEffect(() => {
        async function loadDortoirs() {
            const { data, error } = await supabase
                .from("dortoirs")
                .select("*")
                .order("nom");

            if (!error) {
                setDortoirs(data || []);
            }
        }
        loadDortoirs();
    }, []);

    // Filtrer les participants
    useEffect(() => {
        let filtered = participants;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (p) =>
                    p.nom?.toLowerCase().includes(term) ||
                    p.prenom?.toLowerCase().includes(term) ||
                    p.reference_id?.toLowerCase().includes(term)
            );
        }

        if (dortoirFilter) {
            filtered = filtered.filter((p) => p.dortoir_id === dortoirFilter);
        }

        setFilteredParticipants(filtered);
    }, [searchTerm, dortoirFilter, participants]);

    // Générer et télécharger le badge en PDF
    const generateBadgePDF = async (participant) => {
        setSelectedParticipant(participant);
        setShowPreview(true);
        setGenerating(true);

        // Attendre que le composant soit rendu
        setTimeout(async () => {
            try {
                const element = badgeRef.current;
                if (!element) {
                    throw new Error("Élément badge non trouvé");
                }

                // Capturer le badge en canvas
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: "#ffffff",
                });

                // Créer le PDF en format A6 (105mm x 148mm)
                const pdf = new jsPDF({
                    orientation: "portrait",
                    unit: "mm",
                    format: [105, 148], // A6
                });

                // Ajouter l'image au PDF
                const imgData = canvas.toDataURL("image/jpeg", 1.0);
                pdf.addImage(imgData, "JPEG", 0, 0, 105, 148);

                // Télécharger le PDF
                const fileName = `badge_${participant.reference_id || participant.id}_${participant.nom}_${participant.prenom}.pdf`;
                pdf.save(fileName);

            } catch (error) {
                console.error("Erreur génération PDF:", error);
                alert("Erreur lors de la génération du badge: " + error.message);
            } finally {
                setGenerating(false);
            }
        }, 500);
    };

    // Générer tous les badges en PDF
    const generateAllBadges = async () => {
        if (filteredParticipants.length === 0) {
            alert("Aucun participant à exporter");
            return;
        }

        setGenerating(true);

        try {
            // Créer un PDF avec plusieurs pages (une par badge)
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: [105, 148], // A6
            });

            for (let i = 0; i < filteredParticipants.length; i++) {
                const participant = filteredParticipants[i];
                setSelectedParticipant(participant);

                // Attendre le rendu
                await new Promise((resolve) => setTimeout(resolve, 300));

                const element = badgeRef.current;
                if (!element) continue;

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: "#ffffff",
                });

                const imgData = canvas.toDataURL("image/jpeg", 1.0);

                if (i > 0) {
                    pdf.addPage([105, 148]);
                }

                pdf.addImage(imgData, "JPEG", 0, 0, 105, 148);
            }

            // Télécharger le PDF
            pdf.save(`badges_sefimap_${new Date().toISOString().split("T")[0]}.pdf`);

        } catch (error) {
            console.error("Erreur génération tous badges:", error);
            alert("Erreur lors de la génération des badges");
        } finally {
            setGenerating(false);
            setSelectedParticipant(null);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex justify-between items-center z-10 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight flex items-center gap-2">
                        <IdCard className="w-6 h-6 text-primary" />
                        Gestion des Badges
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Générez et téléchargez les badges des participants validés
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={generateAllBadges}
                        disabled={generating || filteredParticipants.length === 0}
                        className="gap-2"
                    >
                        {generating ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        Exporter tous ({filteredParticipants.length})
                    </Button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    {/* Filtres */}
                    <Card className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <Label className="mb-1.5 block text-xs">Recherche</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                    <Input
                                        placeholder="Nom, prénom ou ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-xs">Dortoir</Label>
                                <Select
                                    value={dortoirFilter}
                                    onChange={(e) => setDortoirFilter(e.target.value)}
                                >
                                    <option value="">Tous les dortoirs</option>
                                    {dortoirs.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.nom}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </Card>

                    {/* Stats rapides */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="p-4 flex items-center gap-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Total validés</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {participants.length}
                                </p>
                            </div>
                        </Card>
                        <Card className="p-4 flex items-center gap-4">
                            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Filtrés</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {filteredParticipants.length}
                                </p>
                            </div>
                        </Card>
                        <Card className="p-4 flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg">
                                <IdCard className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Badges à générer</p>
                                <p className="text-2xl font-bold text-primary">
                                    {filteredParticipants.length}
                                </p>
                            </div>
                        </Card>
                    </div>

                    {/* Liste des participants */}
                    <Card className="overflow-hidden">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-text-secondary dark:text-gray-400">
                                    Chargement des participants...
                                </p>
                            </div>
                        ) : filteredParticipants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <IdCard className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                                <p className="text-text-secondary dark:text-gray-400 text-lg mb-2">
                                    Aucun participant trouvé
                                </p>
                                <p className="text-text-secondary dark:text-gray-500 text-sm">
                                    Seuls les participants validés apparaissent ici
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
                                        <tr>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                                ID
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                                Photo
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                                Nom & Prénom
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                                Dortoir
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white">
                                                Niveau
                                            </th>
                                            <th className="p-4 font-semibold text-text-main dark:text-white text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                        {filteredParticipants.map((participant) => (
                                            <tr
                                                key={participant.id}
                                                className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <td className="p-4 font-mono text-sm font-semibold text-primary">
                                                    {participant.reference_id || "-"}
                                                </td>
                                                <td className="p-4">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                        {participant.photo_url ? (
                                                            <img
                                                                src={participant.photo_url}
                                                                alt={participant.nom}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-lg text-gray-400">
                                                                {participant.nom?.[0]?.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div>
                                                        <p className="font-medium text-text-main dark:text-white">
                                                            {participant.nom}
                                                        </p>
                                                        <p className="text-text-secondary dark:text-gray-400 text-sm">
                                                            {participant.prenom}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <Badge variant={participant.dortoir_id ? "success" : "warning"}>
                                                        {participant.dortoir_nom}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 text-text-secondary dark:text-gray-400">
                                                    {niveauFormationMap[participant.niveau_formation] || "-"}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedParticipant(participant);
                                                                setShowPreview(true);
                                                            }}
                                                            className="gap-1"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            Voir
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => generateBadgePDF(participant)}
                                                            disabled={generating}
                                                            className="gap-1"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                            PDF
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
                </div>
            </div>

            {/* Modal Prévisualisation */}
            {showPreview && selectedParticipant && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                            <h3 className="font-bold text-text-main dark:text-white">
                                Prévisualisation du Badge
                            </h3>
                            <button
                                onClick={() => {
                                    setShowPreview(false);
                                    setSelectedParticipant(null);
                                }}
                                className="text-text-secondary hover:text-text-main dark:hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 flex flex-col items-center">
                            {/* Badge Preview */}
                            <div className="shadow-2xl rounded-lg overflow-hidden">
                                <BadgePreview
                                    participant={selectedParticipant}
                                    badgeRef={badgeRef}
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowPreview(false);
                                        setSelectedParticipant(null);
                                    }}
                                >
                                    Fermer
                                </Button>
                                <Button
                                    onClick={() => generateBadgePDF(selectedParticipant)}
                                    disabled={generating}
                                    className="gap-2"
                                >
                                    {generating ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="h-4 w-4" />
                                    )}
                                    Télécharger PDF (A6)
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Hidden badge for PDF generation */}
            {selectedParticipant && !showPreview && (
                <div className="fixed -left-[9999px] top-0">
                    <BadgePreview
                        participant={selectedParticipant}
                        badgeRef={badgeRef}
                    />
                </div>
            )}
        </div>
    );
}
