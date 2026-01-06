import { useState, useRef, useCallback, useEffect } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
    Camera,
    RefreshCw,
    Check,
    User,
    Phone,
    GraduationCap,
    AlertCircle,
    Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadPhoto } from "@/lib/storage";

const registrationSchema = z.object({
    nom: z.string().min(2, "Nom requis (min 2 caractères)"),
    prenom: z.string().min(2, "Prénom requis (min 2 caractères)"),
    age: z.coerce.number().min(1, "Âge invalide").max(120, "Âge invalide"),
    sexe: z.enum(["homme", "femme"], { required_error: "Sexe requis" }),
    niveauEtude: z.string().min(1, "Niveau d'étude requis"),
    ecole: z.string().optional(),
    telephone: z.string().min(8, "Numéro invalide").optional().or(z.literal("")),
    nomParent: z.string().min(2, "Nom du parent requis"),
    prenomParent: z.string().min(2, "Prénom du parent requis"),
    numeroParent: z.string().min(8, "Numéro du parent invalide"),
    numeroUrgence: z.string().min(8, "Numéro d'urgence invalide"),
    lieuHabitation: z.string().min(2, "Lieu d'habitation requis"),
    nombreParticipations: z.coerce.number().min(0, "Valeur invalide"),
    montantPaye: z.coerce.number().min(0, "Montant invalide").max(4000, "Montant max: 4000"),
    modePaiement: z.enum(["especes", "mobile_money", "virement"]).optional(),
});

export function PresidentRegistration() {
    const { president } = useOutletContext();
    const { lienUnique } = useParams();

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [recentRegistrations, setRecentRegistrations] = useState([]);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
        watch,
    } = useForm({
        resolver: zodResolver(registrationSchema),
        defaultValues: {
            nombreParticipations: 0,
            montantPaye: 0,
        },
    });

    const montantPaye = watch("montantPaye");

    useEffect(() => {
        if (president?.id) {
            loadRecentRegistrations();
        }
    }, [president?.id]);

    const loadRecentRegistrations = async () => {
        try {
            const { data, error } = await supabase
                .from("inscriptions")
                .select("id, nom, prenom, created_at, montant_total_paye, statut_paiement")
                .eq("chef_quartier_id", president.id)
                .order("created_at", { ascending: false })
                .limit(5);

            if (!error) {
                setRecentRegistrations(data || []);
            }
        } catch (err) {
            console.error("Erreur chargement:", err);
        }
    };

    // Camera functions
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: 640, height: 480 },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsCameraActive(true);
        } catch (err) {
            console.error("Erreur caméra:", err);
            alert("Impossible d'accéder à la caméra");
        }
    };

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
    }, []);

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
                    setPhotoFile(file);
                    setPhotoPreview(URL.createObjectURL(blob));
                    stopCamera();
                }
            },
            "image/jpeg",
            0.9
        );
    };

    const resetPhoto = () => {
        setPhotoFile(null);
        setPhotoPreview(null);
        stopCamera();
    };

    const onSubmit = async (data) => {
        if (!photoFile) {
            setSubmitError("La photo est obligatoire");
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Upload photo
            const photoUrl = await uploadPhoto(photoFile, "president");

            // Calculate payment status
            let statutPaiement = "non_payé";
            if (data.montantPaye >= 4000) {
                statutPaiement = "soldé";
            } else if (data.montantPaye > 0) {
                statutPaiement = "partiel";
            }

            // Insert inscription
            const { data: inscription, error: inscError } = await supabase
                .from("inscriptions")
                .insert({
                    nom: data.nom,
                    prenom: data.prenom,
                    age: data.age,
                    sexe: data.sexe,
                    niveau_etude: data.niveauEtude,
                    ecole: data.ecole || null,
                    telephone: data.telephone || null,
                    nom_parent: data.nomParent,
                    prenom_parent: data.prenomParent,
                    numero_parent: data.numeroParent,
                    numero_urgence: data.numeroUrgence,
                    lieu_habitation: data.lieuHabitation,
                    nombre_participations: data.nombreParticipations,
                    chef_quartier_id: president.id,
                    type_inscription: "en_ligne",
                    statut: "en_attente",
                    photo_url: photoUrl,
                    montant_total_paye: data.montantPaye || 0,
                    statut_paiement: statutPaiement,
                    mode_paiement: data.modePaiement || null,
                })
                .select()
                .single();

            if (inscError) throw inscError;

            // If payment was made, record it
            if (data.montantPaye > 0) {
                await supabase.from("paiements").insert({
                    inscription_id: inscription.id,
                    montant: data.montantPaye,
                    mode_paiement: data.modePaiement || "especes",
                    statut: data.montantPaye >= 4000 ? "validé" : "attente",
                    type_paiement: "inscription",
                });
            }

            setSubmitSuccess(true);
            reset();
            resetPhoto();
            loadRecentRegistrations();

            setTimeout(() => setSubmitSuccess(false), 3000);
        } catch (error) {
            console.error("Erreur inscription:", error);
            setSubmitError(error.message || "Erreur lors de l'inscription");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatMontant = (montant) => {
        return new Intl.NumberFormat("fr-FR").format(montant || 0) + " FCFA";
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark py-4 px-8 flex-shrink-0">
                <h1 className="text-2xl font-bold text-text-main dark:text-white tracking-tight">
                    Nouvelle Inscription
                </h1>
                <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                    Inscrivez un nouveau membre de votre section ({president?.zone})
                </p>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Form Column */}
                        <div className="lg:col-span-2">
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                {/* Success Message */}
                                {submitSuccess && (
                                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
                                        <Check className="h-5 w-5 text-green-600" />
                                        <p className="text-green-800 dark:text-green-300 font-medium">
                                            Inscription enregistrée avec succès!
                                        </p>
                                    </div>
                                )}

                                {/* Error Message */}
                                {submitError && (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                        <p className="text-red-800 dark:text-red-300 font-medium">
                                            {submitError}
                                        </p>
                                    </div>
                                )}

                                {/* Photo Section */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Camera className="h-5 w-5 text-amber-500" />
                                            Photo du participant
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col items-center gap-4">
                                            {photoPreview ? (
                                                <div className="relative">
                                                    <img
                                                        src={photoPreview}
                                                        alt="Preview"
                                                        className="w-48 h-48 object-cover rounded-lg border-4 border-amber-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={resetPhoto}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : isCameraActive ? (
                                                <div className="relative">
                                                    <video
                                                        ref={videoRef}
                                                        autoPlay
                                                        playsInline
                                                        className="w-64 h-48 object-cover rounded-lg bg-black"
                                                    />
                                                    <canvas ref={canvasRef} className="hidden" />
                                                    <div className="flex gap-2 mt-4 justify-center">
                                                        <Button type="button" onClick={capturePhoto}>
                                                            <Camera className="h-4 w-4 mr-2" />
                                                            Capturer
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={stopCamera}
                                                        >
                                                            Annuler
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    onClick={startCamera}
                                                    className="bg-amber-600 hover:bg-amber-700"
                                                >
                                                    <Camera className="h-4 w-4 mr-2" />
                                                    Prendre une photo
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Identity Section */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <User className="h-5 w-5 text-amber-500" />
                                            Identité du participant
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="nom">Nom *</Label>
                                            <Input
                                                id="nom"
                                                {...register("nom")}
                                                className={errors.nom ? "border-red-500" : ""}
                                            />
                                            {errors.nom && (
                                                <p className="text-red-500 text-xs mt-1">{errors.nom.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label htmlFor="prenom">Prénom *</Label>
                                            <Input
                                                id="prenom"
                                                {...register("prenom")}
                                                className={errors.prenom ? "border-red-500" : ""}
                                            />
                                            {errors.prenom && (
                                                <p className="text-red-500 text-xs mt-1">{errors.prenom.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label htmlFor="age">Âge *</Label>
                                            <Input
                                                id="age"
                                                type="number"
                                                {...register("age")}
                                                className={errors.age ? "border-red-500" : ""}
                                            />
                                            {errors.age && (
                                                <p className="text-red-500 text-xs mt-1">{errors.age.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label>Sexe *</Label>
                                            <Select onValueChange={(val) => setValue("sexe", val)}>
                                                <SelectTrigger className={errors.sexe ? "border-red-500" : ""}>
                                                    <SelectValue placeholder="Sélectionner" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="homme">Homme</SelectItem>
                                                    <SelectItem value="femme">Femme</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {errors.sexe && (
                                                <p className="text-red-500 text-xs mt-1">{errors.sexe.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label>Niveau d'étude *</Label>
                                            <Select onValueChange={(val) => setValue("niveauEtude", val)}>
                                                <SelectTrigger className={errors.niveauEtude ? "border-red-500" : ""}>
                                                    <SelectValue placeholder="Sélectionner" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="aucun">Aucun</SelectItem>
                                                    <SelectItem value="primaire">Primaire</SelectItem>
                                                    <SelectItem value="secondaire">Secondaire</SelectItem>
                                                    <SelectItem value="superieur">Supérieur</SelectItem>
                                                    <SelectItem value="arabe">Arabe</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {errors.niveauEtude && (
                                                <p className="text-red-500 text-xs mt-1">{errors.niveauEtude.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label htmlFor="ecole">École (optionnel)</Label>
                                            <Input id="ecole" {...register("ecole")} />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Contact Section */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Phone className="h-5 w-5 text-amber-500" />
                                            Contacts
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="telephone">Téléphone participant</Label>
                                            <Input id="telephone" {...register("telephone")} />
                                        </div>
                                        <div>
                                            <Label htmlFor="lieuHabitation">Lieu d'habitation *</Label>
                                            <Input
                                                id="lieuHabitation"
                                                {...register("lieuHabitation")}
                                                className={errors.lieuHabitation ? "border-red-500" : ""}
                                            />
                                            {errors.lieuHabitation && (
                                                <p className="text-red-500 text-xs mt-1">{errors.lieuHabitation.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label htmlFor="nomParent">Nom du parent *</Label>
                                            <Input
                                                id="nomParent"
                                                {...register("nomParent")}
                                                className={errors.nomParent ? "border-red-500" : ""}
                                            />
                                            {errors.nomParent && (
                                                <p className="text-red-500 text-xs mt-1">{errors.nomParent.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label htmlFor="prenomParent">Prénom du parent *</Label>
                                            <Input
                                                id="prenomParent"
                                                {...register("prenomParent")}
                                                className={errors.prenomParent ? "border-red-500" : ""}
                                            />
                                            {errors.prenomParent && (
                                                <p className="text-red-500 text-xs mt-1">{errors.prenomParent.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label htmlFor="numeroParent">N° parent *</Label>
                                            <Input
                                                id="numeroParent"
                                                {...register("numeroParent")}
                                                className={errors.numeroParent ? "border-red-500" : ""}
                                            />
                                            {errors.numeroParent && (
                                                <p className="text-red-500 text-xs mt-1">{errors.numeroParent.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label htmlFor="numeroUrgence">N° urgence *</Label>
                                            <Input
                                                id="numeroUrgence"
                                                {...register("numeroUrgence")}
                                                className={errors.numeroUrgence ? "border-red-500" : ""}
                                            />
                                            {errors.numeroUrgence && (
                                                <p className="text-red-500 text-xs mt-1">{errors.numeroUrgence.message}</p>
                                            )}
                                        </div>
                                        <div>
                                            <Label htmlFor="nombreParticipations">Participations antérieures</Label>
                                            <Input
                                                id="nombreParticipations"
                                                type="number"
                                                min="0"
                                                {...register("nombreParticipations")}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Payment Section */}
                                <Card className="border-amber-200 dark:border-amber-800">
                                    <CardHeader className="bg-amber-50 dark:bg-amber-900/20">
                                        <CardTitle className="flex items-center gap-2 text-lg text-amber-800 dark:text-amber-300">
                                            <Wallet className="h-5 w-5" />
                                            Paiement (Montant requis: 4.000 FCFA)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="montantPaye">Montant payé (FCFA)</Label>
                                            <Input
                                                id="montantPaye"
                                                type="number"
                                                min="0"
                                                max="4000"
                                                {...register("montantPaye")}
                                                className="border-amber-300 focus:border-amber-500"
                                            />
                                            {montantPaye > 0 && montantPaye < 4000 && (
                                                <p className="text-amber-600 text-xs mt-1">
                                                    Reste: {formatMontant(4000 - montantPaye)}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <Label>Mode de paiement</Label>
                                            <Select onValueChange={(val) => setValue("modePaiement", val)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Sélectionner" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="especes">Espèces</SelectItem>
                                                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                                    <SelectItem value="virement">Virement</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Submit Button */}
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white"
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Enregistrement...
                                        </span>
                                    ) : (
                                        <>
                                            <Check className="h-5 w-5 mr-2" />
                                            Enregistrer l'inscription
                                        </>
                                    )}
                                </Button>
                            </form>
                        </div>

                        {/* Recent Registrations Sidebar */}
                        <div className="lg:col-span-1">
                            <Card className="sticky top-4">
                                <CardHeader>
                                    <CardTitle className="text-lg">Inscriptions récentes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {recentRegistrations.length === 0 ? (
                                        <p className="text-text-secondary text-sm text-center py-4">
                                            Aucune inscription pour le moment
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {recentRegistrations.map((reg) => (
                                                <div
                                                    key={reg.id}
                                                    className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                                                >
                                                    <p className="font-medium text-text-main dark:text-white">
                                                        {reg.nom} {reg.prenom}
                                                    </p>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-xs text-text-secondary">
                                                            {new Date(reg.created_at).toLocaleDateString("fr-FR")}
                                                        </span>
                                                        <span
                                                            className={`text-xs font-medium px-2 py-0.5 rounded ${
                                                                reg.statut_paiement === "soldé"
                                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                    : reg.statut_paiement === "partiel"
                                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                            }`}
                                                        >
                                                            {formatMontant(reg.montant_total_paye)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
