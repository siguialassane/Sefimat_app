import { useState, useMemo, useCallback } from "react";
import { Search, Save, User, Filter, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useData } from "@/contexts";
import { supabase } from "@/lib/supabase";

export function GestionNotes() {
    const { notesExamens, classes, dortoirs, updateNoteLocal } = useData();

    const [searchTerm, setSearchTerm] = useState("");
    const [filterNiveau, setFilterNiveau] = useState("all");
    const [filterClasse, setFilterClasse] = useState("all");
    const [editingNotes, setEditingNotes] = useState({});
    const [savingIds, setSavingIds] = useState(new Set());
    const [successIds, setSuccessIds] = useState(new Set());

    // Filtrer les notes
    const notesFiltrees = useMemo(() => {
        return notesExamens
            .filter(note => {
                // Filtre recherche
                if (searchTerm) {
                    const search = searchTerm.toLowerCase();
                    const nom = note.inscription?.nom?.toLowerCase() || '';
                    const prenom = note.inscription?.prenom?.toLowerCase() || '';
                    if (!nom.includes(search) && !prenom.includes(search)) {
                        return false;
                    }
                }
                // Filtre niveau
                if (filterNiveau !== 'all' && note.niveau_attribue !== filterNiveau) {
                    return false;
                }
                // Filtre classe
                if (filterClasse !== 'all' && String(note.classe_id) !== filterClasse) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                // Trier par classe puis par nom
                if (a.classe?.nom !== b.classe?.nom) {
                    return (a.classe?.nom || '').localeCompare(b.classe?.nom || '');
                }
                return (a.inscription?.nom || '').localeCompare(b.inscription?.nom || '');
            });
    }, [notesExamens, searchTerm, filterNiveau, filterClasse]);

    // Obtenir le nom du dortoir
    const getDortoirNom = useCallback((dortoirId) => {
        const dortoir = dortoirs.find(d => d.id === dortoirId);
        return dortoir?.nom || '-';
    }, [dortoirs]);

    // Validation de la note (0-20)
    const validateNote = useCallback((value) => {
        if (value === '' || value === undefined) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        if (num < 0) return '0';
        if (num > 20) return '20';
        return value;
    }, []);

    // Suivre si l'utilisateur a manuellement modifié la conduite
    const [conduiteModifieeManuel, setConduiteModifieeManuel] = useState(new Set());

    // Gérer les changements de notes avec validation
    // Si on modifie la note cahiers, dupliquer automatiquement vers conduite
    const handleNoteChange = useCallback((noteId, field, value) => {
        const validatedValue = validateNote(value);
        
        setEditingNotes(prev => {
            const newEdits = {
                ...prev,
                [noteId]: {
                    ...prev[noteId],
                    [field]: validatedValue
                }
            };
            
            // Si c'est la note cahiers, dupliquer vers conduite (sauf si modifiée manuellement)
            if (field === 'note_cahiers' && !conduiteModifieeManuel.has(noteId)) {
                newEdits[noteId].note_conduite = validatedValue;
            }
            
            // Si l'utilisateur modifie manuellement la conduite, marquer comme modifié
            if (field === 'note_conduite') {
                setConduiteModifieeManuel(prev => new Set([...prev, noteId]));
            }
            
            return newEdits;
        });
    }, [validateNote, conduiteModifieeManuel]);

    // Calculer la moyenne en temps réel pour une note
    const calculatePreviewMoyenne = useCallback((note) => {
        const noteEntree = note.note_entree;
        const noteCahiers = editingNotes[note.id]?.note_cahiers !== undefined
            ? parseFloat(editingNotes[note.id].note_cahiers)
            : note.note_cahiers;
        const noteConduite = editingNotes[note.id]?.note_conduite !== undefined
            ? parseFloat(editingNotes[note.id].note_conduite)
            : note.note_conduite;
        const noteSortie = editingNotes[note.id]?.note_sortie !== undefined
            ? parseFloat(editingNotes[note.id].note_sortie)
            : note.note_sortie;

        // Si toutes les notes sont présentes, calculer la moyenne
        if (noteEntree != null && !isNaN(noteCahiers) && !isNaN(noteConduite) && !isNaN(noteSortie)) {
            return ((noteEntree + noteCahiers + noteConduite + noteSortie) / 4).toFixed(2);
        }
        return null;
    }, [editingNotes]);

    // Sauvegarder les notes
    const handleSaveNotes = useCallback(async (noteId) => {
        const edits = editingNotes[noteId];
        if (!edits || Object.keys(edits).length === 0) return;

        setSavingIds(prev => new Set([...prev, noteId]));

        try {
            // Préparer les mises à jour
            const updates = {};
            if (edits.note_cahiers !== undefined) {
                const val = parseFloat(edits.note_cahiers);
                if (!isNaN(val) && val >= 0 && val <= 20) {
                    updates.note_cahiers = val;
                }
            }
            if (edits.note_conduite !== undefined) {
                const val = parseFloat(edits.note_conduite);
                if (!isNaN(val) && val >= 0 && val <= 20) {
                    updates.note_conduite = val;
                }
            }
            if (edits.note_sortie !== undefined) {
                const val = parseFloat(edits.note_sortie);
                if (!isNaN(val) && val >= 0 && val <= 20) {
                    updates.note_sortie = val;
                }
            }

            if (Object.keys(updates).length === 0) return;

            updates.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('notes_examens')
                .update(updates)
                .eq('id', noteId)
                .select(`
                    *,
                    inscription:inscriptions(id, nom, prenom, photo_url, sexe, age, dortoir_id),
                    classe:classes(id, nom, niveau, numero)
                `)
                .single();

            if (error) throw error;

            // Mettre à jour localement
            updateNoteLocal(noteId, data);

            // Nettoyer les éditions
            setEditingNotes(prev => {
                const newEdits = { ...prev };
                delete newEdits[noteId];
                return newEdits;
            });

            // Marquer succès
            setSuccessIds(prev => new Set([...prev, noteId]));
            setTimeout(() => {
                setSuccessIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(noteId);
                    return newSet;
                });
            }, 2000);

        } catch (err) {
            console.error('Erreur sauvegarde notes:', err);
            alert(`Erreur: ${err.message}`);
        } finally {
            setSavingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(noteId);
                return newSet;
            });
        }
    }, [editingNotes, updateNoteLocal]);

    // Obtenir la valeur actuelle d'une note (édition ou originale)
    const getNoteValue = useCallback((note, field) => {
        if (editingNotes[note.id]?.[field] !== undefined) {
            return editingNotes[note.id][field];
        }
        return note[field] ?? '';
    }, [editingNotes]);

    // Badge couleur pour la moyenne (supporte preview en temps réel)
    const getMoyenneBadge = useCallback((moyenne, previewMoyenne = null) => {
        const displayMoyenne = previewMoyenne !== null ? previewMoyenne : moyenne;
        if (displayMoyenne === null || displayMoyenne === undefined) {
            return <span className="text-text-secondary">-</span>;
        }
        const moy = parseFloat(displayMoyenne);
        let variant = 'destructive';
        if (moy >= 15) variant = 'success';
        else if (moy >= 10) variant = 'warning';

        // Indiquer si c'est une prévisualisation
        const isPreview = previewMoyenne !== null && previewMoyenne !== moyenne;
        return (
            <Badge variant={variant} className={isPreview ? "ring-2 ring-blue-400" : ""}>
                {moy.toFixed(2)}
                {isPreview && <span className="ml-1 text-xs">*</span>}
            </Badge>
        );
    }, []);

    const niveauLabels = {
        niveau_1: { label: 'Niveau 1', color: 'destructive' },
        niveau_2: { label: 'Niveau 2', color: 'warning' },
        niveau_3: { label: 'Niveau 3', color: 'default' },
        niveau_superieur: { label: 'Niveau Supérieur', color: 'success' },
    };

    // Calculer le rang d'un participant dans sa classe
    const calculerRang = useCallback((note) => {
        if (!note.moyenne || !note.classe_id) return '-';

        // Filtrer les participants de la même classe avec une moyenne
        const memeClasse = notesExamens.filter(n =>
            n.classe_id === note.classe_id &&
            n.moyenne !== null &&
            n.moyenne !== undefined
        );

        // Trier par moyenne décroissante
        const triee = [...memeClasse].sort((a, b) => parseFloat(b.moyenne) - parseFloat(a.moyenne));

        // Trouver le rang
        const rang = triee.findIndex(n => n.id === note.id) + 1;

        if (rang === 0) return '-';
        if (rang === 1) return '1er';
        return `${rang}ème`;
    }, [notesExamens]);

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-main dark:text-white">
                    Gestion des notes
                </h1>
                <p className="text-text-secondary mt-1">
                    Saisir les notes des cahiers, conduite et examen de sortie
                </p>
            </div>

            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                    <Input
                        placeholder="Rechercher un participant..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2">
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
            </div>

            {/* Tableau des notes */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Participants ({notesFiltrees.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {notesFiltrees.length === 0 ? (
                        <div className="text-center py-12">
                            <Filter className="h-12 w-12 text-text-secondary mx-auto mb-4" />
                            <p className="text-text-secondary">
                                Aucun participant avec une note d'entrée
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border-light dark:border-border-dark">
                                        <th className="text-left py-3 px-2 text-sm font-medium text-text-secondary">Participant</th>
                                        <th className="text-left py-3 px-2 text-sm font-medium text-text-secondary">Classe</th>
                                        <th className="text-center py-3 px-2 text-sm font-medium text-text-secondary">Entrée</th>
                                        <th className="text-center py-3 px-2 text-sm font-medium text-text-secondary">Cahiers</th>
                                        <th className="text-center py-3 px-2 text-sm font-medium text-text-secondary">Conduite</th>
                                        <th className="text-center py-3 px-2 text-sm font-medium text-text-secondary">Sortie</th>
                                        <th className="text-center py-3 px-2 text-sm font-medium text-text-secondary">Moyenne</th>
                                        <th className="text-center py-3 px-2 text-sm font-medium text-text-secondary">Rang</th>
                                        <th className="text-center py-3 px-2 text-sm font-medium text-text-secondary">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {notesFiltrees.map((note) => {
                                        const isSaving = savingIds.has(note.id);
                                        const isSuccess = successIds.has(note.id);
                                        const hasEdits = editingNotes[note.id] && Object.keys(editingNotes[note.id]).length > 0;

                                        return (
                                            <tr
                                                key={note.id}
                                                className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-white/5"
                                            >
                                                <td className="py-3 px-2">
                                                    <div className="flex items-center gap-2">
                                                        {note.inscription?.photo_url ? (
                                                            <img
                                                                src={note.inscription.photo_url}
                                                                alt=""
                                                                className="h-8 w-8 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                                <User className="h-4 w-4 text-blue-600" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-sm text-text-main dark:text-white">
                                                                {note.inscription?.nom} {note.inscription?.prenom}
                                                            </p>
                                                            <p className="text-xs text-text-secondary">
                                                                {getDortoirNom(note.inscription?.dortoir_id)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <Badge variant={niveauLabels[note.niveau_attribue]?.color || 'default'}>
                                                        {note.classe?.nom || '-'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-2 text-center">
                                                    <span className="font-medium text-text-main dark:text-white">
                                                        {note.note_entree?.toFixed(1) || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="20"
                                                        step="0.5"
                                                        placeholder="-"
                                                        value={getNoteValue(note, 'note_cahiers')}
                                                        onChange={(e) => handleNoteChange(note.id, 'note_cahiers', e.target.value)}
                                                        className="w-16 text-center"
                                                        disabled={isSaving}
                                                    />
                                                </td>
                                                <td className="py-3 px-2">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="20"
                                                        step="0.5"
                                                        placeholder="-"
                                                        value={getNoteValue(note, 'note_conduite')}
                                                        onChange={(e) => handleNoteChange(note.id, 'note_conduite', e.target.value)}
                                                        className="w-16 text-center"
                                                        disabled={isSaving}
                                                    />
                                                </td>
                                                <td className="py-3 px-2">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="20"
                                                        step="0.5"
                                                        placeholder="-"
                                                        value={getNoteValue(note, 'note_sortie')}
                                                        onChange={(e) => handleNoteChange(note.id, 'note_sortie', e.target.value)}
                                                        className="w-16 text-center"
                                                        disabled={isSaving}
                                                    />
                                                </td>
                                                <td className="py-3 px-2 text-center">
                                                    {getMoyenneBadge(note.moyenne, calculatePreviewMoyenne(note))}
                                                </td>
                                                <td className="py-3 px-2 text-center">
                                                    <span className="font-medium text-text-main dark:text-white">
                                                        {calculerRang(note)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-center">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveNotes(note.id)}
                                                        disabled={isSaving || !hasEdits}
                                                        variant={isSuccess ? "default" : "outline"}
                                                        className={isSuccess ? "bg-green-600 hover:bg-green-600" : ""}
                                                    >
                                                        {isSaving ? (
                                                            <span className="animate-spin">⏳</span>
                                                        ) : isSuccess ? (
                                                            <CheckCircle className="h-4 w-4" />
                                                        ) : (
                                                            <Save className="h-4 w-4" />
                                                        )}
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
