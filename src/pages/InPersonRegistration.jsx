import { useState, useEffect, useCallback } from "react";
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
    Ticket,
    Search,
    Lock,
    QrCode,
    Smartphone,
    X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";
import { useAuth, useData } from "@/contexts";
import { uploadPhoto } from "@/lib/storage";
import { DormitoryDropdown } from "@/components/DormitoryDropdown";
import { notify } from "@/components/ui/toast";

// Finalisation présentielle (cellule secrétariat) : la finance a préinscrit
// (nom, prénom, montant → code SEFI-). Le secrétaire retrouve le dossier par
// son code puis complète : identité, contacts, dortoir, photo.
// Nom/prénom saisis par la finance : VERROUILLÉS (non modifiables).
const completionSteps = [
    { id: 1, title: "Identité", fields: ["sexe", "age", "niveauEtude", "telephone", "ecole"] },
    { id: 2, title: "Parents & Contact", fields: ["nomParent", "prenomParent", "numeroParent", "lieuHabitation", "numeroUrgence"] },
    { id: 3, title: "Finalisation", fields: ["nombreParticipations", "dortoirId"] }
];

const completionSchema = z.object({
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
});

export function InPersonRegistration() {
    const { user } = useAuth();
    const { dortoirs: contextDortoirs, updateInscriptionLocal } = useData();

    const [isLoading, setIsLoading] = useState(false);
    const [registrations, setRegistrations] = useState([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [dortoirStats, setDortoirStats] = useState([]);
    const [photoError, setPhotoError] = useState(null);
    const [photoKey, setPhotoKey] = useState(0);
    const [qrSession, setQrSession] = useState(null);
    const [qrLeft, setQrLeft] = useState(0);
    const [remotePhoto, setRemotePhoto] = useState(null);
    const [remoteAccepted, setRemoteAccepted] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [showAllRecent, setShowAllRecent] = useState(false);
    // Dossier préinscrit retrouvé par code (null = phase de recherche)
    const [dossier, setDossier] = useState(null);
    const [code, setCode] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);

    const dortoirs = contextDortoirs || [];

    const steps = completionSteps;

    const {
        register,
        handleSubmit,
        reset,
        trigger,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(completionSchema),
        defaultValues: {
            sexe: "homme",
            nombreParticipations: 0,
        },
    });

    const sexeParticipant = watch("sexe");

    // Ne proposer que les dortoirs du même sexe que le participant (tout afficher si inconnu)
    const dortoirsFiltres = (sexeParticipant === "homme" || sexeParticipant === "femme")
        ? dortoirs.filter((d) => !d.sexe || d.sexe === sexeParticipant)
        : dortoirs;

    // Libellé du dortoir avec repère de sexe : rose = femme, vert = homme
    const getDortoirOptionLabel = (dortoir) => {
        if (dortoir?.sexe === "femme") return `\u2640 ${dortoir.nom}`;
        if (dortoir?.sexe === "homme") return `\u2642 ${dortoir.nom}`;
        return dortoir.nom;
    };

    const rechercherDossier = useCallback(async (codeSaisi) => {
        const ref = (codeSaisi || "").trim().toUpperCase();
        if (!ref) {
            setSearchError("Saisissez le code remis au participant (ex : SEFI-12).");
            return;
        }
        setSearching(true);
        setSearchError(null);
        try {
            const { data, error } = await supabase
                .from("inscriptions")
                .select("id, reference_id, nom, prenom, montant_total_paye, montant_requis, dossier_complet, statut, type_inscription, created_at")
                .eq("reference_id", ref)
                .order("created_at", { ascending: false });
            if (error) throw error;
            const rows = data;
            if (!rows || rows.length === 0) {
                setSearchError(`Aucun dossier trouvé pour le code ${ref}. Vérifiez le code.`);
                return;
            }
            const dossierTrouve = rows.find((r) => r.type_inscription === "presentielle" && r.dossier_complet === false) || null;
            if (!dossierTrouve) {
                setSearchError(`Le dossier ${ref} est déjà complété (ou n'est pas une préinscription).`);
                return;
            }
            reset({ sexe: "homme", nombreParticipations: 0 });
            setPhotoFile(null);
            setPhotoKey((prev) => prev + 1);
            setPhotoError(null);
            setCurrentStep(1);
            setQrSession(null);
            setRemotePhoto(null);
            setRemoteAccepted(false);
            setDossier(dossierTrouve);
        } catch (err) {
            console.error("Erreur recherche dossier:", err);
            setSearchError("Recherche impossible, réessayez.");
        } finally {
            setSearching(false);
        }
    }, [reset]);

    const nextStep = useCallback(async () => {
        const fields = completionSteps[currentStep - 1].fields;
        const isValid = await trigger(fields);
        if (isValid) {
            requestAnimationFrame(() => {
                setCurrentStep((prev) => Math.min(prev + 1, completionSteps.length));
            });
        }
    }, [currentStep, trigger]);

    const prevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    // Charger les dossiers présentiels récents (finalisés)
    useEffect(() => {
        async function loadRecentRegistrations() {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('inscriptions')
                    .select('*')
                    .eq('type_inscription', 'presentielle')
                    .eq('dossier_complet', true)
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (error) throw error;
                const formatted = data.map(r => ({
                    id: r.id,
                    name: `${r.nom} ${r.prenom}`,
                    phone: r.telephone || 'N/A',
                    time: new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                    date: new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
                    recent: new Date(r.created_at) > new Date(Date.now() - 10 * 60 * 1000),
                }));
                setRegistrations(formatted);
            } catch (error) {
                console.error('Erreur chargement inscriptions:', error);
            }
        }
        loadRecentRegistrations();
    }, [user, showSuccess]);

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
        const interval = setInterval(loadDortoirStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const fermerQR = async (supprimer = false) => {
        if (supprimer && qrSession) {
            await supabase.from("photo_sessions").delete().eq("id", qrSession.id);
        }
        setQrSession(null);
    };

    const genererQR = async () => {
        if (!dossier) return;
        try {
            await supabase.from("photo_sessions").delete().eq("inscription_id", dossier.id).eq("status", "pending");
            const token = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const { data, error } = await supabase.from("photo_sessions").insert({ token, inscription_id: dossier.id }).select("id, token, expires_at").single();
            if (error) throw error;
            const base = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, "");
            setRemotePhoto(null);
            setRemoteAccepted(false);
            setQrSession({ id: data.id, token: data.token, url: `${base}/scan/${data.token}`, expiresAt: data.expires_at });
        } catch (err) {
            console.error("QR:", err);
            notify.error("Génération du QR impossible.", { title: "QR code" });
        }
    };

    // Compte à rebours de la modale QR.
    useEffect(() => {
        if (!qrSession) return;
        const tick = setInterval(() => {
            const restant = Math.max(0, Math.floor((new Date(qrSession.expiresAt).getTime() - Date.now()) / 1000));
            setQrLeft(restant);
            if (restant <= 0) setQrSession(null);
        }, 1000);
        return () => clearInterval(tick);
    }, [qrSession?.id]);

    // Temps réel dossier : la photo envoyée depuis le téléphone arrive ici,
    // même si la modale QR est fermée (filtre par dossier, pas par session).
    useEffect(() => {
        if (!dossier?.id) return;
        const channel = supabase.channel(`photo-qr-dos-${dossier.id}`).on(
            "postgres_changes",
            { event: "*", schema: "public", table: "photo_sessions", filter: `inscription_id=eq.${dossier.id}` },
            (payload) => {
                const row = payload.new;
                if (row?.photo_url && row?.status === "used") {
                    setRemotePhoto(row.photo_url);
                    setQrSession(null);
                    notify.success("Photo reçue du téléphone — à confirmer.", { title: "Photo reçue" });
                }
            }
        ).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [dossier?.id]);

    const onSubmit = async (data) => {
        if (!dossier) return;
        if (!photoFile && !remoteAccepted) {
            setPhotoError("La photo est obligatoire");
            return;
        }
        const dortoirChoisi = dortoirs.find((d) => d.id === data.dortoirId);
        if ((data.sexe === "homme" || data.sexe === "femme") && dortoirChoisi?.sexe && dortoirChoisi.sexe !== data.sexe) {
            notify.error(`Le dortoir "${dortoirChoisi.nom}" est réservé aux ${dortoirChoisi.sexe === "femme" ? "femmes" : "hommes"}.`, { title: "Affectation impossible" });
            return;
        }
        setPhotoError(null);
        setIsLoading(true);
        try {
            const photoUrl = remoteAccepted && remotePhoto ? remotePhoto : await uploadPhoto(photoFile, 'presentiel');
            const now = new Date().toISOString();
            const updateData = {
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
                photo_url: photoUrl,
                dortoir_id: data.dortoirId,
                statut: 'valide',
                statut_workflow: 'valide',
                valide_par_secretariat: user?.id || null,
                date_validation_secretariat: now,
                valide_par_financier: user?.id || null,
                date_validation_financier: now,
                dossier_complet: true,
            };
            const { error } = await supabase
                .from('inscriptions')
                .update(updateData)
                .eq('id', dossier.id);
            if (error) throw error;

            updateInscriptionLocal?.(dossier.id, { ...updateData, nom: dossier.nom, prenom: dossier.prenom });

            setDossier(null);
            setCode("");
            reset({ sexe: "homme", nombreParticipations: 0 });
            setPhotoFile(null);
            setPhotoKey((prev) => prev + 1);
            setCurrentStep(1);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
            notify.success(`Dossier ${dossier.reference_id} complété et validé.`, { title: "Finalisation réussie" });
        } catch (error) {
            console.error("Erreur finalisation:", error);
            notify.error(error.message || "Finalisation impossible", { title: "Erreur" });
        } finally {
            setIsLoading(false);
        }
    };

    const visibleRegistrations = showAllRecent ? registrations : registrations.slice(0, 3);

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-[1200px] mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-text-main dark:text-white tracking-tight text-3xl font-bold leading-tight">
                            Finaliser une inscription
                        </h1>
                        <div className="flex items-center gap-2 text-text-secondary dark:text-gray-400 text-sm">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            <span>
                                Préinscription finance → complétée ici par le secrétariat
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="min-w-[108px] rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
                            <span className="block text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                                Finalisés
                            </span>
                            <p className="mt-1 text-2xl font-bold leading-none text-primary">
                                {registrations.length}
                            </p>
                        </div>
                    </div>
                </div>

                <Card className="overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                        <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 dark:from-gray-800 dark:via-gray-800/80 dark:to-gray-900 p-8 lg:p-12 flex flex-col items-center justify-start border-b lg:border-b-0 lg:border-r border-border-light dark:border-border-dark">
                            <div className="w-full max-w-xs">
                                {!dossier ? (
                                    <>
                                        <div className="text-center mb-6">
                                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-3">
                                                <Ticket className="h-6 w-6" />
                                            </div>
                                            <h2 className="text-xl font-bold text-text-main dark:text-white">
                                                Code du participant
                                            </h2>
                                            <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                                                Code SEFI- remis par la finance
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <Input
                                                id="code-recherche"
                                                placeholder="Ex : SEFI-12"
                                                value={code}
                                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                                onKeyDown={(e) => { if (e.key === "Enter") rechercherDossier(code); }}
                                                className="text-center font-mono text-lg tracking-wider"
                                            />
                                            <Button onClick={() => rechercherDossier(code)} disabled={searching} className="gap-2">
                                                <Search className="h-4 w-4" />
                                                {searching ? "Recherche..." : "Rechercher"}
                                            </Button>
                                            {searchError && (
                                                <p className="text-red-500 text-sm text-center">{searchError}</p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
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
                                        <div className="mb-6 p-4 rounded-xl bg-white dark:bg-gray-900 border border-border-light dark:border-border-dark">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-mono font-bold text-primary">{dossier.reference_id}</span>
                                                <Badge variant="warning">À compléter</Badge>
                                            </div>
                                            <p className="font-semibold text-text-main dark:text-white flex items-center gap-2">
                                                {dossier.nom} {dossier.prenom}
                                                <Lock className="h-3.5 w-3.5 text-text-secondary" />
                                            </p>
                                            <p className="text-sm text-text-secondary dark:text-gray-400">
                                                Déjà payé : {(dossier.montant_total_paye || 0).toLocaleString("fr-FR")} FCFA
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => { setDossier(null); setCode(""); setSearchError(null); setQrSession(null); setRemotePhoto(null); setRemoteAccepted(false); }}
                                                className="text-xs font-medium text-primary hover:underline mt-2"
                                            >
                                                Changer de dossier
                                            </button>
                                        </div>
                                        <PhotoCapture
                                            key={photoKey}
                                            onPhotoCapture={(f) => { setPhotoFile(f); if (f) { setRemoteAccepted(false); } }}
                                            required={true}
                                        />
                                        <Button type="button" variant="outline" className="w-full gap-2 mt-3" onClick={genererQR}>
                                            <Smartphone className="h-4 w-4" />
                                            Photo par téléphone (QR)
                                        </Button>
                                        {remotePhoto && !remoteAccepted && (
                                            <div className="mt-3 p-3 rounded-xl border border-emerald-500/50 bg-emerald-500/5">
                                                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2">Photo reçue — à confirmer</p>
                                                <img src={remotePhoto} alt="Photo téléphone" className="w-full rounded-lg border border-border-light dark:border-border-dark" />
                                                <div className="flex gap-2 mt-2">
                                                    <Button type="button" className="flex-1" onClick={() => { setRemoteAccepted(true); setPhotoError(null); }}>Accepter</Button>
                                                    <Button type="button" variant="outline" className="flex-1" onClick={() => { setRemotePhoto(null); setRemoteAccepted(false); }}>Refuser</Button>
                                                </div>
                                            </div>
                                        )}
                                        {remoteAccepted && remotePhoto && (
                                            <div className="mt-3 p-3 rounded-xl border border-primary/40 bg-primary/5">
                                                <p className="text-sm font-semibold text-primary mb-2">Photo du téléphone acceptée</p>
                                                <img src={remotePhoto} alt="Photo acceptée" className="w-full rounded-lg border border-border-light dark:border-border-dark" />
                                                <button type="button" onClick={() => { setRemoteAccepted(false); setRemotePhoto(null); }} className="text-xs font-medium text-primary hover:underline mt-2">Utiliser une autre photo</button>
                                            </div>
                                        )}
                                        {photoError && (
                                            <p className="text-red-500 text-sm text-center mt-3">{photoError}</p>
                                        )}
                                    </>
                                )}

                                {registrations.length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-border-light/50 dark:border-border-dark/50">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                                Derniers finalisés
                                            </h3>
                                            {registrations.length > 3 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAllRecent(prev => !prev)}
                                                    className="text-xs font-medium text-primary hover:underline"
                                                >
                                                    {showAllRecent ? "Réduire" : `Afficher les ${registrations.length - 3} autres`}
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {visibleRegistrations.map((reg) => (
                                                <div key={reg.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm">
                                                    <div className="min-w-0">
                                                        <span className="block truncate font-medium text-text-main dark:text-white">
                                                            {reg.name}
                                                        </span>
                                                        <span className="text-xs text-text-secondary dark:text-gray-400">
                                                            {reg.date}
                                                        </span>
                                                    </div>
                                                    <Badge variant={reg.recent ? "success" : "secondary"} className="shrink-0 text-xs">
                                                        {reg.time}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-8 lg:p-12">
                            {!dossier ? (
                                <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-12">
                                    <Ticket className="h-10 w-10 text-text-secondary opacity-50" />
                                    <p className="font-semibold text-text-main dark:text-white">
                                        En attente du code participant
                                    </p>
                                    <p className="text-sm text-text-secondary dark:text-gray-400 max-w-sm">
                                        Saisissez le code SEFI- remis par la finance : le dossier préinscrit
                                        (nom, prénom verrouillés) s'affichera pour complétion.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-xl font-bold text-text-main dark:text-white">
                                                Compléter le dossier
                                            </h2>
                                            <span className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary rounded-full">
                                                Étape {currentStep}/{steps.length}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 mb-6">
                                            {steps.map((step) => (
                                                <div
                                                    key={step.id}
                                                    className={`h-2 flex-1 rounded-full transition-all duration-300 ${step.id <= currentStep ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`}
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
                                                className="flex items-start transition-transform duration-500 ease-in-out will-change-transform"
                                                style={{
                                                    transform: `translate3d(-${(currentStep - 1) * 100}%, 0, 0)`,
                                                    backfaceVisibility: 'hidden',
                                                }}
                                            >
                                                <div className="w-full flex-shrink-0 px-1">
                                                    <div className="space-y-5">
                                                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark">
                                                            <p className="text-xs uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1">
                                                                <Lock className="h-3 w-3" /> Saisi par la finance
                                                            </p>
                                                            <p className="font-bold text-text-main dark:text-white">
                                                                {dossier.nom} {dossier.prenom}
                                                            </p>
                                                            <p className="text-sm text-text-secondary dark:text-gray-400">
                                                                {(dossier.montant_total_paye || 0).toLocaleString("fr-FR")} FCFA déjà encaissés
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-col gap-2">
                                                            <Label>Genre</Label>
                                                            <div className="flex gap-3">
                                                                <label className="flex-1 relative flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all border-border-light dark:border-border-dark bg-white dark:bg-gray-900 text-text-main dark:text-gray-300">
                                                                    <input type="radio" value="homme" {...register("sexe")} className="sr-only" defaultChecked />
                                                                    <span className="flex items-center gap-2"><span className="text-lg">♂</span> Homme</span>
                                                                </label>
                                                                <label className="flex-1 relative flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all border-border-light dark:border-border-dark bg-white dark:bg-gray-900 text-text-main dark:text-gray-300">
                                                                    <input type="radio" value="femme" {...register("sexe")} className="sr-only" />
                                                                    <span className="flex items-center gap-2"><span className="text-lg">♀</span> Femme</span>
                                                                </label>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="flex flex-col gap-2">
                                                                <Label htmlFor="age">Âge</Label>
                                                                <Input id="age" type="number" placeholder="Ex: 25" {...register("age", { valueAsNumber: true })} className={errors.age ? "border-red-500" : ""} />
                                                                {errors.age && <p className="text-red-500 text-xs">{errors.age.message}</p>}
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <Label htmlFor="niveauEtude">Niveau d'étude</Label>
                                                                <Select id="niveauEtude" {...register("niveauEtude")} className={errors.niveauEtude ? "border-red-500" : ""}>
                                                                    <option value="">Sélectionnez</option>
                                                                    <option value="aucun">Aucun</option>
                                                                    <option value="primaire">Primaire</option>
                                                                    <option value="secondaire">Secondaire</option>
                                                                    <option value="superieur">Universitaire</option>
                                                                    <option value="arabe">Arabe</option>
                                                                </Select>
                                                                {errors.niveauEtude && <p className="text-red-500 text-xs">{errors.niveauEtude.message}</p>}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-2">
                                                            <Label htmlFor="telephone">Numéro de téléphone du séminariste <span className="text-red-500">*</span></Label>
                                                            <div className="relative">
                                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                                                <Input id="telephone" type="tel" placeholder="Ex: 07 00 00 00 00" {...register("telephone")} className={`pl-10 ${errors.telephone ? "border-red-500" : ""}`} />
                                                            </div>
                                                            {errors.telephone && <p className="text-red-500 text-xs">{errors.telephone.message}</p>}
                                                        </div>

                                                        <div className="flex flex-col gap-2">
                                                            <Label htmlFor="ecole">École</Label>
                                                            <Input id="ecole" placeholder="Ex: Lycée Moderne de Yopougon" {...register("ecole")} />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="w-full flex-shrink-0 px-1">
                                                    <div className="space-y-5">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="flex flex-col gap-2">
                                                                <Label htmlFor="nomParent">Nom du parent <span className="text-red-500">*</span></Label>
                                                                <Input id="nomParent" placeholder="Ex: Traoré" {...register("nomParent")} className={errors.nomParent ? "border-red-500" : ""} />
                                                                {errors.nomParent && <p className="text-red-500 text-xs">{errors.nomParent.message}</p>}
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <Label htmlFor="prenomParent">Prénom(s) du parent <span className="text-red-500">*</span></Label>
                                                                <Input id="prenomParent" placeholder="Ex: Aminata" {...register("prenomParent")} className={errors.prenomParent ? "border-red-500" : ""} />
                                                                {errors.prenomParent && <p className="text-red-500 text-xs">{errors.prenomParent.message}</p>}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <Label htmlFor="numeroParent">Numéro du parent <span className="text-red-500">*</span></Label>
                                                            <div className="relative">
                                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                                                                <Input id="numeroParent" type="tel" placeholder="Ex: 01 00 00 00 00" {...register("numeroParent")} className={`pl-10 ${errors.numeroParent ? "border-red-500" : ""}`} />
                                                            </div>
                                                            {errors.numeroParent && <p className="text-red-500 text-xs">{errors.numeroParent.message}</p>}
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <Label htmlFor="numeroUrgence">N° Urgence <span className="text-red-500">*</span></Label>
                                                            <div className="relative">
                                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                                                                <Input id="numeroUrgence" type="tel" placeholder="Ex: 05 00 00 00 00" {...register("numeroUrgence")} className={`pl-10 ${errors.numeroUrgence ? "border-red-500" : ""}`} />
                                                            </div>
                                                            {errors.numeroUrgence && <p className="text-red-500 text-xs">{errors.numeroUrgence.message}</p>}
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <Label htmlFor="lieuHabitation">Lieu d'habitation <span className="text-red-500">*</span></Label>
                                                            <Input id="lieuHabitation" placeholder="Ex: Yopougon, Mamie Adjoua" {...register("lieuHabitation")} className={errors.lieuHabitation ? "border-red-500" : ""} />
                                                            {errors.lieuHabitation && <p className="text-red-500 text-xs">{errors.lieuHabitation.message}</p>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="w-full flex-shrink-0 px-1">
                                                    <div className="space-y-5">
                                                        <div className="flex flex-col gap-2">
                                                            <Label htmlFor="nombreParticipations">Nombre de participation au SEFIMAP</Label>
                                                            <Input id="nombreParticipations" type="number" min="0" placeholder="0" {...register("nombreParticipations", { valueAsNumber: true })} className={errors.nombreParticipations ? "border-red-500" : ""} />
                                                            {errors.nombreParticipations && <p className="text-red-500 text-xs">{errors.nombreParticipations.message}</p>}
                                                        </div>
                                                        <div className="pt-4 border-t border-border-light dark:border-border-dark">
                                                            <div className="flex items-center gap-2 mb-4">
                                                                <Building className="h-4 w-4 text-primary" />
                                                                <span className="font-semibold text-text-main dark:text-white">Affectation</span>
                                                            </div>
                                                            {dortoirStats.length > 0 && <DormitoryDropdown stats={dortoirStats} dortoirs={dortoirs} />}
                                                            <div className="flex flex-col gap-2 mt-4">
                                                                <Label htmlFor="dortoirId">Dortoir <span className="text-red-500">*</span></Label>
                                                                <Select id="dortoirId" {...register("dortoirId")} className={errors.dortoirId ? "border-red-500" : ""}>
                                                                    <option value="">Sélectionnez</option>
                                                                    {dortoirsFiltres.map(dortoir => (
                                                                        <option key={dortoir.id} value={dortoir.id}>{getDortoirOptionLabel(dortoir)}</option>
                                                                    ))}
                                                                </Select>
                                                                {errors.dortoirId && <p className="text-red-500 text-xs">{errors.dortoirId.message}</p>}
                                                                {(sexeParticipant === "homme" || sexeParticipant === "femme") && (
                                                                    <p className="text-xs text-text-secondary">
                                                                        Seuls les dortoirs du même sexe que le participant sont proposés.
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                                                                <p className="text-sm text-blue-900 dark:text-blue-200 flex items-center gap-2">
                                                                    <BookOpen className="w-4 h-4" />
                                                                    <span><span className="font-semibold">Niveau de formation :</span> Sera attribué par la section scientifique</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 pt-4 border-t border-border-light dark:border-border-dark mt-6">
                                            {currentStep > 1 && (
                                                <Button type="button" variant="outline" onClick={prevStep} className="h-12 px-6">Précédent</Button>
                                            )}
                                            {currentStep < steps.length ? (
                                                <Button type="button" onClick={nextStep} className="h-12 flex-1">
                                                    Suivant <ArrowRight className="h-4 w-4 ml-2" />
                                                </Button>
                                            ) : (
                                                <Button type="submit" disabled={isLoading} className="h-12 flex-1 shadow-md shadow-primary/20">
                                                    {isLoading ? (
                                                        <span className="flex items-center gap-2">
                                                            <span className="h-5 w-5 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                                                            Finalisation...
                                                        </span>
                                                    ) : (
                                                        <><Save className="h-5 w-5 mr-2" /> Finaliser le dossier</>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {qrSession && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => fermerQR(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between w-full">
                            <h3 className="font-bold text-text-main dark:text-white flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /> Photo par téléphone</h3>
                            <button type="button" onClick={() => fermerQR(true)} title="Annuler le QR"><X className="h-5 w-5 text-text-secondary" /></button>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-border-light">
                            <QRCodeSVG value={qrSession.url} size={220} />
                        </div>
                        <p className="text-sm text-text-secondary dark:text-gray-400 text-center">Scannez avec le téléphone, prenez la photo et validez : elle apparaîtra ici.</p>
                        <p className="text-sm font-mono font-bold text-primary">Expire dans {Math.floor(qrLeft / 60)}:{String(qrLeft % 60).padStart(2, "0")}</p>
                        <p className="text-xs text-text-secondary break-all text-center">{qrSession.url}</p>
                        <Button variant="outline" className="w-full" onClick={() => fermerQR(true)}>Annuler le QR</Button>
                    </div>
                </div>
            )}

            {showSuccess && (
                <div className="fixed bottom-6 right-6 max-w-sm w-full bg-surface-light dark:bg-surface-dark border-l-4 border-primary shadow-xl rounded-r-lg p-4 flex items-start gap-3 animate-fade-in z-50">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-text-main dark:text-white text-sm">Dossier finalisé !</h4>
                        <p className="text-text-secondary dark:text-gray-400 text-xs mt-1">
                            Le dossier est complet et validé.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
