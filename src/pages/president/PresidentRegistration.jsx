import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PhotoCapture } from "@/components/ui/photo-capture";
import {
    User,
    Send,
    CheckCircle,
    Camera,
    ArrowRight,
    ArrowLeft,
    Check,
    Phone,
    Wallet,
} from "lucide-react";
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
    ecole: z.string().optional().or(z.literal("")),
    nomParent: z.string().min(2, "Le nom du parent est requis"),
    prenomParent: z.string().min(2, "Le prénom du parent est requis"),
    numeroParent: z.string().min(8, "Le numéro du parent est obligatoire"),
    lieuHabitation: z.string().min(2, "Le lieu d'habitation est requis"),
    nombreParticipations: z.number().min(0, "Le nombre doit être positif ou zéro"),
    numeroUrgence: z.string().min(8, "Le numéro d'urgence est obligatoire"),
    montantPaye: z.number()
        .min(0, "Le montant doit être positif")
        .max(4000, "Le montant ne peut pas dépasser 4000 FCFA"),
    modePaiement: z.string().optional(),
});

// Configuration des étapes
const steps = [
    { id: 1, title: "Photo", icon: Camera, description: "Photo du participant" },
    { id: 2, title: "Identité", icon: User, description: "Infos personnelles" },
    { id: 3, title: "Contact", icon: Phone, description: "Parents & Contact" },
    { id: 4, title: "Paiement", icon: Wallet, description: "Montant & Mode" },
];

export function PresidentRegistration() {
    const { president } = useOutletContext();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
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
            nombreParticipations: 0,
            montantPaye: 0,
            modePaiement: "especes",
        },
    });

    const selectedSexe = watch("sexe");
    const watchedValues = watch();
    const montantPaye = watch("montantPaye") || 0;

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
            const isValid = await trigger(["nom", "prenom", "age", "sexe", "niveauEtude", "ecole"]);
            return isValid;
        }
        if (step === 3) {
            const isValid = await trigger(["telephone", "nomParent", "prenomParent", "numeroParent", "lieuHabitation", "nombreParticipations", "numeroUrgence"]);
            return isValid;
        }
        if (step === 4) {
            const isValid = await trigger(["montantPaye", "modePaiement"]);
            return isValid;
        }
        return true;
    };

    const nextStep = async () => {
        const isValid = await validateStep(currentStep);
        if (isValid && currentStep < 4) {
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

    // Fonction pour soumettre manuellement (évite les soumissions automatiques)
    const handleManualSubmit = () => {
        console.log("Soumission manuelle déclenchée par clic utilisateur");
        handleSubmit(onSubmit)();
    };

    const onSubmit = async (data) => {
        // Sécurité : empêche la soumission si on n'est pas à la dernière étape
        if (currentStep < steps.length) {
            console.log("Soumission bloquée - étape actuelle:", currentStep);
            return;
        }

        if (!photoFile) {
            setPhotoError("La photo est obligatoire");
            setCurrentStep(1);
            return;
        }

        // Validation stricte du montant - BLOQUER si > 4000
        const montant = Math.floor(data.montantPaye || 0);
        if (montant > 4000) {
            alert("❌ Le montant ne peut pas dépasser 4000 FCFA !\nVeuillez corriger le montant.");
            setCurrentStep(4);
            return;
        }

        setIsLoading(true);
        try {
            // 1. Upload la photo vers Supabase Storage
            const photoUrl = await uploadPhoto(photoFile, 'president');

            // 2. Calcul statut paiement
            let statutPaiement = "non_payé";
            if (montant >= 4000) statutPaiement = "soldé";
            else if (montant > 0) statutPaiement = "partiel";

            // 3. Créer l'inscription
            const { data: inscription, error } = await supabase
                .from('inscriptions')
                .insert({
                    nom: data.nom,
                    prenom: data.prenom,
                    age: data.age,
                    sexe: data.sexe,
                    niveau_etude: data.niveauEtude,
                    telephone: data.telephone || null,
                    ecole: data.ecole || null,
                    nom_parent: data.nomParent,
                    prenom_parent: data.prenomParent,
                    numero_parent: data.numeroParent,
                    lieu_habitation: data.lieuHabitation,
                    nombre_participations: data.nombreParticipations,
                    numero_urgence: data.numeroUrgence,
                    chef_quartier_id: president.id,
                    type_inscription: 'en_ligne',
                    statut: 'en_attente',
                    photo_url: photoUrl,
                    montant_total_paye: montant,
                    statut_paiement: statutPaiement,
                    mode_paiement: data.modePaiement || "especes",
                })
                .select()
                .single();

            if (error) throw error;

            // 4. Enregistrer paiement si montant > 0
            // IMPORTANT: Les paiements président sont TOUJOURS validés (l'argent est collecté directement)
            if (montant > 0) {
                const { error: paiementError } = await supabase.from("paiements").insert({
                    inscription_id: inscription.id,
                    montant: montant,
                    mode_paiement: data.modePaiement || "especes",
                    statut: "validé",  // Toujours validé pour paiement président
                    type_paiement: "inscription",
                });
                
                if (paiementError) {
                    console.error("Erreur enregistrement paiement:", paiementError);
                    // On continue car l'inscription est déjà créée
                }
            }

            setIsSubmitted(true);
            setPhotoFile(null);
            setPhotoKey(prev => prev + 1);
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
            return watchedValues.nom && watchedValues.prenom && watchedValues.age && watchedValues.sexe &&
                watchedValues.niveauEtude;
        }
        if (step === 3) {
            return watchedValues.nomParent && watchedValues.prenomParent &&
                watchedValues.numeroParent && watchedValues.lieuHabitation && watchedValues.numeroUrgence;
        }
        if (step === 4) return currentStep >= 4; // Paiement complété seulement si on y est arrivé
        return false;
    };

    return (
        <div className="h-full flex flex-col overflow-y-auto bg-background-light dark:bg-background-dark">
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
                        <p className="text-amber-600 dark:text-amber-400 text-xs mt-1 font-medium">
                            Section: {president?.zone} • Président: {president?.nom_complet}
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
                        <form
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                }
                            }}
                        >
                            <div className="overflow-hidden">
                                <div
                                    className="flex transition-transform duration-500 ease-in-out"
                                    style={{ transform: `translateX(-${(currentStep - 1) * 100}%)` }}
                                >
                                    {/* Step 1: Photo */}
                                    <div className="w-full flex-shrink-0">
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
                                    <div className="w-full flex-shrink-0">
                                        <div className="p-6 sm:p-8">
                                            <div className="text-center mb-6">
                                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-3">
                                                    <User className="h-7 w-7" />
                                                </div>
                                                <h3 className="text-lg font-bold text-text-main dark:text-white">
                                                    Informations Personnelles
                                                </h3>
                                                <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                                                    Identité du participant
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

                                                {/* École */}
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="ecole">École</Label>
                                                    <Input
                                                        id="ecole"
                                                        placeholder="Ex: Lycée Moderne de Yopougon"
                                                        {...register("ecole")}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 3: Parents & Contact */}
                                    <div className="w-full flex-shrink-0">
                                        <div className="p-6 sm:p-8">
                                            <div className="text-center mb-6">
                                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-3">
                                                    <Phone className="h-7 w-7" />
                                                </div>
                                                <h3 className="text-lg font-bold text-text-main dark:text-white">
                                                    Parents & Contact
                                                </h3>
                                                <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                                                    Coordonnées et contacts d'urgence
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Téléphone du séminariste */}
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="telephone">
                                                        Numéro de téléphone du séminariste
                                                    </Label>
                                                    <Input
                                                        id="telephone"
                                                        type="tel"
                                                        placeholder="Ex: 07 00 00 00 00"
                                                        {...register("telephone")}
                                                    />
                                                </div>

                                                {/* Nom et Prénom du parent */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex flex-col gap-2">
                                                        <Label htmlFor="nomParent">
                                                            Nom du parent <span className="text-red-500">*</span>
                                                        </Label>
                                                        <Input
                                                            id="nomParent"
                                                            placeholder="Ex: Traoré"
                                                            {...register("nomParent")}
                                                            className={errors.nomParent ? "border-red-500" : ""}
                                                        />
                                                        {errors.nomParent && (
                                                            <p className="text-red-500 text-xs">{errors.nomParent.message}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Label htmlFor="prenomParent">
                                                            Prénom(s) du parent <span className="text-red-500">*</span>
                                                        </Label>
                                                        <Input
                                                            id="prenomParent"
                                                            placeholder="Ex: Aminata"
                                                            {...register("prenomParent")}
                                                            className={errors.prenomParent ? "border-red-500" : ""}
                                                        />
                                                        {errors.prenomParent && (
                                                            <p className="text-red-500 text-xs">{errors.prenomParent.message}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Numéro du parent */}
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="numeroParent">
                                                        Numéro du parent <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="numeroParent"
                                                        type="tel"
                                                        placeholder="Ex: 01 00 00 00 00"
                                                        {...register("numeroParent")}
                                                        className={errors.numeroParent ? "border-red-500" : ""}
                                                    />
                                                    {errors.numeroParent && (
                                                        <p className="text-red-500 text-xs">{errors.numeroParent.message}</p>
                                                    )}
                                                </div>

                                                {/* Lieu d'habitation */}
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="lieuHabitation">
                                                        Lieu d'habitation <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="lieuHabitation"
                                                        placeholder="Ex: Yopougon, Mamie Adjoua"
                                                        {...register("lieuHabitation")}
                                                        className={errors.lieuHabitation ? "border-red-500" : ""}
                                                    />
                                                    {errors.lieuHabitation && (
                                                        <p className="text-red-500 text-xs">{errors.lieuHabitation.message}</p>
                                                    )}
                                                </div>

                                                {/* Nombre de participations */}
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="nombreParticipations">
                                                        Nombre de participation au SEFIMAP
                                                    </Label>
                                                    <Input
                                                        id="nombreParticipations"
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        {...register("nombreParticipations", { valueAsNumber: true })}
                                                        className={errors.nombreParticipations ? "border-red-500" : ""}
                                                    />
                                                </div>

                                                {/* Numéro d'urgence */}
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="numeroUrgence">
                                                        N° Urgence <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="numeroUrgence"
                                                        type="tel"
                                                        placeholder="Ex: 05 00 00 00 00"
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

                                    {/* Step 4: Paiement */}
                                    <div className="w-full flex-shrink-0">
                                        <div className="p-6 sm:p-8">
                                            <div className="text-center mb-6">
                                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 text-amber-600 mb-3">
                                                    <Wallet className="h-7 w-7" />
                                                </div>
                                                <h3 className="text-lg font-bold text-text-main dark:text-white">
                                                    Paiement
                                                </h3>
                                                <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                                                    Montant requis: <span className="font-bold text-amber-600">4.000 FCFA</span>
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Montant payé */}
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="montantPaye" className="flex items-center gap-2">
                                                        <Wallet className="w-4 h-4 text-amber-600" />
                                                        Montant payé (FCFA) - Max 4000
                                                    </Label>
                                                    <Input
                                                        id="montantPaye"
                                                        type="number"
                                                        min="0"
                                                        max="4000"
                                                        step="100"
                                                        placeholder="0"
                                                        {...register("montantPaye", { valueAsNumber: true })}
                                                        className={cn(
                                                            "text-lg",
                                                            montantPaye > 4000 
                                                                ? "border-red-500 focus:border-red-500 bg-red-50" 
                                                                : "border-amber-200 focus:border-amber-500"
                                                        )}
                                                    />
                                                    {errors.montantPaye && (
                                                        <p className="text-red-500 text-xs font-medium">
                                                            {errors.montantPaye.message}
                                                        </p>
                                                    )}
                                                    {montantPaye > 4000 && (
                                                        <p className="text-red-600 text-xs font-bold flex items-center gap-1">
                                                            ⚠️ Le montant ne peut pas dépasser 4000 FCFA !
                                                        </p>
                                                    )}
                                                    {montantPaye > 0 && montantPaye <= 4000 && montantPaye < 4000 && (
                                                        <p className="text-amber-600 text-xs">
                                                            Reste à payer: {(4000 - montantPaye).toLocaleString()} FCFA
                                                        </p>
                                                    )}
                                                    {montantPaye === 4000 && (
                                                        <p className="text-emerald-600 text-xs flex items-center gap-1">
                                                            <Check className="h-3 w-3" /> Paiement complet
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Mode de paiement */}
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="modePaiement">Mode de paiement</Label>
                                                    <Select
                                                        id="modePaiement"
                                                        {...register("modePaiement")}
                                                    >
                                                        <option value="especes">Espèces</option>
                                                        <option value="mobile_money">Mobile Money</option>
                                                        <option value="virement">Virement</option>
                                                    </Select>
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
                                                        <div className="text-text-secondary">Montant:</div>
                                                        <div className={cn(
                                                            "font-bold",
                                                            montantPaye >= 4000 ? "text-emerald-500" : "text-amber-500"
                                                        )}>
                                                            {montantPaye.toLocaleString()} FCFA
                                                        </div>
                                                    </div>
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
                                {currentStep < 4 ? (
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
                                        type="button"
                                        onClick={handleManualSubmit}
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
                            L'inscription est en attente de validation.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
