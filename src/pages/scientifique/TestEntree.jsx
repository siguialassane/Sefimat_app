import { useState, useMemo, useCallback } from "react";
import { Search, Save, CheckCircle, User, AlertCircle, SaveAll } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useData, useAuth } from "@/contexts";
import { supabase } from "@/lib/supabase";

export function TestEntree() {
    const { user } = useAuth();
    const {
        inscriptions,
        notesExamens,
        classes,
        configCapaciteClasses,
        dortoirs,
        addNoteLocal,
        addClasseLocal,
        refresh,
    } = useData();

    const [searchTerm, setSearchTerm] = useState("");
    const [noteInputs, setNoteInputs] = useState({});
    const [savingIds, setSavingIds] = useState(new Set());
    const [successIds, setSuccessIds] = useState(new Set());
    const [errors, setErrors] = useState({});
    const [savingAll, setSavingAll] = useState(false);

    // Participants validés sans note d'entrée
    const participantsSansNote = useMemo(() => {
        const inscriptionIdsAvecNote = new Set(notesExamens.map(n => n.inscription_id));
        return inscriptions
            .filter(i => {
                // Vérifier que l'inscription est validée
                if (i.statut !== 'valide') return false;
                
                // Vérifier qu'elle n'a pas encore de note
                if (inscriptionIdsAvecNote.has(i.id)) return false;
                
                // Pour les inscriptions président, vérifier que le workflow est terminé
                if (i.created_by === 'president') {
                    return i.workflow_status === 'completed';
                }
                
                // Pour les autres inscriptions, afficher si validées
                return true;
            })
            .filter(i => {
                if (!searchTerm) return true;
                const search = searchTerm.toLowerCase();
                return (
                    i.nom?.toLowerCase().includes(search) ||
                    i.prenom?.toLowerCase().includes(search)
                );
            });
    }, [inscriptions, notesExamens, searchTerm]);

    // Déterminer le niveau selon la note
    const determinerNiveau = useCallback((note) => {
        if (note <= 5) return 'niveau_1';
        if (note <= 10) return 'niveau_2';
        if (note <= 14) return 'niveau_3';
        return 'niveau_superieur';
    }, []);

    // Trouver ou créer une classe disponible
    const trouverOuCreerClasse = useCallback(async (niveau) => {
        // Capacité configurée pour ce niveau
        const config = configCapaciteClasses.find(c => c.niveau === niveau);
        const capacite = config?.capacite || 10;

        // Classes existantes de ce niveau
        const classesDuNiveau = classes
            .filter(c => c.niveau === niveau)
            .sort((a, b) => a.numero - b.numero);

        // Chercher une classe avec de la place
        for (const classe of classesDuNiveau) {
            const effectif = notesExamens.filter(n => n.classe_id === classe.id).length;
            if (effectif < classe.capacite) {
                return classe;
            }
        }

        // Aucune classe disponible, en créer une nouvelle
        const nouveauNumero = classesDuNiveau.length > 0
            ? Math.max(...classesDuNiveau.map(c => c.numero)) + 1
            : 1;

        const { data: nouvelleClasse, error } = await supabase
            .from('classes')
            .insert({
                niveau,
                numero: nouveauNumero,
                capacite,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Erreur création classe: ${error.message}`);
        }

        // Ajouter localement pour mise à jour immédiate
        addClasseLocal(nouvelleClasse);

        return nouvelleClasse;
    }, [classes, notesExamens, configCapaciteClasses, addClasseLocal]);

    // Validation de la note (0-20)
    const validateNote = useCallback((value) => {
        if (value === '' || value === undefined) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        if (num < 0) return '0';
        if (num > 20) return '20';
        return value;
    }, []);

    // Gérer le changement de note avec validation
    const handleNoteInputChange = useCallback((inscriptionId, value) => {
        const validatedValue = validateNote(value);
        setNoteInputs(prev => ({
            ...prev,
            [inscriptionId]: validatedValue
        }));
        // Effacer l'erreur si la note est valide
        if (validatedValue !== '') {
            setErrors(prev => ({ ...prev, [inscriptionId]: null }));
        }
    }, [validateNote]);

    // Enregistrer la note d'entrée
    const handleSaveNote = useCallback(async (inscription) => {
        const noteValue = noteInputs[inscription.id];
        if (noteValue === undefined || noteValue === '') {
            setErrors(prev => ({ ...prev, [inscription.id]: "Veuillez saisir une note" }));
            return false;
        }

        const note = parseFloat(noteValue);
        if (isNaN(note) || note < 0 || note > 20) {
            setErrors(prev => ({ ...prev, [inscription.id]: "Note invalide (0-20)" }));
            return false;
        }

        setSavingIds(prev => new Set([...prev, inscription.id]));
        setErrors(prev => ({ ...prev, [inscription.id]: null }));

        try {
            // Déterminer le niveau
            const niveau = determinerNiveau(note);

            // Trouver ou créer une classe
            const classe = await trouverOuCreerClasse(niveau);

            // Créer l'enregistrement de note
            const { data: nouvelleNote, error } = await supabase
                .from('notes_examens')
                .insert({
                    inscription_id: inscription.id,
                    note_entree: note,
                    niveau_attribue: niveau,
                    classe_id: classe.id,
                    saisi_par: user?.id,
                })
                .select(`
                    *,
                    inscription:inscriptions(id, nom, prenom, photo_url, sexe, age, dortoir_id),
                    classe:classes(id, nom, niveau, numero)
                `)
                .single();

            if (error) {
                throw new Error(error.message);
            }

            // Ajouter localement
            addNoteLocal(nouvelleNote);

            // Marquer comme succès
            setSuccessIds(prev => new Set([...prev, inscription.id]));

            // Nettoyer l'input
            setNoteInputs(prev => {
                const newInputs = { ...prev };
                delete newInputs[inscription.id];
                return newInputs;
            });

            // Retirer le succès après 3 secondes
            setTimeout(() => {
                setSuccessIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(inscription.id);
                    return newSet;
                });
            }, 3000);

            return true;

        } catch (err) {
            console.error('Erreur sauvegarde note:', err);
            setErrors(prev => ({ ...prev, [inscription.id]: err.message }));
            return false;
        } finally {
            setSavingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(inscription.id);
                return newSet;
            });
        }
    }, [noteInputs, user, determinerNiveau, trouverOuCreerClasse, addNoteLocal]);

    // Enregistrer toutes les notes saisies
    const handleSaveAll = useCallback(async () => {
        // Trouver tous les participants avec une note saisie
        const participantsAvecNote = participantsSansNote.filter(p => {
            const noteValue = noteInputs[p.id];
            if (!noteValue) return false;
            const note = parseFloat(noteValue);
            return !isNaN(note) && note >= 0 && note <= 20;
        });

        if (participantsAvecNote.length === 0) {
            alert("Aucune note valide à enregistrer");
            return;
        }

        setSavingAll(true);
        let successCount = 0;
        let errorCount = 0;

        for (const participant of participantsAvecNote) {
            const success = await handleSaveNote(participant);
            if (success) {
                successCount++;
            } else {
                errorCount++;
            }
        }

        setSavingAll(false);

        if (errorCount > 0) {
            alert(`${successCount} note(s) enregistrée(s), ${errorCount} erreur(s)`);
        }
    }, [participantsSansNote, noteInputs, handleSaveNote]);

    // Compter les notes valides saisies
    const notesValidesSaisies = useMemo(() => {
        return participantsSansNote.filter(p => {
            const noteValue = noteInputs[p.id];
            if (!noteValue) return false;
            const note = parseFloat(noteValue);
            return !isNaN(note) && note >= 0 && note <= 20;
        }).length;
    }, [participantsSansNote, noteInputs]);

    // Obtenir le nom du dortoir
    const getDortoirNom = useCallback((dortoirId) => {
        const dortoir = dortoirs.find(d => d.id === dortoirId);
        return dortoir?.nom || '-';
    }, [dortoirs]);

    // Prévisualisation du niveau selon la note entrée
    const getPreviewNiveau = useCallback((inscriptionId) => {
        const noteValue = noteInputs[inscriptionId];
        if (!noteValue) return null;
        const note = parseFloat(noteValue);
        if (isNaN(note) || note < 0 || note > 20) return null;
        return determinerNiveau(note);
    }, [noteInputs, determinerNiveau]);

    const niveauLabels = {
        niveau_1: { label: 'Niveau 1', color: 'destructive' },
        niveau_2: { label: 'Niveau 2', color: 'warning' },
        niveau_3: { label: 'Niveau 3', color: 'default' },
        niveau_superieur: { label: 'Niveau Supérieur', color: 'success' },
    };

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-text-main dark:text-white">
                    Test d'entrée
                </h1>
                <p className="text-text-secondary mt-1">
                    Saisir les notes du test d'entrée pour attribuer automatiquement les niveaux et classes
                </p>
            </div>

            {/* Info sur la logique */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                            <p className="font-medium mb-1">Attribution automatique :</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Note 0 à 5 → <span className="font-semibold">Niveau 1</span></li>
                                <li>Note 5 à 10 → <span className="font-semibold">Niveau 2</span></li>
                                <li>Note 10 à 14 → <span className="font-semibold">Niveau 3</span></li>
                                <li>Note 15 à 20 → <span className="font-semibold">Niveau Supérieur</span></li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Recherche */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <Input
                    placeholder="Rechercher un participant..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Liste des participants */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Participants en attente ({participantsSansNote.length})</span>
                        {notesValidesSaisies > 0 && (
                            <Button
                                onClick={handleSaveAll}
                                disabled={savingAll}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {savingAll ? (
                                    <>
                                        <span className="animate-spin mr-2">⏳</span>
                                        Enregistrement...
                                    </>
                                ) : (
                                    <>
                                        <SaveAll className="h-4 w-4 mr-2" />
                                        Enregistrer tout ({notesValidesSaisies})
                                    </>
                                )}
                            </Button>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {participantsSansNote.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <p className="text-text-secondary">
                                Tous les participants ont déjà une note d'entrée
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border-light dark:border-border-dark">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Participant</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Âge</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Sexe</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Dortoir</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Note /20</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Niveau prévu</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participantsSansNote.map((participant) => {
                                        const previewNiveau = getPreviewNiveau(participant.id);
                                        const isSaving = savingIds.has(participant.id);
                                        const isSuccess = successIds.has(participant.id);
                                        const error = errors[participant.id];

                                        return (
                                            <tr
                                                key={participant.id}
                                                className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-white/5"
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        {participant.photo_url ? (
                                                            <img
                                                                src={participant.photo_url}
                                                                alt={participant.nom}
                                                                className="h-10 w-10 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                                <User className="h-5 w-5 text-blue-600" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-text-main dark:text-white">
                                                                {participant.nom} {participant.prenom}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-text-main dark:text-white">
                                                    {participant.age} ans
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge variant={participant.sexe === 'homme' ? 'default' : 'secondary'}>
                                                        {participant.sexe === 'homme' ? 'H' : 'F'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-text-main dark:text-white">
                                                    {getDortoirNom(participant.dortoir_id)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="20"
                                                        step="0.5"
                                                        placeholder="Note"
                                                        value={noteInputs[participant.id] || ''}
                                                        onChange={(e) => handleNoteInputChange(participant.id, e.target.value)}
                                                        className="w-20"
                                                        disabled={isSaving || savingAll}
                                                    />
                                                    {error && (
                                                        <p className="text-xs text-red-500 mt-1">{error}</p>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {previewNiveau ? (
                                                        <Badge variant={niveauLabels[previewNiveau].color}>
                                                            {niveauLabels[previewNiveau].label}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-text-secondary text-sm">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveNote(participant)}
                                                        disabled={isSaving || savingAll || !noteInputs[participant.id]}
                                                        variant={isSuccess ? "default" : "default"}
                                                        className={isSuccess ? "bg-green-600 hover:bg-green-600" : ""}
                                                    >
                                                        {isSaving ? (
                                                            <>
                                                                <span className="animate-spin mr-2">⏳</span>
                                                                Enregistrement...
                                                            </>
                                                        ) : isSuccess ? (
                                                            <>
                                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                                Enregistré
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Save className="h-4 w-4 mr-2" />
                                                                Enregistrer
                                                            </>
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
