import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/contexts";

const loginSchema = z.object({
    email: z.string().email("Adresse email invalide"),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

// Fonction pour rediriger selon le rôle
const getRedirectPath = (role) => {
    switch (role) {
        case "financier":
            return "/finance/dashboard";
        case "secretariat":
            return "/admin/dashboard";
        case "president_section":
            return "/president";
        default:
            return "/admin/dashboard";
    }
};

export function Login() {
    const navigate = useNavigate();
    const { signIn, user, userRole, loading: authLoading, authError } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(loginSchema),
    });

    // Rediriger si déjà connecté (seulement quand auth n'est plus en chargement)
    useEffect(() => {
        if (!authLoading && user && userRole) {
            console.log("Login: Utilisateur déjà connecté, redirection vers", userRole);
            navigate(getRedirectPath(userRole), { replace: true });
        }
    }, [user, userRole, authLoading, navigate]);

    // Afficher les erreurs d'auth context
    useEffect(() => {
        if (authError) {
            setError(authError);
        }
    }, [authError]);

    const onSubmit = async (data) => {
        console.log("Login: Tentative de connexion...");
        setIsLoading(true);
        setError(null);

        // Timeout de sécurité - 12 secondes
        const timeoutId = setTimeout(() => {
            console.warn("Login: Timeout de connexion");
            setIsLoading(false);
            setError("La connexion prend trop de temps. Vérifiez votre connexion internet et réessayez.");
        }, 12000);

        try {
            const result = await signIn(data.email, data.password);
            clearTimeout(timeoutId);

            const role = result?.profile?.role;
            console.log("Login: Connexion réussie, rôle:", role);

            if (!role) {
                setError("Votre compte n'a pas de rôle assigné. Contactez l'administrateur.");
                setIsLoading(false);
                return;
            }

            // Redirection immédiate
            navigate(getRedirectPath(role), { replace: true });
        } catch (err) {
            clearTimeout(timeoutId);
            console.error("Login: Erreur:", err.message);
            setError(err.message || "Email ou mot de passe incorrect.");
        } finally {
            setIsLoading(false);
        }
    };

    // Afficher un loader si auth est en cours de vérification
    if (authLoading) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary">Vérification de la session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark font-display flex flex-col">
            {/* Header */}
            <header className="w-full border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-6 py-4 lg:px-10">
                <div className="max-w-[1440px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 text-text-main dark:text-white">
                        <div className="h-8 w-8 text-primary">
                            <svg className="w-full h-full" fill="none" viewBox="0 0 48 48">
                                <path
                                    d="M24 4C25.7818 14.2173 33.7827 22.2182 44 24C33.7827 25.7818 25.7818 33.7827 24 44C22.2182 33.7827 14.2173 25.7818 4 24C14.2173 22.2182 22.2182 14.2173 24 4Z"
                                    fill="currentColor"
                                />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold leading-tight tracking-tight">SEFIMAP Admin</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <a
                            href="/"
                            className="hidden sm:flex items-center justify-center rounded-lg h-10 px-4 bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 text-text-main dark:text-white text-sm font-bold transition-colors"
                        >
                            Retour au site public
                        </a>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-8 w-full relative overflow-hidden">
                {/* Decorative Background */}
                <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
                    <div className="absolute right-0 top-0 h-[500px] w-[500px] bg-gradient-to-bl from-primary/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute left-0 bottom-0 h-[500px] w-[500px] bg-gradient-to-tr from-primary/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                </div>

                <div className="relative w-full max-w-[1000px] grid grid-cols-1 lg:grid-cols-2 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl overflow-hidden border border-border-light dark:border-border-dark z-10">
                    {/* Left Side: Login Form */}
                    <div className="p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
                        <div className="mb-8">
                            <h1 className="text-2xl sm:text-3xl font-bold text-text-main dark:text-white mb-2">
                                Bienvenue
                            </h1>
                            <p className="text-text-secondary dark:text-gray-400">
                                Veuillez saisir vos identifiants pour accéder au tableau de bord.
                            </p>
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 flex items-start gap-3 animate-fade-in">
                                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-bold">Échec de la connexion</p>
                                    <p>{error}</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                            {/* Email Field */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@sefimap.ci"
                                        className={`pl-11 ${errors.email ? "border-red-500" : ""}`}
                                        {...register("email")}
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-red-500 text-xs">{errors.email.message}</p>
                                )}
                            </div>

                            {/* Password Field */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Mot de passe</Label>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className={`pl-11 pr-11 ${errors.password ? "border-red-500" : ""}`}
                                        {...register("password")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-main dark:hover:text-white"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-red-500 text-xs">{errors.password.message}</p>
                                )}
                                <div className="flex justify-end">
                                    <a
                                        href="#"
                                        className="text-sm font-medium text-primary hover:underline"
                                    >
                                        Mot de passe oublié ?
                                    </a>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-12 mt-4 shadow-md hover:shadow-lg"
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-5 w-5 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                                        Connexion...
                                    </span>
                                ) : (
                                    <>
                                        Se connecter
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="mt-8 text-center">
                            <p className="text-sm text-text-secondary">
                                Besoin d'assistance ?{" "}
                                <a
                                    href="#"
                                    className="text-text-main dark:text-white font-semibold hover:underline"
                                >
                                    Contactez le support
                                </a>
                            </p>
                        </div>
                    </div>

                    {/* Right Side: Branding */}
                    <div className="hidden lg:flex relative bg-background-dark flex-col justify-end p-12 overflow-hidden">
                        <div className="absolute inset-0 z-0">
                            <div
                                className="w-full h-full bg-center bg-cover opacity-60 mix-blend-overlay"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2313ec5b' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                                }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent" />
                        </div>
                        <div className="relative z-10 text-white">
                            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-primary/30">
                                <svg className="w-10 h-10 text-text-main" fill="none" viewBox="0 0 48 48">
                                    <path
                                        d="M24 4C25.7818 14.2173 33.7827 22.2182 44 24C33.7827 25.7818 25.7818 33.7827 24 44C22.2182 33.7827 14.2173 25.7818 4 24C14.2173 22.2182 22.2182 14.2173 24 4Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </div>
                            <blockquote className="text-xl font-medium leading-relaxed mb-4">
                                "La gestion efficace est la clé pour servir notre communauté avec excellence et
                                transparence."
                            </blockquote>
                            <p className="text-sm text-gray-400 font-medium">
                                Plateforme d'Administration SEFIMAP
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-sm text-text-secondary dark:text-gray-500">
                <p>© 2026 SEFIMAP Côte d'Ivoire. Tous droits réservés.</p>
            </footer>
        </div>
    );
}
