import { useState, useRef, useEffect } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Composant LazyImage - Chargement différé des images avec placeholder
 * Utilise IntersectionObserver pour ne charger l'image que lorsqu'elle est visible
 *
 * @param {Object} props
 * @param {string} props.src - URL de l'image
 * @param {string} props.alt - Texte alternatif
 * @param {string} props.className - Classes CSS
 * @param {string} props.placeholderClassName - Classes CSS pour le placeholder
 * @param {React.ReactNode} props.fallback - Composant à afficher si l'image n'existe pas
 */
export function LazyImage({
    src,
    alt,
    className,
    placeholderClassName,
    fallback,
    ...props
}) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            {
                rootMargin: "100px", // Précharger un peu avant que l'image soit visible
                threshold: 0.1,
            }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Reset state si l'URL change
    useEffect(() => {
        setIsLoaded(false);
        setHasError(false);
    }, [src]);

    const handleLoad = () => {
        setIsLoaded(true);
    };

    const handleError = () => {
        setHasError(true);
    };

    // Si pas de source ou erreur de chargement, afficher le fallback
    if (!src || hasError) {
        return (
            <div
                ref={imgRef}
                className={cn(
                    "flex items-center justify-center bg-gray-100 dark:bg-gray-800",
                    className
                )}
            >
                {fallback || (
                    <User className="h-1/2 w-1/2 text-gray-300 dark:text-gray-600" />
                )}
            </div>
        );
    }

    return (
        <div ref={imgRef} className={cn("relative overflow-hidden", className)}>
            {/* Placeholder / Skeleton */}
            {!isLoaded && (
                <div
                    className={cn(
                        "absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse",
                        placeholderClassName
                    )}
                />
            )}

            {/* Image réelle - chargée seulement si visible */}
            {isInView && (
                <img
                    src={src}
                    alt={alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-300",
                        isLoaded ? "opacity-100" : "opacity-0"
                    )}
                    loading="lazy"
                    {...props}
                />
            )}
        </div>
    );
}

/**
 * Composant Avatar avec Lazy Loading pour les photos de participants
 */
export function ParticipantAvatar({
    src,
    name,
    size = "md",
    className
}) {
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-16 w-16",
        xl: "h-24 w-24",
    };

    const initials = name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "?";

    if (!src) {
        return (
            <div
                className={cn(
                    "rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold",
                    sizeClasses[size],
                    size === "sm" && "text-xs",
                    size === "md" && "text-sm",
                    size === "lg" && "text-lg",
                    size === "xl" && "text-2xl",
                    className
                )}
            >
                {initials}
            </div>
        );
    }

    return (
        <LazyImage
            src={src}
            alt={name || "Photo participant"}
            className={cn(
                "rounded-full",
                sizeClasses[size],
                className
            )}
            fallback={
                <div className={cn(
                    "w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold",
                    size === "sm" && "text-xs",
                    size === "md" && "text-sm",
                    size === "lg" && "text-lg",
                    size === "xl" && "text-2xl",
                )}>
                    {initials}
                </div>
            }
        />
    );
}
