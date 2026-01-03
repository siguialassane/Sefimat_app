import { useState, useRef, useCallback, useEffect } from "react";
import imageCompression from "browser-image-compression";
import { Camera, Upload, X, RefreshCw, Check, Loader2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

// Taille maximale avant compression (3MB)
const MAX_SIZE_MB = 3;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Options de compression
const compressionOptions = {
    maxSizeMB: 1, // Compresser jusqu'à 1MB max
    maxWidthOrHeight: 1024, // Résolution max
    useWebWorker: true,
    fileType: "image/jpeg",
};

/**
 * Composant PhotoCapture - Capture photo via webcam/caméra mobile ou upload
 * @param {Object} props
 * @param {Function} props.onPhotoCapture - Callback appelé avec le fichier compressé
 * @param {string} props.existingPhoto - URL de la photo existante (optionnel)
 * @param {string} props.className - Classes CSS additionnelles
 * @param {boolean} props.required - Champ obligatoire
 */
export function PhotoCapture({ onPhotoCapture, existingPhoto, className, required = true }) {
    const [preview, setPreview] = useState(existingPhoto || null);
    const [isWebcamActive, setIsWebcamActive] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [error, setError] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const fileInputRef = useRef(null);

    // Détecter si on est sur mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Nettoyer le stream webcam au démontage
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Compresser l'image si nécessaire
    const compressImage = async (file) => {
        if (file.size <= MAX_SIZE_BYTES) {
            return file; // Pas besoin de compresser
        }

        setIsCompressing(true);
        try {
            const compressedFile = await imageCompression(file, compressionOptions);
            console.log(`Image compressée: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
            return compressedFile;
        } catch (err) {
            console.error("Erreur compression:", err);
            throw new Error("Impossible de compresser l'image");
        } finally {
            setIsCompressing(false);
        }
    };

    // Gérer l'upload de fichier
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError("Veuillez sélectionner une image valide");
            return;
        }

        setError(null);
        try {
            const compressedFile = await compressImage(file);
            const previewUrl = URL.createObjectURL(compressedFile);
            setPreview(previewUrl);
            onPhotoCapture(compressedFile);
        } catch (err) {
            setError(err.message);
        }
    };

    // Démarrer la webcam (desktop)
    const startWebcam = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Attendre que la vidéo soit prête avant d'activer la webcam
                await new Promise((resolve) => {
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play().then(resolve).catch(resolve);
                    };
                });
            }
            setIsWebcamActive(true);
        } catch (err) {
            console.error("Erreur webcam:", err);
            let errorMessage = "Impossible d'accéder à la caméra.";

            if (err.name === 'NotAllowedError') {
                errorMessage = "Permission refusée. Veuillez autoriser l'accès à la caméra.";
            } else if (err.name === 'NotFoundError') {
                errorMessage = "Aucune caméra détectée sur cet appareil.";
            } else if (err.name === 'NotReadableError') {
                errorMessage = "La caméra est déjà utilisée par une autre application.";
            }

            setError(errorMessage);
        }
    };

    // Arrêter la webcam
    const stopWebcam = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsWebcamActive(false);
    }, []);

    // Capturer depuis la webcam
    const captureFromWebcam = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        canvas.toBlob(async (blob) => {
            if (!blob) return;

            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });

            try {
                const compressedFile = await compressImage(file);
                const previewUrl = URL.createObjectURL(compressedFile);
                setPreview(previewUrl);
                onPhotoCapture(compressedFile);
                stopWebcam();
            } catch (err) {
                setError(err.message);
            }
        }, "image/jpeg", 0.9);
    };

    // Supprimer la photo
    const removePhoto = () => {
        setPreview(null);
        onPhotoCapture(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            {/* Canvas caché pour la capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Prévisualisation ou zone de capture */}
            <div className="relative">
                {preview ? (
                    // Affichage de la photo capturée
                    <div className="relative group">
                        <div className="w-full aspect-[4/3] sm:w-48 sm:h-48 mx-auto rounded-xl overflow-hidden border-2 border-primary/30 shadow-lg">
                            <img
                                src={preview}
                                alt="Photo du participant"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Boutons d'action sur la photo */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={removePhoto}
                                className="gap-1"
                            >
                                <X className="h-4 w-4" />
                                Supprimer
                            </Button>
                        </div>
                        {/* Badge de confirmation */}
                        <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-md">
                            <Check className="h-5 w-5 text-white" />
                        </div>
                    </div>
                ) : isWebcamActive ? (
                    // Mode webcam actif
                    <div className="relative w-full aspect-[4/3] sm:w-64 sm:h-48 mx-auto rounded-xl overflow-hidden border-2 border-primary shadow-lg">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                        {/* Overlay avec guide */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-4 border-2 border-white/50 rounded-lg" />
                        </div>
                        {/* Contrôles webcam */}
                        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                            <Button
                                type="button"
                                onClick={captureFromWebcam}
                                className="gap-2 shadow-lg"
                                disabled={isCompressing}
                            >
                                {isCompressing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Camera className="h-4 w-4" />
                                )}
                                Capturer
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                onClick={stopWebcam}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    // Zone de sélection (pas de photo)
                    <div className="w-full aspect-[4/3] sm:w-48 sm:h-48 mx-auto rounded-xl border-2 border-dashed border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center gap-3 p-4 transition-colors hover:border-primary/50">
                        <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <Camera className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm text-text-secondary dark:text-gray-400 text-center">
                            {required ? "Photo obligatoire" : "Photo (optionnelle)"}
                        </p>
                    </div>
                )}
            </div>

            {/* Message d'erreur */}
            {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            {/* Indicateur de compression */}
            {isCompressing && (
                <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compression en cours...
                </div>
            )}

            {/* Boutons d'action (si pas de photo et pas de webcam) */}
            {!preview && !isWebcamActive && (
                <div className="flex flex-col gap-2 justify-center">
                    {isMobile ? (
                        // Mode mobile: Selfie, Caméra arrière, et Galerie
                        <>
                            <div className="flex gap-2">
                                {/* Bouton Selfie (caméra frontale) */}
                                <label className="cursor-pointer flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="user"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <Button type="button" variant="outline" className="gap-2 w-full">
                                        <Camera className="h-4 w-4" />
                                        Selfie
                                    </Button>
                                </label>
                                {/* Bouton Caméra arrière */}
                                <label className="cursor-pointer flex-1">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <Button type="button" variant="default" className="gap-2 w-full">
                                        <Camera className="h-4 w-4" />
                                        Photo
                                    </Button>
                                </label>
                            </div>
                            {/* Bouton Galerie */}
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <Button type="button" variant="outline" className="gap-2 w-full">
                                    <Upload className="h-4 w-4" />
                                    Choisir depuis la galerie
                                </Button>
                            </label>
                        </>
                    ) : (
                        // Mode desktop: webcam + upload
                        <>
                            <Button
                                type="button"
                                onClick={startWebcam}
                                className="gap-2"
                            >
                                <Camera className="h-4 w-4" />
                                Utiliser la webcam
                            </Button>
                            <label className="cursor-pointer">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <Button type="button" variant="outline" className="gap-2">
                                    <Upload className="h-4 w-4" />
                                    Télécharger
                                </Button>
                            </label>
                        </>
                    )}
                </div>
            )}

            {/* Bouton pour changer la photo */}
            {preview && (
                <div className="flex justify-center">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removePhoto}
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Changer la photo
                    </Button>
                </div>
            )}
        </div>
    );
}
