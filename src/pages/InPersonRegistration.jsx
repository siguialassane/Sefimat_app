import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PhotoCapture } from "@/components/ui/photo-capture";
import {
    Save,
    Phone,
    CheckCircle,
    Building,
    BookOpen,
    ArrowRight,
    User,
    GraduationCap,
    DollarSign,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts";
import { uploadPhoto } from "@/lib/storage";
import { DormitoryDropdown } from "@/components/DormitoryDropdown";

// NOTE: Pour les inscriptions présentielles, le dortoir est obligatoire
// Le niveau_formation n'est PAS géré par l'admin, il sera complété par la section scientifique
// TODO: Créer une interface pour la section scientifique permettant de compléter les inscriptions
const registrationSchema = z.object({
    nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
    age: z.number().min(1, "L'âge est requis").max(120, "Âge invalide"),
    sexe: z.enum(["homme", "femme"]),
    niveauEtude: z.string().min(1, "Veuillez sélectionner un niveau d'étude"),
    telephone: z.string().min(8, "Le numéro de téléphone est obligatoire"),
    ecole: z.string().optional().or(z.literal("")),
    nomParent: z.string().min(2, "Le nom du parent est requis"),
    prenomParent: z.string().min(2, "Le prénom du parent est requis"),
    numeroParent: z.string().min(8, "Le numéro du parent est obligatoire"),
    lieuHabitation: z.string().min(2, "Le lieu d'habitation est requis"),
    nombreParticipations: z.number().min(0, "Le nombre doit être positif ou zéro"),
    numeroUrgence: z.string().min(8, "Le numéro d'urgence est obligatoire"),
    dortoirId: z.string().min(1, "Veuillez sélectionner un dortoir"),
    montantPaye: z.number()
        .min(0, "Le montant doit être positif")
        .max(4000, "Le montant ne peut pas dépasser 4000 FCFA"),
    // niveauFormation retiré - géré par la section scientifique uniquement
});

export function InPersonRegistration() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [registrations, setRegistrations] = useState([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [dortoirs, setDortoirs] = useState([]);
    const [dortoirStats, setDortoirStats] = useState([]);
    const [photoError, setPhotoError] = useState(null);
    const [photoKey, setPhotoKey] = useState(0);
    const [currentStep, setCurrentStep] = useState(1);

    const steps = [
        { id: 1, title: "Identité", fields: ["nom", "prenom", "sexe", "age", "niveauEtude", "telephone", "ecole"] },
        { id: 2, title: "Parents & Contact", fields: ["nomParent", "prenomParent", "numeroParent", "lieuHabitation", "numeroUrgence"] },
        { id: 3, title: "Finalisation", fields: ["nombreParticipations", "dortoirId", "montantPaye"] }
    ];

    const nextStep = async () => {
        const fields = steps[currentStep - 1].fields;
        const isValid = await trigger(fields);

        if (isValid) {
            setCurrentStep(prev => Math.min(prev + 1, steps.length));
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

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
        },
    });

    const selectedSexe = watch("sexe");

    // Charger les inscriptions présentielles récentes de cet admin
    useEffect(() => {
        async function loadRecentRegistrations() {
            if (!user) return;

            try {
                const { data, error } = await supabase
                    .from('inscriptions')
                    .select('*')
                    .eq('type_inscription', 'presentielle')
                    .eq('admin_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (error) throw error;

                const formatted = data.map(r => ({
                    id: r.id,
                    name: `${r.nom} ${r.prenom}`,
                    phone: r.telephone || 'N/A',
                    time: new Date(r.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    recent: new Date(r.created_at) > new Date(Date.now() - 10 * 60 * 1000),
                }));

                setRegistrations(formatted);
            } catch (error) {
                console.error('Erreur chargement inscriptions:', error);
            }
        }

        loadRecentRegistrations();
    }, [user]);

    // Charger la liste des dortoirs
    useEffect(() => {
        async function loadDortoirs() {
            const { data, error } = await supabase
                .from('dortoirs')
                .select('*')
                .order('nom');

            if (error) {
                console.error('Erreur chargement dortoirs:', error);
            } else {
                setDortoirs(data || []);
            }
        }
        loadDortoirs();
    }, []);

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

        loadDortoirStats();

        // Recharger les stats toutes les 30 secondes pour avoir des données fraîches
        const interval = setInterval(loadDortoirStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const onSubmit = async (data) => {
        // Valider que la photo est fournie
        if (!photoFile) {
            setPhotoError("La photo est obligatoire");
            return;
        }
        setPhotoError(null);

        setIsLoading(true);
        try {
            // 1. Upload la photo vers Supabase Storage
            const photoUrl = await uploadPhoto(photoFile, 'presentiel');

            // 2. Créer l'inscription avec l'URL de la photo
            // NOTE: niveau_formation est null car il sera complété par la section scientifique
            const { data: inscription, error } = await supabase
                .from('inscriptions')
                .insert({
                    nom: data.nom,
                    prenom: data.prenom,
                    age: data.age,
                    sexe: data.sexe,
                    niveau_etude: data.niveauEtude,
                    telephone: data.telephone,
                    ecole: data.ecole || null,
                    nom_parent: data.nomParent,
                    prenom_parent: data.prenomParent,
                    numero_parent: data.numeroParent,
                    lieu_habitation: data.lieuHabitation,
                    nombre_participations: data.nombreParticipations,
                    numero_urgence: data.numeroUrgence,
                    admin_id: user.id,
                    type_inscription: 'presentielle',
                    statut: 'valide', // Automatiquement validé
                    // Workflow: inscriptions présentielles sont directement validées
                    // (le secrétaire a validé le paiement et l'attribution dortoir en même temps)
                    statut_workflow: 'valide',
                    valide_par_secretariat: user.id,
                    date_validation_secretariat: new Date().toISOString(),
                    valide_par_financier: user.id,
                    date_validation_financier: new Date().toISOString(),
                    chef_quartier_id: null,
                    photo_url: photoUrl,
                    dortoir_id: data.dortoirId,
                    montant_total_paye: data.montantPaye,
                    statut_paiement: data.montantPaye >= 4000 ? "valide_financier" : (data.montantPaye > 0 ? "partiel" : "non_payé"),
                    niveau_formation: null, // Sera complété par la section scientifique
                })
                .select()
                .single();

            if (error) throw error;

            // 3. Créer le paiement si montant > 0 (pour cohérence et validation financière)
            if (data.montantPaye > 0) {
                const { error: paiementError } = await supabase
                    .from('paiements')
                    .insert({
                        inscription_id: inscription.id,
                        montant: data.montantPaye,
                        mode_paiement: 'especes',
                        statut: 'attente', // En attente de validation financière
                        type_paiement: 'inscription',
                    });
                
                if (paiementError) {
                    console.error("Erreur enregistrement paiement:", paiementError);
                    // On continue car l'inscription est déjà créée
                }
            }

            // Ajouter aux inscriptions récentes
            const newRegistration = {
                id: inscription.id,
                name: `${data.nom} ${data.prenom}`,
                phone: data.telephone || 'N/A',
                time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                recent: true,
                photo_url: photoUrl,
            };
            setRegistrations([newRegistration, ...registrations.slice(0, 4)]);

            reset();
            setPhotoFile(null);
            setPhotoKey(prev => prev + 1); // Force la réinitialisation du composant photo
            setShowSuccess(true);
            setCurrentStep(1);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error("Erreur inscription:", error);
            alert(`Erreur: ${error.message || 'Impossible d\'enregistrer l\'inscription'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-[1200px] mx-auto">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-text-main dark:text-white tracking-tight text-3xl font-bold leading-tight">
                            Nouvelle Inscription
                        </h1>
                        <div className="flex items-center gap-2 text-text-secondary dark:text-gray-400 text-sm">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            <span>
                                Enregistré par:{" "}
                                <span className="font-medium text-text-main dark:text-white">
                                    {user?.email || 'Admin'}
                                </span>
                            </span>
                        </div>
                    </div>
                    {/* Mini Stats */}
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-primary/10 rounded-lg">
                            <span className="text-xs text-text-secondary">Aujourd'hui</span>
                            <p className="text-xl font-bold text-primary">{registrations.length}</p>
                        </div>
                    </div>
                </div>

                {/* Main Content - Split Layout */}
                <Card className="overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                        {/* Left Side: Photo Capture */}
                        <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 dark:from-gray-800 dark:via-gray-800/80 dark:to-gray-900 p-8 lg:p-12 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-border-light dark:border-border-dark">
                            <div className="w-full max-w-xs">
                                <div className="text-center mb-6">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-3">
                                        <User className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-text-main dark:text-white">
                                        Photo du Participant
                                    </h2>
                                    <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                                        Prenez une photo claire du visage
                                    </p>
                                </div>

                                <PhotoCapture
                                    key={photoKey}
                                    onPhotoCapture={setPhotoFile}
                                    required={true}
                                />
                                {photoError && (
                                    <p className="text-red-500 text-sm text-center mt-3">{photoError}</p>
                                )}

                                {/* Recent Registrations Mini List */}
                                {registrations.length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-border-light/50 dark:border-border-dark/50">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
                                            Derniers ajouts
                                        </h3>
                                        <div className="space-y-2">
                                            {registrations.slice(0, 3).map((reg) => (
                                                <div key={reg.id} className="flex items-center justify-between text-sm">
                                                    <span className="text-text-main dark:text-white font-medium truncate">
                                                        {reg.name}
                                                    </span>
                                                    <Badge variant={reg.recent ? "success" : "secondary"} className="text-xs">
                                                        {reg.time}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Form */}
                        <div className="p-8 lg:p-12">
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-text-main dark:text-white">
                                        Informations du Participant
                                    </h2>
                                    <span className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary rounded-full">
                                        Étape {currentStep}/{steps.length}
                                    </span>
                                </div>

                                {/* Stepper Visual */}
                                <div className="flex gap-2 mb-6">
                                    {steps.map((step) => (
                                        <div
                                            key={step.id}
                                            className={`h-2 flex-1 rounded-full transition-all duration-300 ${step.id <= currentStep ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"
                                                }`}
                                        />
                                    ))}
                                </div>

                                <p className="text-sm text-text-secondary dark:text-gray-400 mt-1 font-medium">
                                    {steps[currentStep - 1].title}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                <div className="overflow-hidden mx-[-4px]">
                                    <div
                                        className="flex transition-transform duration-500 ease-in-out"
                                        style={{ transform: `translateX(-${(currentStep - 1) * 100}%)` }}
                                    >
                                        {/* ÉTAGE 1 : Identité */}
                                        <div className="w-full flex-shrink-0 px-1">
                                            <div className="space-y-5">
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
                                                            placeholder="Ex: Jean-Marc"
                                                            {...register("prenom")}
                                                            className={errors.prenom ? "border-red-500" : ""}
                                                        />
                                                        {errors.prenom && (
                                                            <p className="text-red-500 text-xs">{errors.prenom.message}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <Label>Genre</Label>
                                                    <div className="flex gap-3">
                                                        <label
                                                            className={`flex-1 group relative flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${selectedSexe === "homme"
                                                                ? "border-primary bg-primary/5 text-primary"
                                                                : "border-border-light dark:border-border-dark bg-white dark:bg-gray-900 text-text-main dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                                }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                value="homme"
                                                                {...register("sexe")}
                                                                className="sr-only"
                                                            />
                                                            <span className="flex items-center gap-2">
                                                                <span className="text-lg">♂</span>
                                                                Homme
                                                            </span>
                                                        </label>
                                                        <label
                                                            className={`flex-1 group relative flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${selectedSexe === "femme"
                                                                ? "border-primary bg-primary/5 text-primary"
                                                                : "border-border-light dark:border-border-dark bg-white dark:bg-gray-900 text-text-main dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                                }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                value="femme"
                                                                {...register("sexe")}
                                                                className="sr-only"
                                                            />
                                                            <span className="flex items-center gap-2">
                                                                <span className="text-lg">♀</span>
                                                                Femme
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex flex-col gap-2">
                                                        <Label htmlFor="age">Âge</Label>
                                                        <Input
                                                            id="age"
                                                            type="number"
                                                            placeholder="Ex: 25"
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

                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="telephone">
                                                        Numéro de téléphone du séminariste <span className="text-red-500">*</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                                        <Input
                                                            id="telephone"
                                                            type="tel"
                                                            placeholder="Ex: 07 00 00 00 00"
                                                            {...register("telephone")}
                                                            className={`pl-10 ${errors.telephone ? "border-red-500" : ""}`}
                                                        />
                                                    </div>
                                                    {errors.telephone && (
                                                        <p className="text-red-500 text-xs">{errors.telephone.message}</p>
                                                    )}
                                                </div>

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

                                        {/* ÉTAGE 2 : Parent & Contact */}
                                        <div className="w-full flex-shrink-0 px-1">
                                            <div className="space-y-5">
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

                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="numeroParent">
                                                        Numéro du parent <span className="text-red-500">*</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                                        <Input
                                                            id="numeroParent"
                                                            type="tel"
                                                            placeholder="Ex: 01 00 00 00 00"
                                                            {...register("numeroParent")}
                                                            className={`pl-10 ${errors.numeroParent ? "border-red-500" : ""}`}
                                                        />
                                                    </div>
                                                    {errors.numeroParent && (
                                                        <p className="text-red-500 text-xs">{errors.numeroParent.message}</p>
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="numeroUrgence">
                                                        N° Urgence <span className="text-red-500">*</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                                                        <Input
                                                            id="numeroUrgence"
                                                            type="tel"
                                                            placeholder="Ex: 05 00 00 00 00"
                                                            {...register("numeroUrgence")}
                                                            className={`pl-10 ${errors.numeroUrgence ? "border-red-500" : ""}`}
                                                        />
                                                    </div>
                                                    {errors.numeroUrgence && (
                                                        <p className="text-red-500 text-xs">{errors.numeroUrgence.message}</p>
                                                    )}
                                                </div>

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
                                            </div>
                                        </div>

                                        {/* ÉTAGE 3 : Finalisation */}
                                        <div className="w-full flex-shrink-0 px-1">
                                            <div className="space-y-5">
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
                                                    {errors.nombreParticipations && (
                                                        <p className="text-red-500 text-xs">{errors.nombreParticipations.message}</p>
                                                    )}
                                                </div>

                                                {/* Montant Payé */}
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="montantPaye" className="flex items-center gap-2">
                                                        <DollarSign className="w-4 h-4 text-emerald-600" />
                                                        Montant perçu (FCFA)
                                                    </Label>
                                                    <div className="relative">
                                                        <Input
                                                            id="montantPaye"
                                                            type="number"
                                                            min="0"
                                                            max="4000"
                                                            step="100"
                                                            placeholder="0"
                                                            {...register("montantPaye", { valueAsNumber: true })}
                                                            className={`pl-10 font-bold text-lg ${errors.montantPaye ? "border-red-500" : "border-emerald-200 focus:border-emerald-500"}`}
                                                        />
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">
                                                            FCFA
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-text-secondary">
                                                        Montant maximum : 4.000 FCFA. Ce montant sera enregistré comme payé.
                                                    </p>
                                                    {errors.montantPaye && (
                                                        <p className="text-red-500 text-xs">{errors.montantPaye.message}</p>
                                                    )}
                                                </div>

                                                {/* Affectation */}
                                                <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Building className="h-4 w-4 text-primary" />
                                                        <span className="font-semibold text-text-main dark:text-white">Affectation</span>
                                                    </div>

                                                    {/* Vue compacte des statistiques des dortoirs (Dropdown) */}
                                                    {dortoirStats.length > 0 && (
                                                        <DormitoryDropdown stats={dortoirStats} />
                                                    )}

                                                    <div className="flex flex-col gap-2 mt-4">
                                                        <Label htmlFor="dortoirId">
                                                            Dortoir <span className="text-red-500">*</span>
                                                        </Label>
                                                        <Select
                                                            id="dortoirId"
                                                            {...register("dortoirId")}
                                                            className={errors.dortoirId ? "border-red-500" : ""}
                                                        >
                                                            <option value="">Sélectionnez</option>
                                                            {dortoirs.map(dortoir => (
                                                                <option key={dortoir.id} value={dortoir.id}>
                                                                    {dortoir.nom}
                                                                </option>
                                                            ))}
                                                        </Select>
                                                        {errors.dortoirId && (
                                                            <p className="text-red-500 text-xs">{errors.dortoirId.message}</p>
                                                        )}
                                                    </div>

                                                    {/* Note sur le niveau de formation */}
                                                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                                                        <p className="text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                                                            <BookOpen className="w-4 h-4" />
                                                            <span>
                                                                <span className="font-semibold">Niveau de formation :</span> Sera attribué par la section scientifique
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3 pt-4 border-t border-border-light dark:border-border-dark mt-6">
                                    {currentStep > 1 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={prevStep}
                                            className="h-12 px-6"
                                        >
                                            Précédent
                                        </Button>
                                    )}

                                    {currentStep < steps.length ? (
                                        <Button
                                            type="button"
                                            onClick={nextStep}
                                            className="h-12 flex-1"
                                        >
                                            Suivant
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </Button>
                                    ) : (
                                        <Button
                                            type="submit"
                                            disabled={isLoading}
                                            className="h-12 flex-1 shadow-md shadow-primary/20"
                                        >
                                            {isLoading ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="h-5 w-5 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                                                    Enregistrement...
                                                </span>
                                            ) : (
                                                <>
                                                    <Save className="h-5 w-5 mr-2" />
                                                    Enregistrer
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    {currentStep === 1 && (
                                        <Button type="button" variant="ghost" className="h-12 ml-auto text-text-secondary" onClick={() => {
                                            reset();
                                            setPhotoFile(null);
                                            setPhotoKey(prev => prev + 1);
                                            setCurrentStep(1);
                                        }}>
                                            Annuler
                                        </Button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Success Toast */}
            {showSuccess && (
                <div className="fixed bottom-6 right-6 max-w-sm w-full bg-surface-light dark:bg-surface-dark border-l-4 border-primary shadow-xl rounded-r-lg p-4 flex items-start gap-3 animate-fade-in z-50">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-text-main dark:text-white text-sm">
                            Inscription enregistrée !
                        </h4>
                        <p className="text-text-secondary dark:text-gray-400 text-xs mt-1">
                            L'inscription a été validée automatiquement.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
