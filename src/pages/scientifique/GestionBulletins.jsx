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

    // Convertir image en base64
    const loadImageAsBase64 = async (url) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.error('Erreur chargement image:', err);
            return null;
        }
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

    // Générer le bulletin PDF pour un participant (note = objet de notes_examens)
    const genererBulletin = useCallback(async (note) => {
        setExporting(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const moyenne = parseFloat(note.moyenne);
            const appreciation = getAppreciation(moyenne);
            const niveauColor = getNiveauColor(note.classe?.niveau);

            // En-tête coloré selon le niveau
            pdf.setFillColor(niveauColor.r, niveauColor.g, niveauColor.b);
            pdf.rect(0, 0, pageWidth, 45, 'F');

            // Logo / Titre
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(24);
            pdf.setFont('helvetica', 'bold');
            pdf.text('SEFIMAP', pageWidth / 2, 18, { align: 'center' });
            
            pdf.setFontSize(14);
            pdf.text('Séminaire de Formation Islamique Malikite et Planification', pageWidth / 2, 28, { align: 'center' });
            
            pdf.setFontSize(18);
            pdf.text('BULLETIN DE NOTES', pageWidth / 2, 40, { align: 'center' });

            // Photo du participant
            const photoUrl = note.inscription?.photo_url;
            let y = 55;
            
            if (photoUrl) {
                try {
                    const base64Image = await loadImageAsBase64(photoUrl);
                    if (base64Image) {
                        // Cadre photo
                        pdf.setDrawColor(niveauColor.r, niveauColor.g, niveauColor.b);
                        pdf.setLineWidth(1);
                        pdf.roundedRect(14, y, 35, 40, 3, 3, 'S');
                        pdf.addImage(base64Image, 'JPEG', 15, y + 1, 33, 38);
                    }
                } catch (err) {
                    // Placeholder photo
                    pdf.setFillColor(229, 231, 235);
                    pdf.roundedRect(14, y, 35, 40, 3, 3, 'F');
                    pdf.setTextColor(107, 114, 128);
                    pdf.setFontSize(10);
                    pdf.text('Photo', 25, y + 22);
                }
            } else {
                // Placeholder si pas de photo
                pdf.setFillColor(229, 231, 235);
                pdf.roundedRect(14, y, 35, 40, 3, 3, 'F');
                pdf.setTextColor(107, 114, 128);
                pdf.setFontSize(10);
                pdf.text('Photo', 25, y + 22);
            }

            // Informations de l'élève
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            
            const infoX = 55;
            pdf.text('Nom:', infoX, y + 8);
            pdf.text('Prénom:', infoX, y + 16);
            pdf.text('Classe:', infoX, y + 24);
            pdf.text('Dortoir:', infoX, y + 32);

            pdf.setFont('helvetica', 'normal');
            pdf.text(note.inscription?.nom || '-', infoX + 35, y + 8);
            pdf.text(note.inscription?.prenom || '-', infoX + 35, y + 16);
            pdf.text(note.classe?.nom || '-', infoX + 35, y + 24);
            pdf.text(getDortoirNom(note.inscription?.dortoir_id), infoX + 35, y + 32);

            // Tableau des notes
            y = 105;
            
            // En-tête du tableau
            pdf.setFillColor(niveauColor.r, niveauColor.g, niveauColor.b);
            pdf.rect(14, y, pageWidth - 28, 10, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Évaluation', 20, y + 7);
            pdf.text('Note', 130, y + 7);
            pdf.text('Observation', 155, y + 7);

            y += 12;
            pdf.setTextColor(0, 0, 0);
            pdf.setFont('helvetica', 'normal');

            // Liste des notes (entrée, cahiers, conduite, sortie)
            const notesListe = [
                { label: 'Test d\'entrée', value: note.note_entree },
                { label: 'Note des cahiers', value: note.note_cahiers },
                { label: 'Note de conduite', value: note.note_conduite },
                { label: 'Examen de sortie', value: note.note_sortie }
            ];

            notesListe.forEach((item, i) => {
                // Alternance couleur
                if (i % 2 === 0) {
                    pdf.setFillColor(
                        Math.min(255, niveauColor.r + 180),
                        Math.min(255, niveauColor.g + 180),
                        Math.min(255, niveauColor.b + 180)
                    );
                    pdf.rect(14, y - 3, pageWidth - 28, 10, 'F');
                }

                const noteVal = parseFloat(item.value);
                pdf.text(item.label, 20, y + 3);
                pdf.text(`${!isNaN(noteVal) ? noteVal.toFixed(1) : '-'}/20`, 130, y + 3);
                
                // Observation selon la note
                const obs = !isNaN(noteVal) ? (noteVal >= 10 ? 'Acquis' : 'À revoir') : '-';
                pdf.text(obs, 155, y + 3);

                y += 10;
            });

            // Ligne de séparation
            y += 5;
            pdf.setDrawColor(niveauColor.r, niveauColor.g, niveauColor.b);
            pdf.setLineWidth(0.5);
            pdf.line(14, y, pageWidth - 14, y);

            // Moyenne générale
            y += 12;
            pdf.setFillColor(niveauColor.r, niveauColor.g, niveauColor.b);
            pdf.roundedRect(14, y - 5, pageWidth - 28, 20, 3, 3, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('MOYENNE GÉNÉRALE', 20, y + 6);
            pdf.setFontSize(18);
            pdf.text(`${moyenne.toFixed(2)}/20`, 155, y + 6);

            // Appréciation
            y += 30;
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Appréciation générale:', 20, y);
            
            pdf.setFontSize(16);
            const hexColor = appreciation.color;
            const r = parseInt(hexColor.slice(1, 3), 16);
            const g = parseInt(hexColor.slice(3, 5), 16);
            const b = parseInt(hexColor.slice(5, 7), 16);
            pdf.setTextColor(r, g, b);
            pdf.text(appreciation.text, 80, y);

            // Signature
            y += 20;
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Signature du Responsable Scientifique:', 14, y);
            pdf.line(14, y + 15, 80, y + 15);

            pdf.text('Date:', 140, y);
            pdf.text(new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            }), 155, y);

            // Pied de page
            pdf.setFontSize(8);
            pdf.setTextColor(128, 128, 128);
            pdf.text('SEFIMAP - Bulletin généré automatiquement', pageWidth / 2, 285, { align: 'center' });

            // Télécharger
            const fileName = `bulletin_${note.inscription?.nom}_${note.inscription?.prenom}.pdf`;
            pdf.save(fileName.replace(/\s+/g, '_'));
        } catch (err) {
            console.error('Erreur génération bulletin:', err);
            alert('Erreur lors de la génération du bulletin');
        } finally {
            setExporting(false);
        }
    }, [getDortoirNom]);

    // Générer tous les bulletins
    const genererTousBulletins = useCallback(async () => {
        if (participantsFiltres.length === 0) {
            alert('Aucun participant avec des notes à exporter');
            return;
        }

        setExporting(true);
        try {
            for (const note of participantsFiltres) {
                await genererBulletin(note);
                // Petite pause entre chaque génération
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } finally {
            setExporting(false);
        }
    }, [participantsFiltres, genererBulletin]);

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
                                                        onClick={() => genererBulletin(note)}
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
