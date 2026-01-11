import { useState, useMemo, useCallback, useRef } from "react";
import { Download, Users, Filter, FileText, User, Eye, X, Phone, MapPin, School, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useData } from "@/contexts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function ListeClasses() {
    const { notesExamens, classes, dortoirs, inscriptions } = useData();

    const [filterNiveau, setFilterNiveau] = useState("all");
    const [filterClasse, setFilterClasse] = useState("all");
    const [exporting, setExporting] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const tableRef = useRef(null);

    // Obtenir les classes filtrées
    const classesFiltrees = useMemo(() => {
        return classes.filter(classe => {
            if (filterNiveau !== 'all' && classe.niveau !== filterNiveau) {
                return false;
            }
            if (filterClasse !== 'all' && String(classe.id) !== filterClasse) {
                return false;
            }
            return true;
        });
    }, [classes, filterNiveau, filterClasse]);

    // Obtenir les participants par classe
    const participantsParClasse = useMemo(() => {
        const result = {};
        classesFiltrees.forEach(classe => {
            result[classe.id] = notesExamens
                .filter(note => note.classe_id === classe.id)
                .map(note => ({
                    ...note,
                    inscription: inscriptions.find(i => i.id === note.inscription_id) || note.inscription
                }))
                .sort((a, b) => {
                    const nomA = a.inscription?.nom || '';
                    const nomB = b.inscription?.nom || '';
                    return nomA.localeCompare(nomB);
                });
        });
        return result;
    }, [classesFiltrees, notesExamens, inscriptions]);

    // Obtenir le nom du dortoir
    const getDortoirNom = useCallback((dortoirId) => {
        const dortoir = dortoirs.find(d => d.id === dortoirId);
        return dortoir?.nom || '-';
    }, [dortoirs]);

    // Convertir une image URL en base64
    const loadImageAsBase64 = useCallback(async (url) => {
        if (!url) return null;
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.warn('Erreur chargement image:', error);
            return null;
        }
    }, []);

    // Couleurs par niveau pour les PDF
    const getNiveauColor = useCallback((niveau) => {
        switch (niveau) {
            case 'niveau_1': return { r: 239, g: 68, b: 68 };     // Rouge
            case 'niveau_2': return { r: 249, g: 115, b: 22 };    // Orange
            case 'niveau_3': return { r: 234, g: 179, b: 8 };     // Jaune
            case 'niveau_superieur': return { r: 34, g: 197, b: 94 }; // Vert
            default: return { r: 59, g: 130, b: 246 };            // Bleu par défaut
        }
    }, []);

    // Exporter une classe en PDF avec photos et couleur par niveau
    const exportClassePDF = useCallback(async (classe) => {
        setExporting(true);
        try {
            const participants = participantsParClasse[classe.id] || [];

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const photoSize = 12; // Taille de la photo en mm
            const rowHeight = photoSize + 4; // Hauteur de chaque ligne avec photo
            
            // Couleur selon le niveau
            const niveauColor = getNiveauColor(classe.niveau);

            // Titre
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`SEFIMAP - Liste ${classe.nom}`, pageWidth / 2, 20, { align: 'center' });

            // Date
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const date = new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            pdf.text(`Généré le ${date}`, pageWidth / 2, 28, { align: 'center' });

            // Info classe
            pdf.setFontSize(12);
            pdf.text(`Effectif: ${participants.length} participant(s)`, 14, 40);

            // En-têtes tableau avec couleur du niveau
            let y = 50;
            pdf.setFillColor(niveauColor.r, niveauColor.g, niveauColor.b);
            pdf.rect(14, y, pageWidth - 28, 10, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text('N°', 18, y + 7);
            pdf.text('Photo', 28, y + 7);
            pdf.text('Nom & Prénom', 46, y + 7);
            pdf.text('Note', 115, y + 7);
            pdf.text('Dortoir', 135, y + 7);
            pdf.text('Sexe', 175, y + 7);

            // Données avec photos
            y += 12;
            pdf.setTextColor(0, 0, 0);
            pdf.setFont('helvetica', 'normal');

            for (let index = 0; index < participants.length; index++) {
                const participant = participants[index];
                
                // Nouvelle page si nécessaire
                if (y > 270) {
                    pdf.addPage();
                    y = 20;
                }

                // Alternance couleur (teinte claire du niveau)
                if (index % 2 === 0) {
                    pdf.setFillColor(
                        Math.min(255, niveauColor.r + 150),
                        Math.min(255, niveauColor.g + 150),
                        Math.min(255, niveauColor.b + 150)
                    );
                    pdf.rect(14, y - 2, pageWidth - 28, rowHeight, 'F');
                }

                // Numéro
                pdf.text(`${index + 1}`, 18, y + 8);

                // Photo
                const photoUrl = participant.inscription?.photo_url;
                if (photoUrl) {
                    try {
                        const base64Image = await loadImageAsBase64(photoUrl);
                        if (base64Image) {
                            pdf.addImage(base64Image, 'JPEG', 28, y, photoSize, photoSize);
                        } else {
                            // Placeholder si échec de chargement
                            pdf.setFillColor(229, 231, 235);
                            pdf.roundedRect(28, y, photoSize, photoSize, 2, 2, 'F');
                            pdf.setFontSize(6);
                            pdf.setTextColor(107, 114, 128);
                            pdf.text('N/A', 32, y + 7);
                            pdf.setFontSize(10);
                            pdf.setTextColor(0, 0, 0);
                        }
                    } catch (err) {
                        // Placeholder en cas d'erreur
                        pdf.setFillColor(229, 231, 235);
                        pdf.roundedRect(28, y, photoSize, photoSize, 2, 2, 'F');
                    }
                } else {
                    // Placeholder si pas de photo
                    pdf.setFillColor(229, 231, 235);
                    pdf.roundedRect(28, y, photoSize, photoSize, 2, 2, 'F');
                    pdf.setFontSize(6);
                    pdf.setTextColor(107, 114, 128);
                    pdf.text('N/A', 32, y + 7);
                    pdf.setFontSize(10);
                    pdf.setTextColor(0, 0, 0);
                }

                // Nom & Prénom
                const fullName = `${participant.inscription?.nom || ''} ${participant.inscription?.prenom || ''}`;
                pdf.text(fullName.substring(0, 35), 46, y + 8);

                // Note entrée
                pdf.text(`${participant.note_entree?.toFixed(1) || '-'}`, 115, y + 8);

                // Dortoir
                const dortoir = getDortoirNom(participant.inscription?.dortoir_id);
                pdf.text(dortoir.substring(0, 20), 135, y + 8);

                // Sexe
                pdf.text(participant.inscription?.sexe === 'homme' ? 'H' : 'F', 178, y + 8);

                y += rowHeight;
            }

            // Pied de page
            const pageCount = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(128, 128, 128);
                pdf.text(`Page ${i}/${pageCount}`, pageWidth / 2, 290, { align: 'center' });
            }

            pdf.save(`liste_${classe.nom.replace(/\s+/g, '_')}.pdf`);
        } catch (err) {
            console.error('Erreur export PDF:', err);
            alert('Erreur lors de l\'export PDF');
        } finally {
            setExporting(false);
        }
    }, [participantsParClasse, getDortoirNom, loadImageAsBase64, getNiveauColor]);

    // Exporter toutes les classes avec photos et couleurs par niveau
    const exportToutPDF = useCallback(async () => {
        setExporting(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const photoSize = 10; // Taille de la photo en mm
            const rowHeight = photoSize + 3; // Hauteur de chaque ligne avec photo
            let isFirstPage = true;

            for (const classe of classesFiltrees) {
                const participants = participantsParClasse[classe.id] || [];
                if (participants.length === 0) continue;

                if (!isFirstPage) {
                    pdf.addPage();
                }
                isFirstPage = false;

                // Couleur selon le niveau
                const niveauColor = getNiveauColor(classe.niveau);

                // Titre
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(0, 0, 0);
                pdf.text(`${classe.nom}`, pageWidth / 2, 20, { align: 'center' });

                // Effectif
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Effectif: ${participants.length}`, 14, 30);

                // Tableau avec couleur du niveau
                let y = 40;
                pdf.setFillColor(niveauColor.r, niveauColor.g, niveauColor.b);
                pdf.rect(14, y, pageWidth - 28, 8, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text('N°', 18, y + 6);
                pdf.text('Photo', 26, y + 6);
                pdf.text('Nom & Prénom', 42, y + 6);
                pdf.text('Note', 110, y + 6);
                pdf.text('Dortoir', 130, y + 6);
                pdf.text('Sexe', 175, y + 6);

                y += 10;
                pdf.setTextColor(0, 0, 0);
                pdf.setFont('helvetica', 'normal');

                for (let index = 0; index < participants.length; index++) {
                    const participant = participants[index];
                    
                    if (y > 270) {
                        pdf.addPage();
                        y = 20;
                    }

                    // Alternance avec teinte claire du niveau
                    if (index % 2 === 0) {
                        pdf.setFillColor(
                            Math.min(255, niveauColor.r + 150),
                            Math.min(255, niveauColor.g + 150),
                            Math.min(255, niveauColor.b + 150)
                        );
                        pdf.rect(14, y - 1, pageWidth - 28, rowHeight, 'F');
                    }

                    // Numéro
                    pdf.text(`${index + 1}`, 18, y + 7);

                    // Photo
                    const photoUrl = participant.inscription?.photo_url;
                    if (photoUrl) {
                        try {
                            const base64Image = await loadImageAsBase64(photoUrl);
                            if (base64Image) {
                                pdf.addImage(base64Image, 'JPEG', 26, y, photoSize, photoSize);
                            } else {
                                pdf.setFillColor(229, 231, 235);
                                pdf.roundedRect(26, y, photoSize, photoSize, 1, 1, 'F');
                            }
                        } catch (err) {
                            pdf.setFillColor(229, 231, 235);
                            pdf.roundedRect(26, y, photoSize, photoSize, 1, 1, 'F');
                        }
                    } else {
                        pdf.setFillColor(229, 231, 235);
                        pdf.roundedRect(26, y, photoSize, photoSize, 1, 1, 'F');
                    }

                    // Nom
                    pdf.text(`${participant.inscription?.nom || ''} ${participant.inscription?.prenom || ''}`.substring(0, 35), 42, y + 7);
                    
                    // Note
                    pdf.text(`${participant.note_entree?.toFixed(1) || '-'}`, 110, y + 7);
                    
                    // Dortoir
                    pdf.text(getDortoirNom(participant.inscription?.dortoir_id).substring(0, 20), 130, y + 7);
                    
                    // Sexe
                    pdf.text(participant.inscription?.sexe === 'homme' ? 'H' : 'F', 178, y + 7);

                    y += rowHeight;
                }
            }

            // Date en première page
            pdf.setPage(1);
            pdf.setFontSize(10);
            pdf.setTextColor(128, 128, 128);
            const date = new Date().toLocaleDateString('fr-FR');
            pdf.text(`SEFIMAP - Généré le ${date}`, pageWidth / 2, 10, { align: 'center' });

            pdf.save('liste_toutes_classes.pdf');
        } catch (err) {
            console.error('Erreur export PDF:', err);
            alert('Erreur lors de l\'export PDF');
        } finally {
            setExporting(false);
        }
    }, [classesFiltrees, participantsParClasse, getDortoirNom, loadImageAsBase64, getNiveauColor]);

    const niveauLabels = {
        niveau_1: { label: 'Niveau 1', color: 'destructive' },
        niveau_2: { label: 'Niveau 2', color: 'warning' },
        niveau_3: { label: 'Niveau 3', color: 'default' },
        niveau_superieur: { label: 'Niveau Supérieur', color: 'success' },
    };

    // Calculer le rang d'un participant dans sa classe
    const calculerRang = useCallback((participant, classeId) => {
        if (!participant.moyenne) return '-';

        // Obtenir tous les participants de la même classe avec une moyenne
        const participantsClasse = (participantsParClasse[classeId] || [])
            .filter(p => p.moyenne !== null && p.moyenne !== undefined);

        // Trier par moyenne décroissante
        const tries = [...participantsClasse].sort((a, b) =>
            parseFloat(b.moyenne) - parseFloat(a.moyenne)
        );

        // Trouver le rang
        const rang = tries.findIndex(p => p.id === participant.id) + 1;

        if (rang === 0) return '-';
        if (rang === 1) return '1er';
        return `${rang}ème`;
    }, [participantsParClasse]);

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white">
                        Liste des classes
                    </h1>
                    <p className="text-text-secondary mt-1">
                        Visualiser et exporter les listes par classe
                    </p>
                </div>
                <Button
                    onClick={exportToutPDF}
                    disabled={exporting || classesFiltrees.length === 0}
                >
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? 'Export...' : 'Exporter tout (PDF)'}
                </Button>
            </div>

            {/* Filtres */}
            <div className="flex flex-wrap gap-4">
                <Select
                    value={filterNiveau}
                    onValueChange={setFilterNiveau}
                >
                    <option value="all">Tous les niveaux</option>
                    <option value="niveau_1">Niveau 1</option>
                    <option value="niveau_2">Niveau 2</option>
                    <option value="niveau_3">Niveau 3</option>
                    <option value="niveau_superieur">Niveau Supérieur</option>
                </Select>
                <Select
                    value={filterClasse}
                    onValueChange={setFilterClasse}
                >
                    <option value="all">Toutes les classes</option>
                    {classes.map(classe => (
                        <option key={classe.id} value={classe.id}>
                            {classe.nom}
                        </option>
                    ))}
                </Select>
            </div>

            {/* Liste des classes */}
            {classesFiltrees.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center">
                            <Users className="h-12 w-12 text-text-secondary mx-auto mb-4" />
                            <p className="text-text-secondary">Aucune classe à afficher</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6" ref={tableRef}>
                    {classesFiltrees.map(classe => {
                        const participants = participantsParClasse[classe.id] || [];

                        return (
                            <Card key={classe.id}>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Badge variant={niveauLabels[classe.niveau]?.color || 'default'}>
                                                {classe.nom}
                                            </Badge>
                                            <span className="text-sm text-text-secondary font-normal">
                                                {participants.length} / {classe.capacite} places
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => exportClassePDF(classe)}
                                            disabled={exporting || participants.length === 0}
                                        >
                                            <FileText className="h-4 w-4 mr-2" />
                                            PDF
                                        </Button>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {participants.length === 0 ? (
                                        <p className="text-center text-text-secondary py-4">
                                            Aucun participant dans cette classe
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-border-light dark:border-border-dark">
                                                        <th className="text-left py-2 px-3 text-sm font-medium text-text-secondary">N°</th>
                                                        <th className="text-left py-2 px-3 text-sm font-medium text-text-secondary">Participant</th>
                                                        <th className="text-center py-2 px-3 text-sm font-medium text-text-secondary">Moyenne</th>
                                                        <th className="text-center py-2 px-3 text-sm font-medium text-text-secondary">Rang</th>
                                                        <th className="text-left py-2 px-3 text-sm font-medium text-text-secondary">Dortoir</th>
                                                        <th className="text-center py-2 px-3 text-sm font-medium text-text-secondary">Sexe</th>
                                                        <th className="text-center py-2 px-3 text-sm font-medium text-text-secondary">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {participants.map((participant, index) => (
                                                        <tr
                                                            key={participant.id}
                                                            className="border-b border-border-light dark:border-border-dark last:border-0"
                                                        >
                                                            <td className="py-2 px-3 text-text-secondary">
                                                                {index + 1}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                <div className="flex items-center gap-2">
                                                                    {participant.inscription?.photo_url ? (
                                                                        <img
                                                                            src={participant.inscription.photo_url}
                                                                            alt=""
                                                                            className="h-8 w-8 rounded-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                                            <User className="h-4 w-4 text-blue-600" />
                                                                        </div>
                                                                    )}
                                                                    <span className="font-medium text-text-main dark:text-white">
                                                                        {participant.inscription?.nom} {participant.inscription?.prenom}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-3 text-center font-medium text-text-main dark:text-white">
                                                                {participant.moyenne ? parseFloat(participant.moyenne).toFixed(2) : '-'}
                                                            </td>
                                                            <td className="py-2 px-3 text-center font-medium text-text-main dark:text-white">
                                                                {calculerRang(participant, classe.id)}
                                                            </td>
                                                            <td className="py-2 px-3 text-text-main dark:text-white">
                                                                {getDortoirNom(participant.inscription?.dortoir_id)}
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                <Badge variant={participant.inscription?.sexe === 'homme' ? 'default' : 'secondary'}>
                                                                    {participant.inscription?.sexe === 'homme' ? 'H' : 'F'}
                                                                </Badge>
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setSelectedParticipant(participant)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal Détail Participant */}
            {selectedParticipant && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setSelectedParticipant(null)}
                    />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
                                <h3 className="text-lg font-bold text-text-main dark:text-white">
                                    Détails du participant
                                </h3>
                                <button
                                    onClick={() => setSelectedParticipant(null)}
                                    className="text-text-secondary hover:text-text-main dark:hover:text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-4">
                                {/* Photo et nom */}
                                <div className="flex items-center gap-4">
                                    {selectedParticipant.inscription?.photo_url ? (
                                        <img
                                            src={selectedParticipant.inscription.photo_url}
                                            alt=""
                                            className="h-20 w-20 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-20 w-20 rounded-full bg-blue-500/10 flex items-center justify-center">
                                            <User className="h-10 w-10 text-blue-600" />
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-xl font-bold text-text-main dark:text-white">
                                            {selectedParticipant.inscription?.nom} {selectedParticipant.inscription?.prenom}
                                        </h4>
                                        <div className="flex gap-2 mt-1">
                                            <Badge variant={selectedParticipant.inscription?.sexe === 'homme' ? 'default' : 'secondary'}>
                                                {selectedParticipant.inscription?.sexe === 'homme' ? 'Homme' : 'Femme'}
                                            </Badge>
                                            <Badge variant={niveauLabels[selectedParticipant.niveau_attribue]?.color || 'default'}>
                                                {selectedParticipant.classe?.nom}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Infos personnelles */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-text-secondary" />
                                        <div>
                                            <p className="text-xs text-text-secondary">Âge</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {selectedParticipant.inscription?.age} ans
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <School className="h-4 w-4 text-text-secondary" />
                                        <div>
                                            <p className="text-xs text-text-secondary">École</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {selectedParticipant.inscription?.ecole || '-'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-text-secondary" />
                                        <div>
                                            <p className="text-xs text-text-secondary">Dortoir</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {getDortoirNom(selectedParticipant.inscription?.dortoir_id)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-text-secondary" />
                                        <div>
                                            <p className="text-xs text-text-secondary">Téléphone</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {selectedParticipant.inscription?.telephone || '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                    <h5 className="font-semibold text-text-main dark:text-white mb-3">Notes</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-lg bg-gray-100 dark:bg-white/5">
                                            <p className="text-xs text-text-secondary">Note d'entrée</p>
                                            <p className="text-lg font-bold text-text-main dark:text-white">
                                                {selectedParticipant.note_entree?.toFixed(1) || '-'} /20
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-gray-100 dark:bg-white/5">
                                            <p className="text-xs text-text-secondary">Note cahiers</p>
                                            <p className="text-lg font-bold text-text-main dark:text-white">
                                                {selectedParticipant.note_cahiers?.toFixed(1) || '-'} /20
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-gray-100 dark:bg-white/5">
                                            <p className="text-xs text-text-secondary">Note conduite</p>
                                            <p className="text-lg font-bold text-text-main dark:text-white">
                                                {selectedParticipant.note_conduite?.toFixed(1) || '-'} /20
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-gray-100 dark:bg-white/5">
                                            <p className="text-xs text-text-secondary">Note sortie</p>
                                            <p className="text-lg font-bold text-text-main dark:text-white">
                                                {selectedParticipant.note_sortie?.toFixed(1) || '-'} /20
                                            </p>
                                        </div>
                                    </div>

                                    {/* Moyenne et Rang */}
                                    {selectedParticipant.moyenne && (
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                                <p className="text-xs text-blue-600 dark:text-blue-400">Moyenne générale</p>
                                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                    {parseFloat(selectedParticipant.moyenne).toFixed(2)} /20
                                                </p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                                <p className="text-xs text-green-600 dark:text-green-400">Rang dans la classe</p>
                                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                    {calculerRang(selectedParticipant, selectedParticipant.classe_id)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Infos parent */}
                                {(selectedParticipant.inscription?.nom_parent || selectedParticipant.inscription?.numero_parent) && (
                                    <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                        <h5 className="font-semibold text-text-main dark:text-white mb-3">Parent/Tuteur</h5>
                                        <div className="space-y-2">
                                            {selectedParticipant.inscription?.nom_parent && (
                                                <p className="text-text-main dark:text-white">
                                                    {selectedParticipant.inscription.nom_parent} {selectedParticipant.inscription.prenom_parent}
                                                </p>
                                            )}
                                            {selectedParticipant.inscription?.numero_parent && (
                                                <p className="text-text-secondary flex items-center gap-2">
                                                    <Phone className="h-4 w-4" />
                                                    {selectedParticipant.inscription.numero_parent}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-border-light dark:border-border-dark">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setSelectedParticipant(null)}
                                >
                                    Fermer
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
