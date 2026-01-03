import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PhotoCapture } from "@/components/ui/photo-capture";
import {
    FileEdit,
    Save,
    Phone,
    Info,
    History,
    TrendingUp,
    CheckCircle,
    Camera,
    Building,
    BookOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts";
import { uploadPhoto } from "@/lib/storage";

const registrationSchema = z.object({
    nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
    age: z.number().min(1, "L'âge est requis").max(120, "Âge invalide"),
    sexe: z.enum(["homme", "femme"]),
    niveauEtude: z.string().min(1, "Veuillez sélectionner un niveau d'étude"),
    telephone: z.string().optional().or(z.literal("")),
    dortoirId: z.string().min(1, "Veuillez sélectionner un dortoir"),
    niveauFormation: z.string().min(1, "Veuillez sélectionner un niveau de formation"),
});

export function InPersonRegistration() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [registrations, setRegistrations] = useState([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [dortoirs, setDortoirs] = useState([]);
    const [photoError, setPhotoError] = useState(null);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(registrationSchema),
        defaultValues: {
            sexe: "homme",
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
                    .limit(10);

                if (error) throw error;

                const formatted = data.map(r => ({
                    id: r.id,
                    name: `${r.nom} ${r.prenom}`,
                    phone: r.telephone || 'N/A',
                    time: new Date(r.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    recent: new Date(r.created_at) > new Date(Date.now() - 10 * 60 * 1000), // Récent si < 10min
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
            const { data: inscription, error } = await supabase
                .from('inscriptions')
                .insert({
                    nom: data.nom,
                    prenom: data.prenom,
                    age: data.age,
                    sexe: data.sexe,
                    niveau_etude: data.niveauEtude,
                    telephone: data.telephone || null,
                    admin_id: user.id,
                    type_inscription: 'presentielle',
                    statut: 'valide', // Automatiquement validé
                    chef_quartier_id: null,
                    photo_url: photoUrl,
                    dortoir_id: data.dortoirId,
                    niveau_formation: data.niveauFormation,
                })
                .select()
                .single();

            if (error) throw error;

            // Ajouter aux inscriptions récentes
            const newRegistration = {
                id: inscription.id,
                name: `${data.nom} ${data.prenom}`,
                phone: data.telephone || 'N/A',
                time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                recent: true,
                photo_url: photoUrl,
            };
            setRegistrations([newRegistration, ...registrations.slice(0, 9)]);

            reset();
            setPhotoFile(null);
            setShowSuccess(true);
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
            <div className="max-w-[1200px] mx-auto flex flex-col gap-6">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-text-main dark:text-white tracking-tight text-3xl font-bold leading-tight">
                            Inscription Présentielle
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
                    <div className="hidden md:block">
                        <span className="text-xs font-mono bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark px-2 py-1 rounded text-text-secondary">
                            Session ID: #8821-ADM
                        </span>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Left Column: Registration Form */}
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden">
                            <CardHeader className="border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/50 px-6 py-4">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <FileEdit className="h-5 w-5 text-primary" />
                                    Formulaire d'inscription
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
                                    {/* Photo Section */}
                                    <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border-light dark:border-border-dark">
                                        <div className="flex items-center gap-2 border-b border-border-light dark:border-border-dark pb-2">
                                            <Camera className="h-5 w-5 text-primary" />
                                            <Label className="font-semibold text-text-main dark:text-white">
                                                Photo du Participant
                                            </Label>
                                            <span className="text-red-500 text-sm">*</span>
                                        </div>
                                        <PhotoCapture
                                            onPhotoCapture={setPhotoFile}
                                            required={true}
                                        />
                                        {photoError && (
                                            <p className="text-red-500 text-sm text-center">{photoError}</p>
                                        )}
                                    </div>

                                    {/* Name Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                                    {/* Gender Radio */}
                                    <div className="flex flex-col gap-2">
                                        <Label>Genre</Label>
                                        <div className="flex flex-wrap gap-3">
                                            <label
                                                className={`group relative flex cursor-pointer items-center justify-center rounded-lg border px-6 py-2.5 text-sm font-medium transition-all ${selectedSexe === "homme"
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
                                                className={`group relative flex cursor-pointer items-center justify-center rounded-lg border px-6 py-2.5 text-sm font-medium transition-all ${selectedSexe === "femme"
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

                                    {/* Age et Niveau Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                <option value="">Sélectionnez un niveau</option>
                                                <option value="aucun">Aucun</option>
                                                <option value="primaire">Primaire</option>
                                                <option value="secondaire">Secondaire</option>
                                                <option value="superieur">Universitaire</option>
                                                <option value="arabe">Arabe / Franco-arabe</option>
                                            </Select>
                                            {errors.niveauEtude && (
                                                <p className="text-red-500 text-xs">{errors.niveauEtude.message}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Téléphone (Optionnel) */}
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="telephone">Téléphone (Optionnel)</Label>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                            <Input
                                                id="telephone"
                                                type="tel"
                                                placeholder="Ex: 07 00 00 00 00"
                                                {...register("telephone")}
                                                className="pl-12"
                                            />
                                        </div>
                                        {errors.telephone && (
                                            <p className="text-red-500 text-xs">{errors.telephone.message}</p>
                                        )}
                                    </div>

                                    {/* Affectation Formation */}
                                    <div className="flex flex-col gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                                        <div className="flex items-center gap-2 border-b border-primary/20 pb-2">
                                            <Building className="h-5 w-5 text-primary" />
                                            <Label className="font-semibold text-text-main dark:text-white">
                                                Affectation
                                            </Label>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <Label htmlFor="dortoirId">
                                                    Salle de dortoir <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    id="dortoirId"
                                                    {...register("dortoirId")}
                                                    className={errors.dortoirId ? "border-red-500" : ""}
                                                >
                                                    <option value="">Sélectionnez un dortoir</option>
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
                                            <div className="flex flex-col gap-2">
                                                <Label htmlFor="niveauFormation">
                                                    Niveau de formation <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    id="niveauFormation"
                                                    {...register("niveauFormation")}
                                                    className={errors.niveauFormation ? "border-red-500" : ""}
                                                >
                                                    <option value="">Sélectionnez un niveau</option>
                                                    <option value="debutant">Débutant</option>
                                                    <option value="normal">Normal</option>
                                                    <option value="superieur">Supérieur</option>
                                                </Select>
                                                {errors.niveauFormation && (
                                                    <p className="text-red-500 text-xs">{errors.niveauFormation.message}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* System Note */}
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-border-light dark:border-border-dark flex items-start gap-3">
                                        <Info className="h-5 w-5 text-text-secondary flex-shrink-0 mt-0.5" />
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-semibold text-text-main dark:text-white uppercase tracking-wider">
                                                Note Système
                                            </span>
                                            <p className="text-xs text-text-secondary dark:text-gray-400">
                                                Le champ "Chef de Quartier" est automatiquement assigné à votre compte
                                                administrateur pour cette session.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-4 pt-2">
                                        <Button
                                            type="submit"
                                            disabled={isLoading}
                                            className="flex-1 h-12 shadow-sm shadow-primary/30"
                                        >
                                            {isLoading ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="h-5 w-5 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                                                    Enregistrement...
                                                </span>
                                            ) : (
                                                <>
                                                    <Save className="h-5 w-5 mr-2" />
                                                    Enregistrer l'inscription
                                                </>
                                            )}
                                        </Button>
                                        <Button type="button" variant="outline" className="h-12" onClick={() => reset()}>
                                            Annuler
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Recent Activity */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        <Card className="flex flex-col max-h-[500px]">
                            <div className="border-b border-border-light dark:border-border-dark p-4 flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-text-main dark:text-white flex items-center gap-2">
                                    <History className="h-4 w-4 text-text-secondary" />
                                    Derniers ajouts ({registrations.length})
                                </h2>
                                <button className="text-xs text-primary font-medium hover:underline">
                                    Voir tout
                                </button>
                            </div>
                            <div className="overflow-y-auto flex-1 p-2">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 text-xs font-medium text-text-secondary uppercase tracking-wider rounded-l-md">
                                                Nom
                                            </th>
                                            <th className="p-3 text-xs font-medium text-text-secondary uppercase tracking-wider rounded-r-md text-right">
                                                Heure
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                        {registrations.map((registration) => (
                                            <tr
                                                key={registration.id}
                                                className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                            >
                                                <td className="p-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-text-main dark:text-white group-hover:text-primary transition-colors">
                                                            {registration.name}
                                                        </span>
                                                        <span className="text-xs text-text-secondary">{registration.phone}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right align-top">
                                                    <Badge variant={registration.recent ? "success" : "secondary"}>
                                                        {registration.time}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Mini Status Footer */}
                            <div className="p-3 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/50">
                                <div className="flex justify-between items-center text-xs text-text-secondary dark:text-gray-400">
                                    <span>
                                        Total Session:{" "}
                                        <span className="font-bold text-text-main dark:text-white">
                                            {registrations.length}
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                        En ligne
                                    </span>
                                </div>
                            </div>
                        </Card>

                        {/* Quick Stats Card */}
                        <Card className="bg-primary/10 border-primary/20 p-4 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                    Objectif du jour
                                </span>
                                <span className="text-2xl font-bold text-text-main dark:text-white">85%</span>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-white dark:bg-background-dark flex items-center justify-center shadow-sm">
                                <TrendingUp className="h-5 w-5 text-primary" />
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-8 text-center text-xs text-text-secondary dark:text-gray-500 pb-4">
                    © 2024 SEFIMAP - Système d'Enregistrement de la Formation Islamique. Tous droits réservés.
                </footer>
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
