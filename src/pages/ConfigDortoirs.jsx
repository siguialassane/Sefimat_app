import { useState, useEffect, useCallback } from "react";
import { Save, Settings, Bed, CheckCircle, Plus, Trash2, Edit2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function ConfigDortoirs() {
    const [dortoirs, setDortoirs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [editedDortoirs, setEditedDortoirs] = useState({});
    const [inscriptions, setInscriptions] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Charger les dortoirs
            const { data: dortoirsData, error: dortoirsError } = await supabase
                .from('dortoirs')
                .select('*')
                .order('nom');

            if (dortoirsError) throw dortoirsError;
            setDortoirs(dortoirsData || []);

            // Charger les inscriptions avec dortoirs affectés
            const { data: inscriptionsData, error: inscriptionsError } = await supabase
                .from('inscriptions')
                .select('id, nom, prenom, dortoir_id')
                .not('dortoir_id', 'is', null);

            if (inscriptionsError) throw inscriptionsError;
            setInscriptions(inscriptionsData || []);
        } catch (err) {
            console.error('Erreur chargement dortoirs:', err);
            alert(`Erreur: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Obtenir les stats d'un dortoir
    const getDortoirStats = useCallback((dortoirId) => {
        const assigned = inscriptions.filter(i => i.dortoir_id === dortoirId).length;
        return { assigned };
    }, [inscriptions]);

    // Gérer les modifications
    const handleChange = useCallback((dortoirId, field, value) => {
        setEditedDortoirs(prev => ({
            ...prev,
            [dortoirId]: {
                ...prev[dortoirId],
                [field]: field === 'capacite' ? parseInt(value, 10) : value
            }
        }));
    }, []);

    // Obtenir la valeur actuelle (éditée ou originale)
    const getValue = useCallback((dortoir, field) => {
        if (editedDortoirs[dortoir.id]?.[field] !== undefined) {
            return editedDortoirs[dortoir.id][field];
        }
        return dortoir[field];
    }, [editedDortoirs]);

    // Sauvegarder les modifications
    const handleSave = useCallback(async () => {
        if (Object.keys(editedDortoirs).length === 0) return;

        setSaving(true);
        setSuccess(false);

        try {
            // Mettre à jour chaque dortoir modifié
            for (const [dortoirId, changes] of Object.entries(editedDortoirs)) {
                const { error } = await supabase
                    .from('dortoirs')
                    .update({
                        ...changes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', dortoirId);

                if (error) throw error;
            }

            // Recharger les données
            await loadData();

            // Nettoyer les éditions
            setEditedDortoirs({});
            setSuccess(true);

            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Erreur sauvegarde dortoirs:', err);
            alert(`Erreur: ${err.message}`);
        } finally {
            setSaving(false);
        }
    }, [editedDortoirs]);

    // Ajouter un nouveau dortoir
    const handleAddDortoir = useCallback(async () => {
        const nom = prompt("Nom du nouveau dortoir (ex: Dortoir A):");
        if (!nom || nom.trim() === "") return;

        const capaciteStr = prompt("Capacité du dortoir (nombre de places):");
        const capacite = parseInt(capaciteStr, 10);

        if (isNaN(capacite) || capacite < 1) {
            alert("Veuillez entrer une capacité valide (nombre entier >= 1)");
            return;
        }

        try {
            const { error } = await supabase
                .from('dortoirs')
                .insert({
                    nom: nom.trim(),
                    capacite,
                    description: ''
                });

            if (error) throw error;

            await loadData();
            alert(`Dortoir "${nom}" créé avec succès !`);
        } catch (err) {
            console.error('Erreur création dortoir:', err);
            alert(`Erreur: ${err.message}`);
        }
    }, []);

    // Supprimer un dortoir
    const handleDeleteDortoir = useCallback(async (dortoir) => {
        const stats = getDortoirStats(dortoir.id);

        if (stats.assigned > 0) {
            alert(`Impossible de supprimer "${dortoir.nom}" : ${stats.assigned} participant(s) sont affectés à ce dortoir.\nVeuillez d'abord réaffecter ces participants à un autre dortoir.`);
            return;
        }

        if (!confirm(`Êtes-vous sûr de vouloir supprimer le dortoir "${dortoir.nom}" ?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('dortoirs')
                .delete()
                .eq('id', dortoir.id);

            if (error) throw error;

            await loadData();
            alert(`Dortoir "${dortoir.nom}" supprimé avec succès !`);
        } catch (err) {
            console.error('Erreur suppression dortoir:', err);
            alert(`Erreur: ${err.message}`);
        }
    }, [getDortoirStats]);

    const hasChanges = Object.keys(editedDortoirs).length > 0;

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-main dark:text-white">
                        Configuration des dortoirs
                    </h1>
                    <p className="text-text-secondary mt-1">
                        Gérer les dortoirs et leur capacité maximale
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleAddDortoir}
                        variant="outline"
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Nouveau dortoir
                    </Button>
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
            </div>

            {/* Info */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                        <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                            <p>
                                <strong>Modification du nom :</strong> Si vous renommez un dortoir (ex: Dortoir A → Dortoir X),
                                tous les participants affectés à ce dortoir seront automatiquement mis à jour.
                            </p>
                            <p className="mt-2">
                                <strong>Capacité :</strong> Définit le nombre maximum de participants pouvant être affectés au dortoir.
                                Vous ne pourrez pas affecter plus de participants que la capacité définie.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Liste des dortoirs */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-text-secondary">Chargement...</p>
                </div>
            ) : dortoirs.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Bed className="h-16 w-16 text-gray-300 mb-4" />
                        <p className="text-text-main dark:text-white text-lg font-medium">
                            Aucun dortoir configuré
                        </p>
                        <p className="text-text-secondary mb-4">
                            Commencez par ajouter un nouveau dortoir
                        </p>
                        <Button onClick={handleAddDortoir} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Ajouter un dortoir
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dortoirs.map(dortoir => {
                        const stats = getDortoirStats(dortoir.id);
                        const nom = getValue(dortoir, 'nom');
                        const capacite = getValue(dortoir, 'capacite') || 0;
                        const isEdited = editedDortoirs[dortoir.id] !== undefined;
                        const tauxRemplissage = capacite > 0 ? (stats.assigned / capacite) * 100 : 0;

                        let colorClass = 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/10';
                        if (tauxRemplissage >= 100) {
                            colorClass = 'border-red-500/50 bg-red-50 dark:bg-red-900/10';
                        } else if (tauxRemplissage >= 80) {
                            colorClass = 'border-orange-500/50 bg-orange-50 dark:bg-orange-900/10';
                        }

                        return (
                            <Card
                                key={dortoir.id}
                                className={cn(
                                    "transition-all duration-300",
                                    isEdited ? "ring-2 ring-primary shadow-lg" : "",
                                    colorClass
                                )}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1">
                                            <Bed className="h-5 w-5 text-primary flex-shrink-0" />
                                            <CardTitle className="text-base">
                                                {dortoir.nom}
                                            </CardTitle>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteDortoir(dortoir)}
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Nom du dortoir */}
                                    <div className="space-y-2">
                                        <Label htmlFor={`nom-${dortoir.id}`} className="text-xs">
                                            Nom du dortoir
                                        </Label>
                                        <Input
                                            id={`nom-${dortoir.id}`}
                                            value={nom}
                                            onChange={(e) => handleChange(dortoir.id, 'nom', e.target.value)}
                                            className="h-9"
                                        />
                                    </div>

                                    {/* Capacité */}
                                    <div className="space-y-2">
                                        <Label htmlFor={`capacite-${dortoir.id}`} className="text-xs">
                                            Capacité (places)
                                        </Label>
                                        <Input
                                            id={`capacite-${dortoir.id}`}
                                            type="number"
                                            min="1"
                                            value={capacite}
                                            onChange={(e) => handleChange(dortoir.id, 'capacite', e.target.value)}
                                            className="h-9"
                                        />
                                    </div>

                                    {/* Stats */}
                                    <div className="pt-3 border-t border-border-light dark:border-border-dark">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-text-secondary">Occupation</span>
                                            <Badge variant={stats.assigned >= capacite ? "destructive" : "default"}>
                                                {stats.assigned} / {capacite}
                                            </Badge>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-500",
                                                    tauxRemplissage >= 100 ? "bg-red-500" :
                                                    tauxRemplissage >= 80 ? "bg-orange-500" :
                                                    "bg-emerald-500"
                                                )}
                                                style={{ width: `${Math.min(tauxRemplissage, 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-text-secondary mt-2">
                                            {capacite - stats.assigned > 0
                                                ? `${capacite - stats.assigned} places disponibles`
                                                : 'Complet'}
                                        </p>
                                    </div>

                                    {isEdited && (
                                        <div className="pt-2">
                                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                <Edit2 className="h-3 w-3 mr-1" />
                                                Modifié
                                            </Badge>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
