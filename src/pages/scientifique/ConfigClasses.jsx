import { useState, useCallback } from "react";
import { Save, Settings, Users, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts";
import { supabase } from "@/lib/supabase";

export function ConfigClasses() {
    const { configCapaciteClasses, classes, notesExamens, refresh } = useData();

    const [editedCapacites, setEditedCapacites] = useState({});
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Calculer les stats par niveau
    const getStatsNiveau = useCallback((niveau) => {
        const classesDuNiveau = classes.filter(c => c.niveau === niveau);
        const effectifTotal = notesExamens.filter(n => n.niveau_attribue === niveau).length;
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

    // Sauvegarder les capacités
    const handleSave = useCallback(async () => {
        if (Object.keys(editedCapacites).length === 0) return;

        setSaving(true);
        setSuccess(false);

        try {
            // Mettre à jour chaque niveau modifié
            for (const [niveau, capacite] of Object.entries(editedCapacites)) {
                const { error } = await supabase
                    .from('config_capacite_classes')
                    .update({ capacite, updated_at: new Date().toISOString() })
                    .eq('niveau', niveau);

                if (error) throw error;
            }

            // Recharger les données
            await refresh();

            // Nettoyer les éditions
            setEditedCapacites({});
            setSuccess(true);

            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Erreur sauvegarde config:', err);
            alert(`Erreur: ${err.message}`);
        } finally {
            setSaving(false);
        }
    }, [editedCapacites, refresh]);

    const hasChanges = Object.keys(editedCapacites).length > 0;

    const niveaux = [
        { key: 'niveau_1', label: 'Niveau 1', description: 'Note 0 à 5', color: 'bg-red-500' },
        { key: 'niveau_2', label: 'Niveau 2', description: 'Note 5 à 10', color: 'bg-orange-500' },
        { key: 'niveau_3', label: 'Niveau 3', description: 'Note 10 à 14', color: 'bg-yellow-500' },
        { key: 'niveau_superieur', label: 'Niveau Supérieur', description: 'Note 15 à 20', color: 'bg-green-500' },
    ];

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white">
                        Configuration des classes
                    </h1>
                    <p className="text-text-secondary mt-1">
                        Définir la capacité maximale par niveau de formation
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
                                (ex: Niveau 1 - 1, Niveau 1 - 2, etc.).
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

                    return (
                        <Card key={niveau.key} className={isEdited ? 'ring-2 ring-blue-500' : ''}>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className={`h-4 w-4 rounded-full ${niveau.color}`} />
                                    <div>
                                        <CardTitle>{niveau.label}</CardTitle>
                                        <CardDescription>{niveau.description}</CardDescription>
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
                                const effectif = notesExamens.filter(n => n.classe_id === classe.id).length;
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
