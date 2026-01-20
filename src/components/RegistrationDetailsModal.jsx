import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LazyImage } from "@/components/ui/lazy-image";
import { X, CheckCircle, Edit, Trash2, Save, User, MapPin, Calendar, Phone, GraduationCap, Building, BookOpen, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
    const [dortoirStats, setDortoirStats] = useState([]);

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

    // Charger les statistiques des dortoirs
    useEffect(() => {
        async function loadDortoirStats() {
            const { data, error } = await supabase
                .from('vue_statistiques_dortoirs')
                .select('*')
                .order('nom');

            if (error) {
                console.error('Erreur chargement stats dortoirs:', error);
            } else {
                setDortoirStats(data || []);
            }
        }

        if (isOpen) {
            loadDortoirStats();
        }
    }, [isOpen, formData.dortoir_id]);

    if (!isOpen || !registration) return null;

    // Vérifier si les champs obligatoires pour validation sont remplis
    // Ces champs sont obligatoires UNIQUEMENT pour les inscriptions "en_ligne" (depuis président de section)
    const isOnlineRegistration = registration.originalData?.type_inscription === 'en_ligne';

    // NOTE: Seul le dortoir est requis pour valider une inscription
    // Le niveau_formation sera renseigné plus tard par la section scientifique
    // TODO: Créer une interface pour la section scientifique permettant de compléter les inscriptions
    // en ajoutant le niveau de formation après validation par l'admin
    const canValidate = !isOnlineRegistration || formData.dortoir_id;

    const handleSave = async () => {
        await onUpdate(registration.id, formData);
        setIsEditing(false);
    };

    const handleChange = (field, value) => {
        // Validation spéciale pour l'affectation de dortoir
        if (field === 'dortoir_id' && value) {
            const dortoirStats = getDortoirStats(value);
            const currentDortoirId = registration.originalData?.dortoir_id;

            // Si on change de dortoir (pas le même qu'avant)
            if (value !== currentDortoirId && dortoirStats) {
                if (dortoirStats.nombre_inscrits >= dortoirStats.capacite) {
                    alert(`Le dortoir "${dortoirStats.nom}" est complet (${dortoirStats.nombre_inscrits}/${dortoirStats.capacite}).\nVeuillez choisir un autre dortoir ou augmenter la capacité dans la configuration.`);
                    return; // Bloquer l'affectation
                }
            }
        }

        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Obtenir les stats d'un dortoir
    const getDortoirStats = (dortoirId) => {
        return dortoirStats.find(d => d.id === dortoirId);
    };

    // Trouver le nom du dortoir
    const getDortoirName = () => {
        const dortoir = dortoirs.find(d => d.id === registration.originalData?.dortoir_id);
        return dortoir?.nom || "Non assigné";
    };

    // Vérifier si un dortoir est complet (sauf s'il est déjà affecté à cet participant)
    const isDortoirFull = (dortoirId) => {
        const currentDortoirId = registration.originalData?.dortoir_id;
        if (dortoirId === currentDortoirId) return false; // Permettre de garder le même dortoir

        const stats = getDortoirStats(dortoirId);
        return stats && stats.nombre_inscrits >= stats.capacite;
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
                                    className="w-48 h-48 rounded-lg border-4 border-primary/20 shadow-lg object-cover"
                                    fallback={
                                        <div className="w-48 h-48 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-5xl font-bold">
                                            {registration.originalData.nom?.[0]?.toUpperCase()}
                                            {registration.originalData.prenom?.[0]?.toUpperCase()}
                                        </div>
                                    }
                                />
                            ) : (
                                <div className="w-48 h-48 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-4 border-gray-100 dark:border-gray-600 shadow-md">
                                    <User className="w-20 h-20 text-gray-400 dark:text-gray-500" />
                                </div>
                            )}
                            {/* Status Badge on Photo */}
                            <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm ${registration.statut === 'valide'
                                ? 'bg-emerald-500'
                                : registration.statut === 'rejete'
                                    ? 'bg-red-500'
                                    : 'bg-amber-500'
                                }`}>
                                {registration.statut === 'valide' ? (
                                    <CheckCircle className="w-5 h-5 text-white" />
                                ) : registration.statut === 'rejete' ? (
                                    <X className="w-5 h-5 text-white" />
                                ) : (
                                    <span className="text-white text-sm font-bold">?</span>
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
                                    className="bg-white dark:bg-gray-800 text-text-main dark:text-white"
                                >
                                    <option value="homme">Homme</option>
                                    <option value="femme">Femme</option>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Téléphone du séminariste</Label>
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
                                    className="bg-white dark:bg-gray-800 text-text-main dark:text-white"
                                >
                                    <option value="aucun">Aucun</option>
                                    <option value="primaire">Primaire</option>
                                    <option value="secondaire">Secondaire</option>
                                    <option value="superieur">Universitaire</option>
                                    <option value="arabe">Arabe</option>
                                </Select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>École</Label>
                                <Input
                                    value={formData.ecole || ""}
                                    onChange={e => handleChange("ecole", e.target.value)}
                                    placeholder="Non renseigné"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Nom du parent</Label>
                                <Input
                                    value={formData.nom_parent || ""}
                                    onChange={e => handleChange("nom_parent", e.target.value)}
                                    placeholder="Non renseigné"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Prénom(s) du parent</Label>
                                <Input
                                    value={formData.prenom_parent || ""}
                                    onChange={e => handleChange("prenom_parent", e.target.value)}
                                    placeholder="Non renseigné"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Numéro du parent</Label>
                                <Input
                                    value={formData.numero_parent || ""}
                                    onChange={e => handleChange("numero_parent", e.target.value)}
                                    placeholder="Non renseigné"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Lieu d'habitation</Label>
                                <Input
                                    value={formData.lieu_habitation || ""}
                                    onChange={e => handleChange("lieu_habitation", e.target.value)}
                                    placeholder="Non renseigné"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Nombre de participations SEFIMAP</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.nombre_participations || 0}
                                    onChange={e => handleChange("nombre_participations", parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Numéro d'urgence</Label>
                                <Input
                                    value={formData.numero_urgence || ""}
                                    onChange={e => handleChange("numero_urgence", e.target.value)}
                                    placeholder="Non renseigné"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Président de Section</Label>
                                <Select
                                    value={formData.chef_quartier_id || ""}
                                    onChange={e => handleChange("chef_quartier_id", e.target.value)}
                                    className="bg-white dark:bg-gray-800 text-text-main dark:text-white"
                                >
                                    <option value="">Sélectionner un président</option>
                                    {chefsQuartier?.map(chef => (
                                        <option key={chef.id} value={chef.id}>
                                            {chef.nom_complet} - {chef.ecole}
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            {/* Champs d'affectation - MODE ÉDITION */}
                            <div className="md:col-span-2 mt-4 pt-4 border-t border-border-light dark:border-border-dark">
                                <h4 className="font-semibold text-text-main dark:text-white mb-3 flex items-center gap-2">
                                    <Building className="w-4 h-4 text-primary" />
                                    Affectation (dortoir requis pour valider)
                                </h4>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>
                                            Salle de dortoir <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={formData.dortoir_id || ""}
                                            onChange={e => handleChange("dortoir_id", e.target.value)}
                                            className={`bg-white dark:bg-gray-800 text-text-main dark:text-white ${!formData.dortoir_id ? "border-amber-500" : ""}`}
                                        >
                                            <option value="">Sélectionner un dortoir</option>
                                            {dortoirs?.map(dortoir => {
                                                const stats = getDortoirStats(dortoir.id);
                                                const isFull = isDortoirFull(dortoir.id);
                                                const capacityText = stats
                                                    ? ` (${stats.nombre_inscrits}/${stats.capacite})`
                                                    : '';

                                                return (
                                                    <option
                                                        key={dortoir.id}
                                                        value={dortoir.id}
                                                        disabled={isFull}
                                                    >
                                                        {dortoir.nom}{capacityText}{isFull ? ' - COMPLET' : ''}
                                                    </option>
                                                );
                                            })}
                                        </Select>
                                    </div>

                                    {/* Note sur le niveau de formation */}
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <p className="text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                                            <BookOpen className="w-4 h-4" />
                                            <span>
                                                <span className="font-semibold">Niveau de formation :</span> Sera attribué par la section scientifique
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>Statut</Label>
                                <Select
                                    value={formData.statut || ""}
                                    onChange={e => handleChange("statut", e.target.value)}
                                    className="bg-white dark:bg-gray-800 text-text-main dark:text-white"
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
                                    <BookOpen className="w-5 h-5 text-text-secondary mt-0.5" />
                                    <div>
                                        <p className="text-sm text-text-secondary">École</p>
                                        <p className="font-medium text-text-main dark:text-white">
                                            {registration.originalData?.ecole || "Non renseigné"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-5 h-5 text-text-secondary mt-0.5" />
                                    <div>
                                        <p className="text-sm text-text-secondary">Président de section / Zone</p>
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
                                            {registration.dateTime || registration.date}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Informations supplémentaires */}
                            <div className="md:col-span-2 mt-4 pt-4 border-t border-border-light dark:border-border-dark">
                                <h4 className="font-semibold text-text-main dark:text-white mb-4 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-primary" />
                                    Informations du parent / tuteur
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-start gap-3">
                                        <User className="w-5 h-5 text-text-secondary mt-0.5" />
                                        <div>
                                            <p className="text-sm text-text-secondary">Nom & Prénom(s)</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {registration.originalData?.nom_parent} {registration.originalData?.prenom_parent || "Non renseigné"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Phone className="w-5 h-5 text-text-secondary mt-0.5" />
                                        <div>
                                            <p className="text-sm text-text-secondary">Numéro du parent</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {registration.originalData?.numero_parent || "Non renseigné"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-5 h-5 text-text-secondary mt-0.5" />
                                        <div>
                                            <p className="text-sm text-text-secondary">Lieu d'habitation</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {registration.originalData?.lieu_habitation || "Non renseigné"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Phone className="w-5 h-5 text-text-secondary mt-0.5" />
                                        <div>
                                            <p className="text-sm text-text-secondary">N° Urgence</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {registration.originalData?.numero_urgence || "Non renseigné"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="w-5 h-5 text-text-secondary mt-0.5" />
                                        <div>
                                            <p className="text-sm text-text-secondary">Participations SEFIMAP</p>
                                            <p className="font-medium text-text-main dark:text-white">
                                                {registration.originalData?.nombre_participations || 0} fois
                                            </p>
                                        </div>
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
                                            (Dortoir requis pour valider)
                                        </span>
                                    )}
                                </h4>

                                {/* Vue compacte des statistiques des dortoirs */}
                                {dortoirStats.length > 0 && (
                                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                            <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                                Occupation des dortoirs
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {dortoirStats.map(stat => {
                                                const isSelected = formData.dortoir_id === stat.id;
                                                const tauxNum = parseFloat(stat.taux_remplissage);
                                                const colorClass = tauxNum >= 90
                                                    ? 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                                                    : tauxNum >= 70
                                                    ? 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                                                    : 'bg-emerald-100 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700';

                                                return (
                                                    <div
                                                        key={stat.id}
                                                        className={`p-2 rounded border ${isSelected ? 'ring-2 ring-primary' : colorClass}`}
                                                    >
                                                        <div className="text-xs font-semibold text-text-main dark:text-white truncate">
                                                            {stat.nom}
                                                        </div>
                                                        <div className="text-lg font-bold text-primary mt-1">
                                                            {stat.nombre_inscrits}
                                                            <span className="text-xs text-text-secondary dark:text-gray-400 font-normal">
                                                                /{stat.capacite}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                                                            <div
                                                                className={`h-1.5 rounded-full ${
                                                                    tauxNum >= 90 ? 'bg-red-500' :
                                                                    tauxNum >= 70 ? 'bg-orange-500' :
                                                                    'bg-emerald-500'
                                                                }`}
                                                                style={{ width: `${Math.min(tauxNum, 100)}%` }}
                                                            />
                                                        </div>
                                                        <div className="text-xs text-text-secondary dark:text-gray-400 mt-1">
                                                            {stat.places_disponibles} places
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
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
                                                // Valider la capacité avant de permettre le changement
                                                if (newValue) {
                                                    const stats = getDortoirStats(newValue);
                                                    const currentDortoirId = registration.originalData?.dortoir_id;

                                                    if (newValue !== currentDortoirId && stats && stats.nombre_inscrits >= stats.capacite) {
                                                        alert(`Le dortoir "${stats.nom}" est complet (${stats.nombre_inscrits}/${stats.capacite}).\nVeuillez choisir un autre dortoir ou augmenter la capacité dans la configuration.`);
                                                        return;
                                                    }
                                                }

                                                handleChange("dortoir_id", newValue);
                                                // Sauvegarder immédiatement sans fermer le modal
                                                await onUpdate(registration.id, {
                                                    ...formData,
                                                    dortoir_id: newValue
                                                }, false);
                                            }}
                                            className={`bg-white dark:bg-gray-800 text-text-main dark:text-white ${!formData.dortoir_id && isOnlineRegistration ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : ""}`}
                                        >
                                            <option value="">Non assigné</option>
                                            {dortoirs?.map(dortoir => {
                                                const stats = getDortoirStats(dortoir.id);
                                                const isFull = isDortoirFull(dortoir.id);
                                                const capacityText = stats
                                                    ? ` (${stats.nombre_inscrits}/${stats.capacite})`
                                                    : '';

                                                return (
                                                    <option
                                                        key={dortoir.id}
                                                        value={dortoir.id}
                                                        disabled={isFull}
                                                    >
                                                        {dortoir.nom}{capacityText}{isFull ? ' - COMPLET' : ''}
                                                    </option>
                                                );
                                            })}
                                        </Select>
                                    </div>

                                    {/* Note sur le niveau de formation */}
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <p className="text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                                            <BookOpen className="w-4 h-4" />
                                            <span>
                                                <span className="font-semibold">Niveau de formation :</span> {formData.niveau_formation ? (
                                                    <span className="capitalize">{niveauFormationMap[formData.niveau_formation] || formData.niveau_formation}</span>
                                                ) : (
                                                    <span>Sera attribué par la section scientifique</span>
                                                )}
                                            </span>
                                        </p>
                                    </div>

                                    {/* Message de confirmation */}
                                    {formData.dortoir_id && (
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" />
                                            Dortoir assigné - Vous pouvez valider cette inscription
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Avertissement si dortoir manquant pour validation */}
                            {isOnlineRegistration && registration.statut === 'en_attente' && !canValidate && (
                                <div className="md:col-span-2 mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                        <span className="font-bold">⚠️ Action requise:</span>
                                        Veuillez attribuer une salle de dortoir pour valider cette inscription.
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
                                    title={!canValidate ? "Attribuez d'abord un dortoir" : "Valider l'inscription"}
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
