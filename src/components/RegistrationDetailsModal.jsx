import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LazyImage } from "@/components/ui/lazy-image";
import { X, CheckCircle, Edit, Trash2, Save, User, MapPin, Calendar, Phone, GraduationCap, Building, BookOpen } from "lucide-react";

// Mapping niveau formation
const niveauFormationMap = {
    debutant: "Débutant",
    normal: "Normal",
    superieur: "Supérieur"
};

export function RegistrationDetailsModal({
    isOpen,
    onClose,
    registration,
    onValidate,
    onDelete,
    onUpdate,
    chefsQuartier,
    dortoirs = [],
    statusConfig
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});

    // Initialiser les données du formulaire quand l'inscription change
    useEffect(() => {
        if (registration?.originalData) {
            setFormData({
                ...registration.originalData,
                niveau_etude: registration.originalData.niveau_etude || "aucun",
                chef_quartier_id: registration.originalData.chef_quartier_id || "",
                dortoir_id: registration.originalData.dortoir_id || "",
                niveau_formation: registration.originalData.niveau_formation || ""
            });
        }
        setIsEditing(false);
    }, [registration]);

    if (!isOpen || !registration) return null;

    // Vérifier si les champs obligatoires pour validation sont remplis
    // Ces champs sont obligatoires UNIQUEMENT pour les inscriptions "en_ligne" (depuis chef de quartier)
    const isOnlineRegistration = registration.originalData?.type_inscription === 'en_ligne';
    const canValidate = !isOnlineRegistration || (formData.dortoir_id && formData.niveau_formation);

    const handleSave = async () => {
        await onUpdate(registration.id, formData);
        setIsEditing(false);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Trouver le nom du dortoir
    const getDortoirName = () => {
        const dortoir = dortoirs.find(d => d.id === registration.originalData?.dortoir_id);
        return dortoir?.nom || "Non assigné";
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h3 className="text-xl font-bold text-text-main dark:text-white flex items-center gap-2">
                            {isEditing ? "Modifier l'inscription" : "Détails de l'inscription"}
                            {!isEditing && (
                                <Badge variant={statusConfig[registration.statut]?.variant || "default"}>
                                    {statusConfig[registration.statut]?.label || registration.statut}
                                </Badge>
                            )}
                        </h3>
                        <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                            Créé le {registration.date} • {registration.originalData?.type_inscription === 'en_ligne' ? 'Inscription en ligne' : 'Inscription présentielle'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-secondary hover:text-text-main dark:hover:text-white transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* Photo Section */}
                    <div className="mb-6 flex justify-center">
                        <div className="relative">
                            {registration.originalData?.photo_url ? (
                                <LazyImage
                                    src={registration.originalData.photo_url}
                                    alt={`Photo de ${registration.originalData.nom} ${registration.originalData.prenom}`}
                                    className="w-32 h-32 rounded-full border-4 border-primary/20 shadow-lg"
                                    fallback={
                                        <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold">
                                            {registration.originalData.nom?.[0]?.toUpperCase()}
                                            {registration.originalData.prenom?.[0]?.toUpperCase()}
                                        </div>
                                    }
                                />
                            ) : (
                                <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-4 border-gray-100 dark:border-gray-600 shadow-md">
                                    <User className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                                </div>
                            )}
                            {/* Status Badge on Photo */}
                            <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm ${registration.statut === 'valide'
                                ? 'bg-emerald-500'
                                : registration.statut === 'rejete'
                                    ? 'bg-red-500'
                                    : 'bg-amber-500'
                                }`}>
                                {registration.statut === 'valide' ? (
                                    <CheckCircle className="w-4 h-4 text-white" />
                                ) : registration.statut === 'rejete' ? (
                                    <X className="w-4 h-4 text-white" />
                                ) : (
                                    <span className="text-white text-xs font-bold">?</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {isEditing ? (
                        // EDIT FORM
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nom</Label>
                                <Input
                                    value={formData.nom || ""}
                                    onChange={e => handleChange("nom", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Prénoms</Label>
                                <Input
                                    value={formData.prenom || ""}
                                    onChange={e => handleChange("prenom", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Âge</Label>
                                <Input
                                    type="number"
                                    value={formData.age || ""}
                                    onChange={e => handleChange("age", e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Genre</Label>
                                <Select
                                    value={formData.sexe || ""}
                                    onChange={e => handleChange("sexe", e.target.value)}
                                >
                                    <option value="homme">Homme</option>
                                    <option value="femme">Femme</option>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Téléphone</Label>
                                <Input
                                    value={formData.telephone || ""}
                                    onChange={e => handleChange("telephone", e.target.value)}
                                    placeholder="Non renseigné"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Niveau d'étude</Label>
                                <Select
                                    value={formData.niveau_etude || ""}
                                    onChange={e => handleChange("niveau_etude", e.target.value)}
                                >
                                    <option value="aucun">Aucun</option>
                                    <option value="primaire">Primaire</option>
                                    <option value="secondaire">Secondaire</option>
                                    <option value="superieur">Universitaire</option>
                                    <option value="arabe">Arabe</option>
                                </Select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Chef de Quartier</Label>
                                <Select
                                    value={formData.chef_quartier_id || ""}
                                    onChange={e => handleChange("chef_quartier_id", e.target.value)}
                                >
                                    <option value="">Sélectionner un chef</option>
                                    {chefsQuartier?.map(chef => (
                                        <option key={chef.id} value={chef.id}>
                                            {chef.nom_complet} ({chef.zone})
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            {/* Nouveaux champs obligatoires pour validation */}
                            <div className="md:col-span-2 mt-4 pt-4 border-t border-border-light dark:border-border-dark">
                                <h4 className="font-semibold text-text-main dark:text-white mb-3 flex items-center gap-2">
                                    <Building className="w-4 h-4 text-primary" />
                                    Affectation (obligatoire pour valider)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>
                                            Salle de dortoir <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={formData.dortoir_id || ""}
                                            onChange={e => handleChange("dortoir_id", e.target.value)}
                                            className={!formData.dortoir_id ? "border-amber-500" : ""}
                                        >
                                            <option value="">Sélectionner un dortoir</option>
                                            {dortoirs?.map(dortoir => (
                                                <option key={dortoir.id} value={dortoir.id}>
                                                    {dortoir.nom}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>
                                            Niveau de formation <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={formData.niveau_formation || ""}
                                            onChange={e => handleChange("niveau_formation", e.target.value)}
                                            className={!formData.niveau_formation ? "border-amber-500" : ""}
                                        >
                                            <option value="">Sélectionner un niveau</option>
                                            <option value="debutant">Débutant</option>
                                            <option value="normal">Normal</option>
                                            <option value="superieur">Supérieur</option>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>Statut</Label>
                                <Select
                                    value={formData.statut || ""}
                                    onChange={e => handleChange("statut", e.target.value)}
                                >
                                    <option value="en_attente">En attente</option>
                                    <option value="valide">Validé</option>
                                    <option value="rejete">Rejeté</option>
                                </Select>
                            </div>

                            <div className="md:col-span-2 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                                    <span className="font-bold">Attention:</span> Modifier ces informations mettra à jour directement la base de données.
                                </p>
                            </div>
                        </div>
                    ) : (
                        // VIEW MODE
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 flex items-center justify-center text-primary font-bold text-xs mt-0.5 border-2 rounded border-primary">
                                        ID
                                    </span>
                                    <div>
                                        <p className="text-sm text-text-secondary">Identifiant</p>
                                        <p className="font-semibold text-lg text-primary">
                                            {registration.reference_id || '-'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <User className="w-5 h-5 text-text-secondary mt-0.5" />
                                    <div>
                                        <p className="text-sm text-text-secondary">Nom complet</p>
                                        <p className="font-medium text-lg text-text-main dark:text-white">
                                            {registration.originalData?.nom} {registration.originalData?.prenom}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="w-5 h-5 flex items-center justify-center text-text-secondary font-bold text-xs mt-0.5 border rounded-full border-current">
                                        {registration.originalData?.sexe === 'homme' ? 'H' : 'F'}
                                    </span>
                                    <div>
                                        <p className="text-sm text-text-secondary">Genre & Âge</p>
                                        <p className="font-medium text-text-main dark:text-white">
                                            {registration.originalData?.sexe === 'homme' ? 'Homme' : 'Femme'}, {registration.originalData?.age} ans
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Phone className="w-5 h-5 text-text-secondary mt-0.5" />
                                    <div>
                                        <p className="text-sm text-text-secondary">Téléphone</p>
                                        <p className="font-medium text-text-main dark:text-white">
                                            {registration.originalData?.telephone || "Non renseigné"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <GraduationCap className="w-5 h-5 text-text-secondary mt-0.5" />
                                    <div>
                                        <p className="text-sm text-text-secondary">Niveau d'étude</p>
                                        <p className="font-medium text-text-main dark:text-white">
                                            {registration.niveau}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-text-secondary mt-0.5" />
                                    <div>
                                        <p className="text-sm text-text-secondary">Chef de quartier / Zone</p>
                                        <p className="font-medium text-text-main dark:text-white">
                                            {registration.chefQuartier}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Calendar className="w-5 h-5 text-text-secondary mt-0.5" />
                                    <div>
                                        <p className="text-sm text-text-secondary">Date d'inscription</p>
                                        <p className="font-medium text-text-main dark:text-white">
                                            {registration.date}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Section Affectation - ÉDITABLE DIRECTEMENT */}
                            <div className="md:col-span-2 mt-4 pt-4 border-t border-border-light dark:border-border-dark">
                                <h4 className="font-semibold text-text-main dark:text-white mb-4 flex items-center gap-2">
                                    <Building className="w-4 h-4 text-primary" />
                                    Affectation
                                    {isOnlineRegistration && registration.statut === 'en_attente' && (
                                        <span className="text-xs font-normal text-amber-500 ml-2">
                                            (Requis pour valider)
                                        </span>
                                    )}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-text-secondary">
                                            <Building className="w-4 h-4" />
                                            Salle de dortoir
                                            {isOnlineRegistration && <span className="text-red-500">*</span>}
                                        </Label>
                                        <Select
                                            value={formData.dortoir_id || ""}
                                            onChange={async (e) => {
                                                const newValue = e.target.value;
                                                handleChange("dortoir_id", newValue);
                                                // Sauvegarder immédiatement sans fermer le modal
                                                await onUpdate(registration.id, {
                                                    ...formData,
                                                    dortoir_id: newValue
                                                }, false);
                                            }}
                                            className={!formData.dortoir_id && isOnlineRegistration ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10" : ""}
                                        >
                                            <option value="">Non assigné</option>
                                            {dortoirs?.map(dortoir => (
                                                <option key={dortoir.id} value={dortoir.id}>
                                                    {dortoir.nom}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-text-secondary">
                                            <BookOpen className="w-4 h-4" />
                                            Niveau de formation
                                            {isOnlineRegistration && <span className="text-red-500">*</span>}
                                        </Label>
                                        <Select
                                            value={formData.niveau_formation || ""}
                                            onChange={async (e) => {
                                                const newValue = e.target.value;
                                                handleChange("niveau_formation", newValue);
                                                // Sauvegarder immédiatement sans fermer le modal
                                                await onUpdate(registration.id, {
                                                    ...formData,
                                                    niveau_formation: newValue
                                                }, false);
                                            }}
                                            className={!formData.niveau_formation && isOnlineRegistration ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10" : ""}
                                        >
                                            <option value="">Non assigné</option>
                                            <option value="debutant">Débutant</option>
                                            <option value="normal">Normal</option>
                                            <option value="superieur">Supérieur</option>
                                        </Select>
                                    </div>
                                </div>
                                {/* Message de confirmation */}
                                {formData.dortoir_id && formData.niveau_formation && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        Affectation complète - Vous pouvez valider cette inscription
                                    </p>
                                )}
                            </div>

                            {/* Avertissement si champs manquants pour validation */}
                            {isOnlineRegistration && registration.statut === 'en_attente' && !canValidate && (
                                <div className="md:col-span-2 mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                        <span className="font-bold">⚠️ Action requise:</span>
                                        Veuillez attribuer une salle de dortoir et un niveau de formation avant de valider cette inscription.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/50 flex flex-wrap justify-end gap-3">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={() => setIsEditing(false)}>
                                Annuler
                            </Button>
                            <Button onClick={handleSave} className="gap-2">
                                <Save className="w-4 h-4" />
                                Enregistrer
                            </Button>
                        </>
                    ) : (
                        <>
                            {statusConfig && registration.statut === "en_attente" && (
                                <Button
                                    className={`gap-2 ${canValidate ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                    disabled={!canValidate}
                                    onClick={() => {
                                        if (canValidate) {
                                            onValidate(registration.id);
                                            onClose();
                                        }
                                    }}
                                    title={!canValidate ? "Attribuez d'abord un dortoir et un niveau de formation" : "Valider l'inscription"}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Valider
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => setIsEditing(true)} className="gap-2">
                                <Edit className="w-4 h-4" />
                                Modifier
                            </Button>
                            <Button variant="destructive" onClick={() => onDelete(registration.id)} className="gap-2">
                                <Trash2 className="w-4 h-4" />
                                Supprimer
                            </Button>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}
