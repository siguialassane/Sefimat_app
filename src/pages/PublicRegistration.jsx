import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PhotoCapture } from "@/components/ui/photo-capture";
import {
    User,
    Users,
    Send,
    CheckCircle,
    Camera,
    ArrowRight,
    ArrowLeft,
    Check
} from "lucide-react";
import { Mosque } from "@/components/icons";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/storage";

const registrationSchema = z.object({
    nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
    age: z.number().min(1, "L'âge est requis").max(120, "Âge invalide"),
    sexe: z.enum(["homme", "femme"], { required_error: "Veuillez sélectionner le sexe" }),
    niveauEtude: z.string().min(1, "Veuillez sélectionner un niveau d'étude"),
    telephone: z.string().optional().or(z.literal("")),
    numeroUrgence: z.string().min(8, "Le numéro d'urgence est obligatoire"),
    chefQuartier: z.string().min(1, "Veuillez sélectionner un président de section"),
});

// Configuration des étapes
const steps = [
    { id: 1, title: "Photo", icon: Camera, description: "Photo du participant" },
    { id: 2, title: "Identité", icon: User, description: "Informations personnelles" },
    { id: 3, title: "Référent", icon: Users, description: "Président de section" },
];

export function PublicRegistration() {
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [chefsQuartier, setChefsQuartier] = useState([]);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoError, setPhotoError] = useState(null);
    const [photoKey, setPhotoKey] = useState(0);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        trigger,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(registrationSchema),
        defaultValues: {
            sexe: "homme",
        },
    });

    const selectedSexe = watch("sexe");
    const watchedValues = watch();

    // Charger les chefs de quartier
    useEffect(() => {
        async function loadChefs() {
            const { data, error } = await supabase
                .from('chefs_quartier')
                .select('*')
                .order('nom_complet');

            if (error) {
                console.error('Erreur chargement chefs:', error);
            } else {
                setChefsQuartier(data || []);
            }
        }
        loadChefs();
    }, []);

    // Validation par étape
    const validateStep = async (step) => {
        if (step === 1) {
            if (!photoFile) {
                setPhotoError("La photo est obligatoire");
                return false;
            }
            setPhotoError(null);
            return true;
        }
        if (step === 2) {
            const isValid = await trigger(["nom", "prenom", "age", "sexe", "niveauEtude", "numeroUrgence"]);
            return isValid;
        }
        if (step === 3) {
            const isValid = await trigger(["chefQuartier"]);
            return isValid;
        }
        return true;
    };

    const nextStep = async () => {
        const isValid = await validateStep(currentStep);
        if (isValid && currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const goToStep = async (step) => {
        // Permettre de revenir en arrière sans validation
        if (step < currentStep) {
            setCurrentStep(step);
            return;
        }
        // Pour avancer, valider les étapes intermédiaires
        for (let i = currentStep; i < step; i++) {
            const isValid = await validateStep(i);
            if (!isValid) return;
        }
        setCurrentStep(step);
    };

    const onSubmit = async (data) => {
        if (!photoFile) {
            setPhotoError("La photo est obligatoire");
            setCurrentStep(1);
            return;
        }

        setIsLoading(true);
        try {
            // 1. Upload la photo vers Supabase Storage
            const photoUrl = await uploadPhoto(photoFile, 'inscription');

            // 2. Créer l'inscription avec l'URL de la photo
            const { error } = await supabase
                .from('inscriptions')
                .insert({
                    nom: data.nom,
                    prenom: data.prenom,
                    age: data.age,
                    sexe: data.sexe,
                    niveau_etude: data.niveauEtude,
                    telephone: data.telephone || null,
                    numero_urgence: data.numeroUrgence,
                    chef_quartier_id: data.chefQuartier,
                    type_inscription: 'en_ligne',
                    statut: 'en_attente',
                    admin_id: null,
                    photo_url: photoUrl
                });

            if (error) throw error;

            setIsSubmitted(true);
            setPhotoFile(null);
            setPhotoKey(prev => prev + 1); // Force la réinitialisation du composant photo
            reset();
            setCurrentStep(1);
            setTimeout(() => setIsSubmitted(false), 5000);
        } catch (error) {
            console.error("Erreur lors de l'inscription:", error);
            alert(`Erreur: ${error.message || 'Impossible de soumettre l\'inscription'}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Vérifier si une étape est complète
    const isStepComplete = (step) => {
        if (step === 1) return !!photoFile;
        if (step === 2) {
            return watchedValues.nom && watchedValues.prenom && watchedValues.age && watchedValues.sexe && watchedValues.niveauEtude && watchedValues.numeroUrgence;
        }
        if (step === 3) return !!watchedValues.chefQuartier;
        return false;
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark font-display flex flex-col">
            {/* Navbar */}
            <header className="w-full bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark sticky top-0 z-50">
                <div className="max-w-[1280px] mx-auto px-4 sm:px-10 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-text-main dark:text-white">
                            <div className="h-8 w-8 flex items-center justify-center text-primary">
                                <Mosque className="h-7 w-7" />
                            </div>
                            <h2 className="text-lg font-bold leading-tight tracking-tight">SEFIMAP 2026</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <a
                                href="/login"
                                className="hidden sm:flex items-center justify-center rounded-lg h-10 px-4 bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 text-text-main dark:text-white text-sm font-bold transition-colors"
                            >
                                Connexion Admin
                            </a>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex justify-center py-6 sm:py-8 px-4 sm:px-6">
                <div className="flex flex-col max-w-[600px] w-full gap-6">
                    {/* Page Heading */}
                    <div className="text-center">
                        <h1 className="text-text-main dark:text-white text-2xl sm:text-3xl font-black leading-tight tracking-tight">
                            Inscription au Séminaire
                        </h1>
                        <p className="text-text-secondary dark:text-gray-400 text-sm mt-2">
                            Remplissez le formulaire étape par étape
                        </p>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center justify-center gap-2 sm:gap-4">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center">
                                <button
                                    type="button"
                                    onClick={() => goToStep(step.id)}
                                    className={cn(
                                        "flex flex-col items-center gap-1 transition-all",
                                        currentStep === step.id ? "scale-105" : "opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all",
                                            currentStep === step.id
                                                ? "bg-primary text-white shadow-lg shadow-primary/30"
                                                : isStepComplete(step.id)
                                                    ? "bg-emerald-500 text-white"
                                                    : "bg-gray-200 dark:bg-gray-700 text-text-secondary"
                                        )}
                                    >
                                        {isStepComplete(step.id) && currentStep !== step.id ? (
                                            <Check className="h-5 w-5" />
                                        ) : (
                                            <step.icon className="h-5 w-5" />
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-xs font-medium hidden sm:block",
                                        currentStep === step.id ? "text-primary" : "text-text-secondary"
                                    )}>
                                        {step.title}
                                    </span>
                                </button>
                                {index < steps.length - 1 && (
                                    <div className={cn(
                                        "w-8 sm:w-16 h-0.5 mx-2",
                                        isStepComplete(step.id) ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700"
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Form Card */}
                    <Card className="overflow-hidden">
                        <form onSubmit={handleSubmit(onSubmit)}>
                            {/* Step 1: Photo */}
                            <div className={cn(
                                "transition-all duration-300",
                                currentStep === 1 ? "block" : "hidden"
                            )}>
                                <div className="p-6 sm:p-8">
                                    <div className="text-center mb-6">
                                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-3">
                                            <Camera className="h-7 w-7" />
                                        </div>
                                        <h3 className="text-lg font-bold text-text-main dark:text-white">
                                            Photo du Participant
                                        </h3>
                                        <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                                            Prenez une photo claire et récente
                                        </p>
                                    </div>

                                    <PhotoCapture
                                        key={photoKey}
                                        onPhotoCapture={(file) => {
                                            setPhotoFile(file);
                                            if (file) setPhotoError(null);
                                        }}
                                        required={true}
                                    />
                                    {photoError && (
                                        <p className="text-red-500 text-sm text-center mt-3">{photoError}</p>
                                    )}
                                </div>
                            </div>

                            {/* Step 2: Identité */}
                            <div className={cn(
                                "transition-all duration-300",
                                currentStep === 2 ? "block" : "hidden"
                            )}>
                                <div className="p-6 sm:p-8">
                                    <div className="text-center mb-6">
                                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-3">
                                            <User className="h-7 w-7" />
                                        </div>
                                        <h3 className="text-lg font-bold text-text-main dark:text-white">
                                            Informations Personnelles
                                        </h3>
                                        <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                                            Renseignez vos informations
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Nom & Prénom */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <Label htmlFor="nom">Nom</Label>
                                                <Input
                                                    id="nom"
                                                    placeholder="Ex: Kouassi"
                                                    {...register("nom")}
                                                    className={errors.nom ? "border-red-500" : ""}
                                                />
                                                {errors.nom && (
                                                    <p className="text-red-500 text-xs">{errors.nom.message}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Label htmlFor="prenom">Prénoms</Label>
                                                <Input
                                                    id="prenom"
                                                    placeholder="Ex: Jean"
                                                    {...register("prenom")}
                                                    className={errors.prenom ? "border-red-500" : ""}
                                                />
                                                {errors.prenom && (
                                                    <p className="text-red-500 text-xs">{errors.prenom.message}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Sexe */}
                                        <div className="flex flex-col gap-2">
                                            <Label>Genre</Label>
                                            <div className="flex gap-3">
                                                <label
                                                    className={cn(
                                                        "flex-1 flex cursor-pointer items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-all",
                                                        selectedSexe === "homme"
                                                            ? "border-primary bg-primary/5 text-primary"
                                                            : "border-border-light dark:border-border-dark bg-white dark:bg-gray-900 text-text-main dark:text-gray-300"
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        value="homme"
                                                        {...register("sexe")}
                                                        className="sr-only"
                                                    />
                                                    <span className="flex items-center gap-2">
                                                        <span className="text-lg">♂</span> Homme
                                                    </span>
                                                </label>
                                                <label
                                                    className={cn(
                                                        "flex-1 flex cursor-pointer items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-all",
                                                        selectedSexe === "femme"
                                                            ? "border-primary bg-primary/5 text-primary"
                                                            : "border-border-light dark:border-border-dark bg-white dark:bg-gray-900 text-text-main dark:text-gray-300"
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        value="femme"
                                                        {...register("sexe")}
                                                        className="sr-only"
                                                    />
                                                    <span className="flex items-center gap-2">
                                                        <span className="text-lg">♀</span> Femme
                                                    </span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Âge & Niveau */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <Label htmlFor="age">Âge</Label>
                                                <Input
                                                    id="age"
                                                    type="number"
                                                    placeholder="25"
                                                    {...register("age", { valueAsNumber: true })}
                                                    className={errors.age ? "border-red-500" : ""}
                                                />
                                                {errors.age && (
                                                    <p className="text-red-500 text-xs">{errors.age.message}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Label htmlFor="niveauEtude">Niveau d'étude</Label>
                                                <Select
                                                    id="niveauEtude"
                                                    {...register("niveauEtude")}
                                                    className={errors.niveauEtude ? "border-red-500" : ""}
                                                >
                                                    <option value="">Sélectionnez</option>
                                                    <option value="aucun">Aucun</option>
                                                    <option value="primaire">Primaire</option>
                                                    <option value="secondaire">Secondaire</option>
                                                    <option value="superieur">Universitaire</option>
                                                    <option value="arabe">Arabe</option>
                                                </Select>
                                                {errors.niveauEtude && (
                                                    <p className="text-red-500 text-xs">{errors.niveauEtude.message}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Téléphone & Numéro d'urgence */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <Label htmlFor="telephone">Téléphone (optionnel)</Label>
                                                <Input
                                                    id="telephone"
                                                    type="tel"
                                                    placeholder="Ex: 07 00 00 00 00"
                                                    {...register("telephone")}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Label htmlFor="numeroUrgence">
                                                    N° Urgence <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id="numeroUrgence"
                                                    type="tel"
                                                    placeholder="Ex: 01 00 00 00 00"
                                                    {...register("numeroUrgence")}
                                                    className={errors.numeroUrgence ? "border-red-500" : ""}
                                                />
                                                {errors.numeroUrgence && (
                                                    <p className="text-red-500 text-xs">{errors.numeroUrgence.message}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Référent */}
                            <div className={cn(
                                "transition-all duration-300",
                                currentStep === 3 ? "block" : "hidden"
                            )}>
                                <div className="p-6 sm:p-8">
                                    <div className="text-center mb-6">
                                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-3">
                                            <Users className="h-7 w-7" />
                                        </div>
                                        <h3 className="text-lg font-bold text-text-main dark:text-white">
                                            Président de Section Référent
                                        </h3>
                                        <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                                            Sélectionnez votre président de section
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <Label htmlFor="chefQuartier">Président de Section</Label>
                                            <Select
                                                id="chefQuartier"
                                                {...register("chefQuartier")}
                                                className={cn(
                                                    "h-12",
                                                    errors.chefQuartier ? "border-red-500" : ""
                                                )}
                                            >
                                                <option value="">Sélectionnez votre référent</option>
                                                {chefsQuartier.map(chef => (
                                                    <option key={chef.id} value={chef.id}>
                                                        {chef.nom_complet} - {chef.zone}
                                                    </option>
                                                ))}
                                            </Select>
                                            {errors.chefQuartier && (
                                                <p className="text-red-500 text-xs">{errors.chefQuartier.message}</p>
                                            )}
                                        </div>

                                        {/* Résumé */}
                                        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border-light dark:border-border-dark">
                                            <h4 className="font-semibold text-text-main dark:text-white text-sm mb-3">
                                                Résumé de l'inscription
                                            </h4>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div className="text-text-secondary">Nom complet:</div>
                                                <div className="text-text-main dark:text-white font-medium">
                                                    {watchedValues.nom || "-"} {watchedValues.prenom || ""}
                                                </div>
                                                <div className="text-text-secondary">Âge:</div>
                                                <div className="text-text-main dark:text-white font-medium">
                                                    {watchedValues.age || "-"} ans
                                                </div>
                                                <div className="text-text-secondary">Genre:</div>
                                                <div className="text-text-main dark:text-white font-medium capitalize">
                                                    {watchedValues.sexe || "-"}
                                                </div>
                                                <div className="text-text-secondary">Photo:</div>
                                                <div className={cn(
                                                    "font-medium",
                                                    photoFile ? "text-emerald-500" : "text-amber-500"
                                                )}>
                                                    {photoFile ? "✓ Capturée" : "✗ Manquante"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Buttons */}
                            <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex gap-3">
                                {currentStep > 1 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={prevStep}
                                        className="flex-1 h-12"
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Précédent
                                    </Button>
                                )}
                                {currentStep < 3 ? (
                                    <Button
                                        type="button"
                                        onClick={nextStep}
                                        className="flex-1 h-12"
                                    >
                                        Suivant
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className="flex-1 h-12 shadow-lg shadow-primary/20"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="h-5 w-5 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                                                Envoi...
                                            </span>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4 mr-2" />
                                                Soumettre
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </Card>

                    {/* Footer */}
                    <div className="py-4 text-center text-xs text-text-secondary dark:text-gray-500">
                        <p>© SEFIMAP 2026 - Séminaire de Formation Islamique</p>
                    </div>
                </div>
            </main>

            {/* Success Toast */}
            {isSubmitted && (
                <div className="fixed bottom-6 right-6 left-6 sm:left-auto max-w-sm w-full bg-surface-light dark:bg-surface-dark border-l-4 border-primary shadow-xl rounded-lg p-4 flex items-start gap-3 animate-fade-in z-50">
                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-text-main dark:text-white">
                            Inscription envoyée !
                        </h4>
                        <p className="text-text-secondary dark:text-gray-400 text-sm mt-1">
                            Votre inscription est en attente de validation.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
