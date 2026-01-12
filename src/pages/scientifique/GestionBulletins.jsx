import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LazyImage } from '@/components/ui/lazy-image';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import {
    Download,
    FileText,
    Search,
    Users,
    Award,
    Filter,
    GraduationCap,
    Loader2,
    AlertCircle,
    CheckCircle,
    User
} from 'lucide-react';

export default function GestionBulletins() {
    const { dortoirs } = useData();
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filtreNiveau, setFiltreNiveau] = useState('');
    const [filtreClasse, setFiltreClasse] = useState('');
    const [notesExamens, setNotesExamens] = useState([]);

    // Charger les notes d'examens avec inscriptions et classes
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notes_examens')
                .select(`
                    *,
                    inscription:inscriptions(id, nom, prenom, photo_url, sexe, age, dortoir_id),
                    classe:classes(id, nom, niveau, numero)
                `)
                .not('classe_id', 'is', null);

            if (error) throw error;

            setNotesExamens(data || []);
        } catch (err) {
            console.error('Erreur chargement données:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filtrer les participants avec moyenne calculée (notes complètes)
    const participantsAvecNotes = useMemo(() => {
        return notesExamens.filter(note => note.moyenne !== null);
    }, [notesExamens]);

    // Participants sans notes complètes
    const participantsSansNotes = useMemo(() => {
        return notesExamens.filter(note => note.moyenne === null);
    }, [notesExamens]);

    // Appliquer les filtres
    const participantsFiltres = useMemo(() => {
        return participantsAvecNotes.filter(note => {
            const fullName = `${note.inscription?.nom || ''} ${note.inscription?.prenom || ''}`.toLowerCase();
            const matchSearch = fullName.includes(searchTerm.toLowerCase());
            const matchNiveau = !filtreNiveau || note.classe?.niveau === filtreNiveau;
            const matchClasse = !filtreClasse || String(note.classe_id) === filtreClasse;
            return matchSearch && matchNiveau && matchClasse;
        });
    }, [participantsAvecNotes, searchTerm, filtreNiveau, filtreClasse]);

    // Obtenir l'appréciation selon la moyenne
    const getAppreciation = (moyenne) => {
        if (moyenne >= 18) return { text: 'Excellent', color: '#22C55E' };
        if (moyenne >= 16) return { text: 'Très Bien', color: '#22C55E' };
        if (moyenne >= 14) return { text: 'Bien', color: '#3B82F6' };
        if (moyenne >= 12) return { text: 'Assez Bien', color: '#3B82F6' };
        if (moyenne >= 10) return { text: 'Passable', color: '#F97316' };
        return { text: 'Insuffisant', color: '#EF4444' };
    };

    // Couleurs par niveau
    const getNiveauColor = (niveau) => {
        switch (niveau) {
            case 'niveau_1': return { r: 239, g: 68, b: 68 };     // Rouge
            case 'niveau_2': return { r: 249, g: 115, b: 22 };    // Orange
            case 'niveau_3': return { r: 234, g: 179, b: 8 };     // Jaune
            case 'niveau_superieur': return { r: 34, g: 197, b: 94 }; // Vert
            default: return { r: 59, g: 130, b: 246 };
        }
    };

    // Convertir image en base64 avec support CORS amélioré
    const loadImageAsBase64 = async (url, timeout = 10000) => {
        return new Promise((resolve) => {
            // Créer un timeout pour éviter les blocages
            const timeoutId = setTimeout(() => {
                console.warn('Timeout lors du chargement de l\'image:', url);
                resolve(null);
            }, timeout);

            const img = new Image();
            img.crossOrigin = 'anonymous'; // Important pour CORS avec Supabase

            img.onload = () => {
                clearTimeout(timeoutId);
                try {
                    // Créer un canvas pour convertir l'image en base64
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    // Convertir en base64 (JPEG pour les photos, PNG pour les logos)
                    const isPhoto = url.includes('photo') || url.includes('inscriptions');
                    const format = isPhoto ? 'image/jpeg' : 'image/png';
                    const quality = isPhoto ? 0.9 : 1.0;
                    const dataUrl = canvas.toDataURL(format, quality);
                    resolve(dataUrl);
                } catch (err) {
                    console.error('Erreur conversion image en base64:', err);
                    resolve(null);
                }
            };

            img.onerror = (err) => {
                clearTimeout(timeoutId);
                console.error('Erreur chargement image:', err, url);
                resolve(null);
            };

            // Ajouter un cache-buster pour éviter les problèmes de cache CORS
            const separator = url.includes('?') ? '&' : '?';
            img.src = `${url}${separator}t=${Date.now()}`;
        });
    };

    // Charger les logos du bulletin
    const loadLogos = async () => {
        const logo1 = await loadImageAsBase64('/logoBulletin1.png');
        const logo2 = await loadImageAsBase64('/logoBulletin2.png');
        return { logo1, logo2 };
    };

    // Nom du dortoir
    const getDortoirNom = useCallback((dortoirId) => {
        const dortoir = dortoirs?.find(d => String(d.id) === String(dortoirId));
        return dortoir?.nom || 'Non assigné';
    }, [dortoirs]);

    // Labels des niveaux
    const niveauLabels = {
        niveau_1: 'Niveau 1',
        niveau_2: 'Niveau 2',
        niveau_3: 'Niveau 3',
        niveau_superieur: 'Niveau Supérieur'
    };

    // Calculer le rang d'un participant dans sa classe
    const calculerRang = useCallback((note, participantsAvecNotes) => {
        // Filtrer les participants de la même classe
        const memeClasse = participantsAvecNotes.filter(n => n.classe_id === note.classe_id);
        // Trier par moyenne décroissante
        const triee = [...memeClasse].sort((a, b) => parseFloat(b.moyenne) - parseFloat(a.moyenne));
        // Trouver le rang
        const rang = triee.findIndex(n => n.id === note.id) + 1;
        // Formater le rang
        if (rang === 1) return '1er/ère';
        return `${rang}ème`;
    }, []);

    // Générer le bulletin PDF pour un participant (note = objet de notes_examens)
    const genererBulletin = useCallback(async (note, allParticipants) => {
        setExporting(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;

            // Charger les logos
            const logos = await loadLogos();

            // Calculer les valeurs
            const note1 = parseFloat(note.note_entree) || 0;
            const note2 = parseFloat(note.note_cahiers) || 0;
            const conduite = parseFloat(note.note_conduite) || 0;
            const testSortie = parseFloat(note.note_sortie) || 0;
            const total = note1 + note2 + conduite + testSortie;
            const moyenne = parseFloat(note.moyenne) || (total / 4);
            const rang = calculerRang(note, allParticipants || participantsAvecNotes);

            // Niveau formaté
            const niveauLabel = {
                niveau_1: 'DEBUTANT',
                niveau_2: 'NIVEAU 2',
                niveau_3: 'NIVEAU 3',
                niveau_superieur: 'SUPERIEUR'
            }[note.classe?.niveau] || 'N/A';

            let y = 10;

            // ===== EN-TÊTE AVEC LOGOS =====
            // Logo AEEMCI à gauche
            if (logos.logo1) {
                try {
                    pdf.addImage(logos.logo1, 'PNG', margin, y, 30, 30);
                } catch (e) {
                    console.error('Erreur logo1:', e);
                }
            }

            // Texte central - Bismillah
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'italic');
            pdf.text('Bismillahi Rahmani Rahim', pageWidth / 2, y + 5, { align: 'center' });

            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('AEEMCI', pageWidth / 2, y + 12, { align: 'center' });

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'italic');
            pdf.text("Association des Élèves et Étudiants Musulmans de Côte d'Ivoire", pageWidth / 2, y + 18, { align: 'center' });
            pdf.text('Secrétariat Régional Abidjan Sud', pageWidth / 2, y + 23, { align: 'center' });
            pdf.text('Sous-Comité de Port-bouet', pageWidth / 2, y + 28, { align: 'center' });

            // Logo SEFIMAP à droite
            if (logos.logo2) {
                try {
                    pdf.addImage(logos.logo2, 'PNG', pageWidth - margin - 30, y, 30, 30);
                } catch (e) {
                    console.error('Erreur logo2:', e);
                }
            }

            y += 38;

            // ===== TITRE PRINCIPAL =====
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text('SEMINAIRE COMMUNAL DE FORMATION ISLAMIQUE', pageWidth / 2, y, { align: 'center' });

            y += 10;

            // Badge "BULLETIN DU SEFIMAP 2025"
            const badgeWidth = 80;
            const badgeHeight = 10;
            const badgeX = (pageWidth - badgeWidth) / 2;
            pdf.setFillColor(80, 80, 80);
            pdf.roundedRect(badgeX, y, badgeWidth, badgeHeight, 2, 2, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(11);
            pdf.text('BULLETIN DU SEFIMAP 2025', pageWidth / 2, y + 7, { align: 'center' });

            y += 18;

            // ===== INFORMATIONS DU PARTICIPANT AVEC PHOTO =====
            const photoWidth = 30;
            const photoHeight = 35;
            const photoX = pageWidth - margin - photoWidth;
            const infoStartY = y;

            // Cadre photo à droite
            pdf.setDrawColor(200, 120, 50); // Couleur orange/marron comme sur l'image
            pdf.setLineWidth(1);
            pdf.rect(photoX, y, photoWidth, photoHeight, 'S');

            // Photo du participant
            const photoUrl = note.inscription?.photo_url;
            if (photoUrl) {
                try {
                    console.log('Chargement de la photo:', photoUrl);
                    const photoBase64 = await loadImageAsBase64(photoUrl);
                    if (photoBase64) {
                        // Détecter le format de l'image depuis le data URL
                        const imageFormat = photoBase64.includes('data:image/png') ? 'PNG' : 'JPEG';
                        pdf.addImage(photoBase64, imageFormat, photoX + 1, y + 1, photoWidth - 2, photoHeight - 2);
                        console.log('Photo ajoutée au bulletin avec succès');
                    } else {
                        console.warn('Photo non chargée pour:', note.inscription?.nom, note.inscription?.prenom);
                    }
                } catch (e) {
                    console.error('Erreur photo:', e);
                }
            }

            // Informations du participant (à gauche de la photo)
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text('NOM DU SEMINARISTE : ', margin, y + 5);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`${note.inscription?.nom || ''} ${note.inscription?.prenom || ''}`.toUpperCase(), margin + 50, y + 5);

            y += 12;
            pdf.setFont('helvetica', 'bold');
            pdf.text('NIVEAU:', margin, y);
            pdf.setFont('helvetica', 'normal');
            pdf.text(niveauLabel, margin + 20, y);

            // Ajuster y pour après la photo
            y = infoStartY + photoHeight + 8;

            // ===== TABLEAU DES NOTES =====
            const tableX = margin;
            const tableWidth = pageWidth - (2 * margin);
            const col1Width = 60; // EVALUATIONS
            const col2Width = 50; // NOTES
            const col3Width = tableWidth - col1Width - col2Width; // OBSERVATION
            const rowHeight = 12;

            // En-tête du tableau (gris foncé)
            pdf.setFillColor(70, 70, 70);
            pdf.rect(tableX, y, tableWidth, rowHeight, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text('EVALUATIONS', tableX + 5, y + 8);
            pdf.text('NOTES', tableX + col1Width + 15, y + 8);
            pdf.text('OBSERVATION', tableX + col1Width + col2Width + 10, y + 8);

            y += rowHeight;

            // Lignes du tableau
            const notesData = [
                { label: 'NOTE 1', value: note1 },
                { label: 'NOTE 2', value: note2 },
                { label: 'CONDUITE', value: conduite },
                { label: 'TEST DE SORTIE', value: testSortie }
            ];

            // Dessiner les bordures verticales et horizontales
            pdf.setDrawColor(150, 150, 150);
            pdf.setLineWidth(0.3);

            // Calculer la hauteur totale pour la colonne Observation fusionnée (4 lignes de notes)
            const observationTotalHeight = rowHeight * 4;
            const observationStartY = y;

            notesData.forEach((item, index) => {
                // Fond alterné
                if (index % 2 === 0) {
                    pdf.setFillColor(245, 245, 245);
                    pdf.rect(tableX, y, col1Width + col2Width, rowHeight, 'F');
                }

                // Bordures pour les 2 premières colonnes seulement
                pdf.rect(tableX, y, col1Width, rowHeight, 'S');
                pdf.rect(tableX + col1Width, y, col2Width, rowHeight, 'S');

                // Texte
                pdf.setTextColor(0, 0, 0);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.text(item.label, tableX + 5, y + 8);

                pdf.setFont('helvetica', 'normal');
                // Note avec /20
                pdf.text(String(item.value), tableX + col1Width + 15, y + 8);
                pdf.setFontSize(9);
                pdf.text('/20', tableX + col1Width + 30, y + 8);

                y += rowHeight;
            });

            // Colonne Observation fusionnée sur 4 lignes
            pdf.rect(tableX + col1Width + col2Width, observationStartY, col3Width, observationTotalHeight, 'S');

            // Contenu de la colonne Observation (centré verticalement)
            const obsCenterY = observationStartY + (observationTotalHeight / 2);
            pdf.setTextColor(0, 0, 0);
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(10);
            pdf.text('Moyenne', tableX + col1Width + col2Width + 10, obsCenterY - 8);
            pdf.setFont('helvetica', 'bold');
            pdf.text(moyenne.toFixed(2), tableX + col1Width + col2Width + 45, obsCenterY - 8);

            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(10);
            pdf.text('Rang', tableX + col1Width + col2Width + 10, obsCenterY + 8);
            pdf.setFont('helvetica', 'normal');
            pdf.text(rang, tableX + col1Width + col2Width + 45, obsCenterY + 8);

            // Ligne TOTAL
            pdf.setFillColor(245, 245, 245);
            pdf.rect(tableX, y, tableWidth, rowHeight, 'F');
            pdf.rect(tableX, y, col1Width, rowHeight, 'S');
            pdf.rect(tableX + col1Width, y, col2Width, rowHeight, 'S');
            pdf.rect(tableX + col1Width + col2Width, y, col3Width, rowHeight, 'S');

            pdf.setTextColor(0, 0, 0);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.text('TOTAL :', tableX + 5, y + 8);
            pdf.text(String(total), tableX + col1Width + 15, y + 8);
            pdf.setFontSize(9);
            pdf.text('/80', tableX + col1Width + 30, y + 8);

            y += rowHeight + 5;

            // ===== SECTION MANAGER / MOT DU FORMATEUR =====
            const halfWidth = (tableWidth / 2);

            // En-tête gris
            pdf.setFillColor(70, 70, 70);
            pdf.rect(tableX, y, halfWidth, 10, 'F');
            pdf.rect(tableX + halfWidth, y, halfWidth, 10, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text('MANAGER', tableX + halfWidth / 2, y + 7, { align: 'center' });
            pdf.text('MOT DU FORMATEUR', tableX + halfWidth + halfWidth / 2, y + 7, { align: 'center' });

            y += 15;

            // Contenu
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Oustaz Sanga Moussa', tableX + halfWidth / 2, y + 5, { align: 'center' });
            pdf.text('Imam Ballo Souleymane', tableX + halfWidth + halfWidth / 2, y + 5, { align: 'center' });

            y += 12;

            // Message de félicitation (à droite)
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            const felicitationLines = pdf.splitTextToSize('FELICITATION CHERS PARENTS POUR LE SUIVI ISLAMIQUE DE VOTRE ENFANT', halfWidth - 10);
            pdf.text(felicitationLines, tableX + halfWidth + 5, y);

            // Espace vide réservé pour cachets et signatures (à gauche) - pas de cercle ni ligne
            // Cet espace sera utilisé pour apposer les cachets et signatures physiquement

            y += 30;

            // Date
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            const today = new Date();
            const dateStr = `${String(today.getDate()).padStart(2, '0')} /${String(today.getMonth() + 1).padStart(2, '0')} /${today.getFullYear()}`;
            pdf.text(`Fait à Abidjan le ${dateStr}`, tableX, y);

            y += 15;

            // ===== PIED DE PAGE =====
            // Message de conservation
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(9);
            pdf.text('Conservez précieusement ce présent bulletin jusqu\'au prochain séminaire du SEFIMAP', pageWidth / 2, y, { align: 'center' });

            y += 8;

            // Ligne de séparation
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.5);
            pdf.line(margin, y, pageWidth - margin, y);

            y += 6;

            // Informations de contact
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text('Secrétariats Régional Abidjan Sud / Sous-comité de Port-bouet', pageWidth / 2, y, { align: 'center' });
            y += 4;
            pdf.text('Cel: (+225) 07 47 68 14 61 / 07 78 74 26 95', pageWidth / 2, y, { align: 'center' });
            y += 4;
            pdf.setFont('helvetica', 'italic');
            pdf.text('AEEMCI, pour une identité islamique !', pageWidth / 2, y, { align: 'center' });

            // Télécharger
            const fileName = `bulletin_${note.inscription?.nom}_${note.inscription?.prenom}.pdf`;
            pdf.save(fileName.replace(/\s+/g, '_'));
        } catch (err) {
            console.error('Erreur génération bulletin:', err);
            alert('Erreur lors de la génération du bulletin');
        } finally {
            setExporting(false);
        }
    }, [getDortoirNom, participantsAvecNotes, calculerRang, loadImageAsBase64]);

    // Générer tous les bulletins
    const genererTousBulletins = useCallback(async () => {
        if (participantsFiltres.length === 0) {
            alert('Aucun participant avec des notes à exporter');
            return;
        }

        setExporting(true);
        try {
            for (const note of participantsFiltres) {
                await genererBulletin(note, participantsAvecNotes);
                // Petite pause entre chaque génération
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } finally {
            setExporting(false);
        }
    }, [participantsFiltres, genererBulletin, participantsAvecNotes]);

    // Classes uniques pour le filtre
    const classesUniques = useMemo(() => {
        const uniqueClasses = [];
        const seen = new Set();
        notesExamens.forEach(note => {
            if (note.classe && !seen.has(note.classe_id)) {
                seen.add(note.classe_id);
                uniqueClasses.push(note.classe);
            }
        });
        return uniqueClasses.sort((a, b) => a.nom.localeCompare(b.nom));
    }, [notesExamens]);

    if (loading) {
        return (
            <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white">
                        Gestion des Bulletins
                    </h1>
                    <p className="text-text-secondary mt-1">
                        Générer les bulletins de notes des participants
                    </p>
                </div>
                <Button
                    onClick={genererTousBulletins}
                    disabled={exporting || participantsFiltres.length === 0}
                    className="gap-2"
                >
                    {exporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    Exporter tous les bulletins
                </Button>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Total participants</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {notesExamens.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Notes complètes</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {participantsAvecNotes.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Notes incomplètes</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {participantsSansNotes.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Bulletins à générer</p>
                                <p className="text-2xl font-bold text-text-main dark:text-white">
                                    {participantsFiltres.length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtres */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="Rechercher un participant..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <select
                            value={filtreNiveau}
                            onChange={(e) => setFiltreNiveau(e.target.value)}
                            className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Tous les niveaux</option>
                            <option value="niveau_1">Niveau 1</option>
                            <option value="niveau_2">Niveau 2</option>
                            <option value="niveau_3">Niveau 3</option>
                            <option value="niveau_superieur">Niveau Supérieur</option>
                        </select>

                        <select
                            value={filtreClasse}
                            onChange={(e) => setFiltreClasse(e.target.value)}
                            className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Toutes les classes</option>
                            {classesUniques.map(classe => (
                                <option key={classe.id} value={classe.id}>
                                    {classe.nom}
                                </option>
                            ))}
                        </select>

                        <Button
                            variant="outline"
                            onClick={() => {
                                setSearchTerm('');
                                setFiltreNiveau('');
                                setFiltreClasse('');
                            }}
                            className="gap-2"
                        >
                            <Filter className="h-4 w-4" />
                            Réinitialiser
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Liste des participants */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        Participants avec notes complètes ({participantsFiltres.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {participantsFiltres.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <p className="text-text-secondary">
                                {participantsAvecNotes.length === 0
                                    ? 'Aucun participant n\'a encore toutes ses notes (cahiers, conduite, sortie)'
                                    : 'Aucun résultat pour ces filtres'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b dark:border-slate-700">
                                        <th className="text-left p-3 text-text-secondary font-medium">Photo</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Nom & Prénom</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Classe</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Entrée</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Cahiers</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Conduite</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Sortie</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Moyenne</th>
                                        <th className="text-left p-3 text-text-secondary font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participantsFiltres.map((note) => {
                                        const moyenne = parseFloat(note.moyenne);
                                        const appreciation = getAppreciation(moyenne);

                                        return (
                                            <tr
                                                key={note.id}
                                                className="border-b dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                                            >
                                                <td className="p-3">
                                                    {note.inscription?.photo_url ? (
                                                        <LazyImage
                                                            src={note.inscription.photo_url}
                                                            alt={note.inscription?.nom}
                                                            className="w-10 h-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                                                            <User className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-medium text-text-main dark:text-white">
                                                        {note.inscription?.nom} {note.inscription?.prenom}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <Badge variant={
                                                        note.classe?.niveau === 'niveau_superieur' ? 'success' :
                                                            note.classe?.niveau === 'niveau_3' ? 'default' :
                                                                note.classe?.niveau === 'niveau_2' ? 'warning' :
                                                                    'destructive'
                                                    }>
                                                        {note.classe?.nom || '-'}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-text-main dark:text-white">
                                                    {parseFloat(note.note_entree)?.toFixed(1) || '-'}
                                                </td>
                                                <td className="p-3 text-text-main dark:text-white">
                                                    {parseFloat(note.note_cahiers)?.toFixed(1) || '-'}
                                                </td>
                                                <td className="p-3 text-text-main dark:text-white">
                                                    {parseFloat(note.note_conduite)?.toFixed(1) || '-'}
                                                </td>
                                                <td className="p-3 text-text-main dark:text-white">
                                                    {parseFloat(note.note_sortie)?.toFixed(1) || '-'}
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className="font-bold"
                                                        style={{ color: appreciation.color }}
                                                    >
                                                        {moyenne.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => genererBulletin(note, participantsAvecNotes)}
                                                        disabled={exporting}
                                                        className="gap-1"
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        Bulletin
                                                    </Button>
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
    );
}
