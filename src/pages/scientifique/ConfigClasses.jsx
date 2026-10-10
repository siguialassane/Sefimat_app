import { useState, useCallback } from "react";
import { Save, Settings, Users, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts";
import { supabase } from "@/lib/supabase";
import { getSeuilsMap, plageNiveau, validerSeuils, NOTE_MIN, NOTE_MAX } from "@/lib/niveaux";
import { sansPepiniereNotes } from "@/lib/scientifique";
import { notify } from "@/components/ui/toast";

export function ConfigClasses() {
    const { configCapaciteClasses, configSeuilsNiveaux, classes, notesExamens, refresh } = useData();

    const [editedCapacites, setEditedCapacites] = useState({});
    const [editedSeuils, setEditedSeuils] = useState({});
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Calculer les stats par niveau
    const getStatsNiveau = useCallback((niveau) => {
        const classesDuNiveau = classes.filter(c => c.niveau === niveau);
        const effectifTotal = sansPepiniereNotes(notesExamens).filter(n => n.niveau_attribue === niveau).length;
        const capaciteTotale = classesDuNiveau.reduce((acc, c) => acc + c.capacite, 0);
        return {
            nbClasses: classesDuNiveau.length,
            effectif: effectifTotal,
            capaciteTotale
        };
    }, [classes, notesExamens]);

    // Obtenir la valeur actuelle (éditée ou originale)
    const getCapaciteValue = useCallback((niveau) => {
        if (editedCapacites[niveau] !== undefined) {
            return editedCapacites[niveau];
        }
        const config = configCapaciteClasses.find(c => c.niveau === niveau);
        return config?.capacite || 10;
    }, [editedCapacites, configCapaciteClasses]);

    // Gérer les changements
    const handleCapaciteChange = useCallback((niveau, value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 1) return;
        setEditedCapacites(prev => ({
            ...prev,
            [niveau]: numValue
        }));
    }, []);

    // Seuils effectifs (éditions en cours + config chargée + défauts)
    const seuilsEffectifs = useCallback(() => {
        const base = getSeuilsMap(configSeuilsNiveaux);
        return { ...base, ...editedSeuils };
    }, [configSeuilsNiveaux, editedSeuils]);

    // Obtenir la valeur actuelle d'un seuil (édité ou configuré)
    const getSeuilValue = useCallback((niveau) => {
        if (editedSeuils[niveau] !== undefined) {
            return editedSeuils[niveau];
        }
        const config = configSeuilsNiveaux.find(c => c.niveau === niveau);
        return config ? parseFloat(config.note_max) : getSeuilsMap([])[niveau];
    }, [editedSeuils, configSeuilsNiveaux]);

    // Gérer les changements de seuil
    const handleSeuilChange = useCallback((niveau, value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        setEditedSeuils(prev => ({
            ...prev,
            [niveau]: numValue
        }));
    }, []);

    // Sauvegarder les capacités et les seuils
    const handleSave = useCallback(async () => {
        if (Object.keys(editedCapacites).length === 0 && Object.keys(editedSeuils).length === 0) return;

        setSaving(true);
        setSuccess(false);

        try {
            // Valider les seuils si modifiés (0 < N1 < N2 < N3 < 20)
            if (Object.keys(editedSeuils).length > 0) {
                const effectifs = seuilsEffectifs();
                const erreur = validerSeuils(effectifs.niveau_1, effectifs.niveau_2, effectifs.niveau_3);
                if (erreur) {
                    notify.error(erreur, { title: "Seuils invalides" });
                    setSaving(false);
                    return;
                }
            }

            // Mettre à jour chaque capacité modifiée
            for (const [niveau, capacite] of Object.entries(editedCapacites)) {
                const { error } = await supabase
                    .from('config_capacite_classes')
                    .update({ capacite, updated_at: new Date().toISOString() })
                    .eq('niveau', niveau);

                if (error) throw error;
            }

            // Mettre à jour chaque seuil modifié
            for (const [niveau, noteMax] of Object.entries(editedSeuils)) {
                const { error } = await supabase
                    .from('config_seuils_niveaux')
                    .update({ note_max: noteMax, updated_at: new Date().toISOString() })
                    .eq('niveau', niveau);

                if (error) throw error;
            }

            // Recharger les données
            await refresh();

            // Nettoyer les éditions
            setEditedCapacites({});
            setEditedSeuils({});
            setSuccess(true);
            notify.success("Capacités et seuils des niveaux mis à jour.", { title: "Configuration enregistrée" });

            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Erreur sauvegarde config:', err);
            notify.error(err.message || "Erreur de sauvegarde", { title: "Enregistrement impossible" });
        } finally {
            setSaving(false);
        }
    }, [editedCapacites, editedSeuils, seuilsEffectifs, refresh]);

    const hasChanges = Object.keys(editedCapacites).length > 0 || Object.keys(editedSeuils).length > 0;

    const niveaux = [
        { key: 'niveau_1', label: 'Niveau 1', color: 'bg-red-500' },
        { key: 'niveau_2', label: 'Niveau 2', color: 'bg-orange-500' },
        { key: 'niveau_3', label: 'Niveau 3', color: 'bg-yellow-500' },
        { key: 'niveau_superieur', label: 'Niveau Supérieur', color: 'bg-green-500' },
    ];

    // Libellé dynamique "Note X à Y" à partir des seuils effectifs
    const getPlageLabel = useCallback((niveauKey) => {
        const rows = [
            { niveau: 'niveau_1', note_max: seuilsEffectifs().niveau_1 },
            { niveau: 'niveau_2', note_max: seuilsEffectifs().niveau_2 },
            { niveau: 'niveau_3', note_max: seuilsEffectifs().niveau_3 },
        ];
        const plage = plageNiveau(niveauKey, rows);
        const fmt = (v) => String(v).replace('.', ',');
        return `Note ${fmt(plage.min)} à ${fmt(plage.max)}`;
    }, [seuilsEffectifs]);

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white">
                        Configuration des classes
                    </h1>
                    <p className="text-text-secondary mt-1">
                        Définir la capacité maximale par niveau et les seuils de notes d'entrée
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className={success ? "bg-green-600 hover:bg-green-600" : ""}
                >
                    {saving ? (
                        <>
                            <span className="animate-spin mr-2">⏳</span>
                            Enregistrement...
                        </>
                    ) : success ? (
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
            </div>

            {/* Info */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                        <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                            <p>
                                La capacité définit le nombre maximum de participants par classe.
                                Lorsqu'une classe est pleine, une nouvelle classe est automatiquement créée
                                (ex: Niveau 1-A, puis Niveau 1-B, etc.).
                            </p>
                            <p className="mt-2">
                                Les seuils définissent la note maximale d'entrée de chaque niveau :
                                une note inférieure ou égale au seuil va dans ce niveau,
                                au-delà du seuil du Niveau 3 le participant va au Niveau Supérieur.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Configuration par niveau */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {niveaux.map(niveau => {
                    const stats = getStatsNiveau(niveau.key);
                    const capacite = getCapaciteValue(niveau.key);
                    const isEdited = editedCapacites[niveau.key] !== undefined;
                    const seuilEdited = editedSeuils[niveau.key] !== undefined;
                    const showSeuil = niveau.key !== 'niveau_superieur';

                    return (
                        <Card key={niveau.key} className={(isEdited || seuilEdited) ? 'ring-2 ring-blue-500' : ''}>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className={`h-4 w-4 rounded-full ${niveau.color}`} />
                                    <div>
                                        <CardTitle>{niveau.label}</CardTitle>
                                        <CardDescription>{getPlageLabel(niveau.key)}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Capacité */}
                                <div>
                                    <Label htmlFor={`capacite-${niveau.key}`}>
                                        Capacité par classe
                                    </Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Input
                                            id={`capacite-${niveau.key}`}
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={capacite}
                                            onChange={(e) => handleCapaciteChange(niveau.key, e.target.value)}
                                            className="w-24"
                                        />
                                        <span className="text-text-secondary text-sm">participants max</span>
                                    </div>
                                </div>

                                {/* Seuil de note maximale */}
                                {showSeuil && (
                                    <div>
                                        <Label htmlFor={`seuil-${niveau.key}`}>
                                            Note maximale d'entrée
                                        </Label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Input
                                                id={`seuil-${niveau.key}`}
                                                type="number"
                                                min="1"
                                                max="19"
                                                step="0.5"
                                                value={getSeuilValue(niveau.key)}
                                                onChange={(e) => handleSeuilChange(niveau.key, e.target.value)}
                                                className="w-24"
                                            />
                                            <span className="text-text-secondary text-sm">/ 20</span>
                                        </div>
                                    </div>
                                )}

                                {/* Stats */}
                                <div className="pt-4 border-t border-border-light dark:border-border-dark space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-secondary">Classes créées</span>
                                        <Badge variant="secondary">{stats.nbClasses}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-secondary">Effectif total</span>
                                        <span className="font-medium text-text-main dark:text-white">
                                            {stats.effectif}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-text-secondary">Capacité totale</span>
                                        <span className="font-medium text-text-main dark:text-white">
                                            {stats.capaciteTotale}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Liste des classes existantes */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Classes existantes ({classes.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {classes.length === 0 ? (
                        <p className="text-center text-text-secondary py-4">
                            Aucune classe créée pour le moment
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {classes.map(classe => {
                                const effectif = sansPepiniereNotes(notesExamens).filter(n => n.classe_id === classe.id).length;
                                const tauxRemplissage = classe.capacite > 0 ? (effectif / classe.capacite) * 100 : 0;

                                return (
                                    <div
                                        key={classe.id}
                                        className="p-3 rounded-lg border border-border-light dark:border-border-dark"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-text-main dark:text-white">
                                                {classe.nom}
                                            </span>
                                            <span className="text-sm text-text-secondary">
                                                {effectif}/{classe.capacite}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${
                                                    tauxRemplissage >= 100
                                                        ? 'bg-red-500'
                                                        : tauxRemplissage >= 70
                                                        ? 'bg-orange-500'
                                                        : 'bg-green-500'
                                                }`}
                                                style={{ width: `${Math.min(tauxRemplissage, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
