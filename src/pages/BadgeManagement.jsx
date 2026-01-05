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
    Eye,
    IdCard,
    Users,
    CheckCircle,
    RefreshCw,
    ChevronRight,
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

// Composant Badge - Design avec styles inline (pas de Tailwind pour éviter oklch)
function BadgePreview({ participant, badgeRef }) {
    if (!participant) {
        // Même ratio que le badge réel (A6: 105/148)
        const placeholderWidth = 350;
        const placeholderHeight = Math.round(placeholderWidth / (105 / 148));

        return (
            <div
                style={{
                    width: `${placeholderWidth}px`,
                    height: `${placeholderHeight}px`,
                    backgroundColor: "#f3f4f6",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    color: "#9ca3af",
                }}
            >
                <IdCard style={{ width: "64px", height: "64px", marginBottom: "16px" }} />
                <p style={{ fontSize: "16px", fontWeight: "500" }}>Sélectionnez un participant</p>
                <p style={{ fontSize: "14px", marginTop: "8px" }}>pour prévisualiser son badge</p>
            </div>
        );
    }

    // Dimensions du badge basées exactement sur le ratio A6 (105mm x 148mm)
    // Ratio A6 = 105/148 = 0.7094594...
    // En utilisant une hauteur de 494px: 494 * 0.7095 ≈ 350px
    const badgeWidth = 350;
    const badgeHeight = Math.round(badgeWidth / (105 / 148)); // = 493.33 ≈ 493px

    return (
        <div
            ref={badgeRef}
            style={{
                width: `${badgeWidth}px`,
                height: `${badgeHeight}px`,
                position: "relative",
                backgroundColor: "#ffffff",
                fontFamily: "Arial, sans-serif",
                overflow: "hidden",
                borderRadius: "0px",
            }}
        >
            {/* Image de fond */}
            <img
                src="/images/badge.jpeg"
                alt="Badge background"
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                }}
                crossOrigin="anonymous"
            />

            {/* Photo du participant - décalé à droite et rogné */}
            <div
                style={{
                    position: "absolute",
                    top: "74px",
                    left: "105px",
                    width: "140px",
                    height: "170px",
                    borderRadius: "4px",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "transparent",
                }}
            >
                {participant.photo_url ? (
                    <img
                        src={participant.photo_url}
                        alt={`${participant.nom} ${participant.prenom}`}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: "center 20%",
                        }}
                        crossOrigin="anonymous"
                    />
                ) : (
                    <span
                        style={{
                            fontSize: "42px",
                            fontWeight: "bold",
                            color: "#9ca3af",
                        }}
                    >
                        {participant.nom?.[0]?.toUpperCase()}{participant.prenom?.[0]?.toUpperCase()}
                    </span>
                )}
            </div>

            {/* Zone informations - Format selon format.png */}
            <div
                style={{
                    position: "absolute",
                    bottom: "12px",
                    left: "25px",
                    right: "25px",
                    height: "148px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "12px 16px 8px 16px",
                }}
            >
                {/* Liste des infos */}
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {/* NOM */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "bold", color: "#111827", marginRight: "4px" }}>•</span>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#111827", textTransform: "uppercase", letterSpacing: "1px" }}>
                            NOM :
                        </span>
                        <span style={{ fontSize: "11px", color: "#374151", marginLeft: "4px", flex: 1, borderBottom: "1px dotted #9ca3af", paddingBottom: "1px" }}>
                            {participant.nom || "..."}
                        </span>
                    </div>

                    {/* PRENOM(S) */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "bold", color: "#111827", marginRight: "4px" }}>•</span>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#111827", textTransform: "uppercase", letterSpacing: "1px" }}>
                            PRENOM(S) :
                        </span>
                        <span style={{ fontSize: "11px", color: "#374151", marginLeft: "4px", flex: 1, borderBottom: "1px dotted #9ca3af", paddingBottom: "1px" }}>
                            {participant.prenom || "..."}
                        </span>
                    </div>

                    {/* DORTOIR */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "bold", color: "#111827", marginRight: "4px" }}>•</span>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#111827", textTransform: "uppercase", letterSpacing: "1px" }}>
                            DORTOIR :
                        </span>
                        <span style={{ fontSize: "11px", color: "#374151", marginLeft: "4px", flex: 1, borderBottom: "1px dotted #9ca3af", paddingBottom: "1px" }}>
                            {participant.dortoir_nom || "..."}
                        </span>
                    </div>

                    {/* NUMÉRO URGENT */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: "bold", color: "#111827", marginRight: "4px" }}>•</span>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#111827", textTransform: "uppercase", letterSpacing: "1px" }}>
                            NUMÉRO URGENT :
                        </span>
                        <span style={{ fontSize: "11px", color: "#374151", marginLeft: "4px", flex: 1, borderBottom: "1px dotted #9ca3af", paddingBottom: "1px" }}>
                            {participant.numero_urgence || "..."}
                        </span>
                    </div>
                </div>

                {/* N° TICKET (ID) - en orange, centré */}
                <div style={{ textAlign: "center", marginTop: "8px" }}>
                    <span
                        style={{
                            fontWeight: "bold",
                            color: "#ea580c",
                            fontSize: "13px",
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                        }}
                    >
                        N° TICKET : {participant.reference_id || "SEFI-00"}
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

                // Sélectionner le premier participant par défaut
                if (formatted.length > 0) {
                    setSelectedParticipant(formatted[0]);
                }
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
    const generateBadgePDF = async () => {
        if (!selectedParticipant) {
            alert("Veuillez sélectionner un participant");
            return;
        }

        setGenerating(true);

        try {
            const element = badgeRef.current;
            if (!element) {
                throw new Error("Élément badge non trouvé");
            }

            // Capturer le badge en canvas
            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#ffffff",
                logging: false,
            });

            // Créer le PDF en format A6 (105mm x 148mm)
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: [105, 148],
            });

            // Ajouter l'image au PDF
            const imgData = canvas.toDataURL("image/jpeg", 1.0);
            pdf.addImage(imgData, "JPEG", 0, 0, 105, 148);

            // Télécharger le PDF
            const fileName = `badge_${selectedParticipant.reference_id || selectedParticipant.id}_${selectedParticipant.nom}_${selectedParticipant.prenom}.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error("Erreur génération PDF:", error);
            alert("Erreur lors de la génération du badge: " + error.message);
        } finally {
            setGenerating(false);
        }
    };

    // Générer tous les badges en PDF
    const generateAllBadges = async () => {
        if (filteredParticipants.length === 0) {
            alert("Aucun participant à exporter");
            return;
        }

        setGenerating(true);

        try {
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: [105, 148],
            });

            for (let i = 0; i < filteredParticipants.length; i++) {
                const participant = filteredParticipants[i];
                setSelectedParticipant(participant);

                // Attendre le rendu
                await new Promise((resolve) => setTimeout(resolve, 500));

                const element = badgeRef.current;
                if (!element) continue;

                const canvas = await html2canvas(element, {
                    scale: 3,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: "#ffffff",
                    logging: false,
                });

                const imgData = canvas.toDataURL("image/jpeg", 1.0);

                if (i > 0) {
                    pdf.addPage([105, 148]);
                }

                pdf.addImage(imgData, "JPEG", 0, 0, 105, 148);
            }

            pdf.save(`badges_sefimap_${new Date().toISOString().split("T")[0]}.pdf`);

        } catch (error) {
            console.error("Erreur génération tous badges:", error);
            alert("Erreur lors de la génération des badges");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-6 flex justify-between items-center z-10 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight flex items-center gap-2">
                        <IdCard className="w-6 h-6 text-primary" />
                        Gestion des Badges
                    </h1>
                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                        Sélectionnez un participant pour prévisualiser et télécharger son badge
                    </p>
                </div>
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
            </header>

            {/* Main Content - Split Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Liste des participants */}
                <div className="w-1/2 border-r border-border-light dark:border-border-dark flex flex-col overflow-hidden">
                    {/* Filtres */}
                    <div className="p-4 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                <Input
                                    placeholder="Rechercher par nom, prénom ou ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select
                                value={dortoirFilter}
                                onChange={(e) => setDortoirFilter(e.target.value)}
                                className="w-40"
                            >
                                <option value="">Tous</option>
                                {dortoirs.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.nom}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm text-text-secondary">
                            <span>{filteredParticipants.length} participants validés</span>
                        </div>
                    </div>

                    {/* Liste */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full">
                                <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                                <p className="text-text-secondary">Chargement...</p>
                            </div>
                        ) : filteredParticipants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-text-secondary">
                                <Users className="w-12 h-12 mb-3 opacity-50" />
                                <p>Aucun participant trouvé</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border-light dark:divide-border-dark">
                                {filteredParticipants.map((participant) => (
                                    <div
                                        key={participant.id}
                                        onClick={() => setSelectedParticipant(participant)}
                                        className={`p-4 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-4 ${selectedParticipant?.id === participant.id
                                            ? "bg-primary/5 border-l-4 border-primary"
                                            : ""
                                            }`}
                                    >
                                        {/* Photo */}
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center">
                                            {participant.photo_url ? (
                                                <img
                                                    src={participant.photo_url}
                                                    alt={participant.nom}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-xl font-bold text-gray-400">
                                                    {participant.nom?.[0]?.toUpperCase()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Infos */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-text-main dark:text-white truncate">
                                                    {participant.nom} {participant.prenom}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-mono text-primary font-bold">
                                                    {participant.reference_id || "-"}
                                                </span>
                                                <span className="text-xs text-text-secondary">•</span>
                                                <span className="text-xs text-text-secondary truncate">
                                                    {participant.dortoir_nom}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Indicateur sélection */}
                                        {selectedParticipant?.id === participant.id && (
                                            <ChevronRight className="w-5 h-5 text-primary flex-shrink-0" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Preview du badge */}
                <div className="w-1/2 flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900">
                    {/* Preview Header */}
                    <div className="p-4 border-b border-border-light dark:border-border-dark bg-white dark:bg-surface-dark">
                        <h2 className="font-semibold text-text-main dark:text-white flex items-center gap-2">
                            <Eye className="w-5 h-5 text-primary" />
                            Prévisualisation du Badge
                        </h2>
                        {selectedParticipant && (
                            <p className="text-sm text-text-secondary mt-1">
                                {selectedParticipant.nom} {selectedParticipant.prenom} - {selectedParticipant.reference_id}
                            </p>
                        )}
                    </div>

                    {/* Preview Content */}
                    <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
                        <div className="shadow-2xl rounded-lg overflow-hidden">
                            <BadgePreview
                                participant={selectedParticipant}
                                badgeRef={badgeRef}
                            />
                        </div>
                    </div>

                    {/* Preview Footer - Actions */}
                    <div className="p-4 border-t border-border-light dark:border-border-dark bg-white dark:bg-surface-dark">
                        {selectedParticipant ? (
                            <div className="flex flex-col gap-3">
                                {/* Infos résumé */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-text-secondary">Dortoir:</span>
                                        <span className="ml-2 font-medium text-text-main dark:text-white">
                                            {selectedParticipant.dortoir_nom}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-text-secondary">Niveau:</span>
                                        <span className="ml-2 font-medium text-text-main dark:text-white">
                                            {niveauFormationMap[selectedParticipant.niveau_formation] || "Non défini"}
                                        </span>
                                    </div>
                                </div>

                                {/* Bouton télécharger */}
                                <Button
                                    onClick={generateBadgePDF}
                                    disabled={generating}
                                    className="w-full h-12 text-base gap-2"
                                >
                                    {generating ? (
                                        <>
                                            <RefreshCw className="h-5 w-5 animate-spin" />
                                            Génération en cours...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-5 w-5" />
                                            Télécharger le Badge (PDF A6)
                                        </>
                                    )}
                                </Button>
                            </div>
                        ) : (
                            <p className="text-center text-text-secondary py-4">
                                Sélectionnez un participant dans la liste pour télécharger son badge
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
