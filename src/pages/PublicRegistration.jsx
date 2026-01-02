import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { User, Users, Send, CheckCircle, Info } from "lucide-react";
import { Mosque } from "@/components/icons";
import { cn } from "@/lib/utils";

const registrationSchema = z.object({
    nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    prenom: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
    age: z.number().min(1, "L'âge est requis").max(120, "Âge invalide"),
    sexe: z.enum(["homme", "femme"], { required_error: "Veuillez sélectionner le sexe" }),
    niveauEtude: z.string().min(1, "Veuillez sélectionner un niveau d'étude"),
    chefQuartier: z.string().min(2, "Le nom du chef de quartier est requis"),
});

export function PublicRegistration() {
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(registrationSchema),
        defaultValues: {
            sexe: "homme",
        },
    });

    const selectedSexe = watch("sexe");

    const onSubmit = async (data) => {
        setIsLoading(true);
        try {
            // TODO: Implement Supabase submission
            console.log("Inscription soumise:", data);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulated delay
            setIsSubmitted(true);
            reset();
            setTimeout(() => setIsSubmitted(false), 5000);
        } catch (error) {
            console.error("Erreur lors de l'inscription:", error);
        } finally {
            setIsLoading(false);
        }
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
                            <h2 className="text-lg font-bold leading-tight tracking-tight">SEFIMAP 2024</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <a
                                href="/login"
                                className="flex items-center justify-center rounded-lg h-10 px-4 bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 text-text-main dark:text-white text-sm font-bold transition-colors"
                            >
                                Connexion Admin
                            </a>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex justify-center py-8 px-4 sm:px-6">
                <div className="flex flex-col max-w-[960px] w-full gap-6">
                    {/* Page Heading */}
                    <div className="flex flex-col gap-3 px-4 sm:px-0">
                        <h1 className="text-text-main dark:text-white text-3xl sm:text-4xl font-black leading-tight tracking-tight">
                            Formulaire d'Inscription
                        </h1>
                        <p className="text-text-secondary dark:text-gray-400 text-base">
                            Remplissez les informations ci-dessous pour inscrire un nouveau participant au séminaire.
                        </p>
                    </div>

                    {/* Form Card */}
                    <Card className="p-0 overflow-hidden">
                        <form onSubmit={handleSubmit(onSubmit)}>
                            {/* Section 1: Participant Info */}
                            <div className="p-6 sm:p-10">
                                <div className="flex items-center gap-2 mb-6 border-b border-border-light dark:border-border-dark pb-3">
                                    <User className="h-5 w-5 text-primary" />
                                    <h3 className="text-text-main dark:text-white text-lg font-bold">
                                        Informations du Participant
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Nom */}
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="nom">Nom</Label>
                                        <Input
                                            id="nom"
                                            placeholder="Entrez le nom"
                                            {...register("nom")}
                                            className={errors.nom ? "border-red-500" : ""}
                                        />
                                        {errors.nom && (
                                            <p className="text-red-500 text-xs mt-1">{errors.nom.message}</p>
                                        )}
                                    </div>

                                    {/* Prénom */}
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="prenom">Prénoms</Label>
                                        <Input
                                            id="prenom"
                                            placeholder="Entrez les prénoms"
                                            {...register("prenom")}
                                            className={errors.prenom ? "border-red-500" : ""}
                                        />
                                        {errors.prenom && (
                                            <p className="text-red-500 text-xs mt-1">{errors.prenom.message}</p>
                                        )}
                                    </div>

                                    {/* Age */}
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
                                            <p className="text-red-500 text-xs mt-1">{errors.age.message}</p>
                                        )}
                                    </div>

                                    {/* Sexe */}
                                    <div className="flex flex-col gap-2">
                                        <Label>Sexe</Label>
                                        <div className="flex gap-4 h-12 items-center">
                                            <label className="inline-flex items-center cursor-pointer group">
                                                <input
                                                    type="radio"
                                                    value="homme"
                                                    {...register("sexe")}
                                                    className="form-radio text-primary focus:ring-primary h-5 w-5 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                                                />
                                                <span className="ml-2 text-text-main dark:text-gray-300 text-base group-hover:text-primary transition-colors">
                                                    Homme
                                                </span>
                                            </label>
                                            <label className="inline-flex items-center cursor-pointer group">
                                                <input
                                                    type="radio"
                                                    value="femme"
                                                    {...register("sexe")}
                                                    className="form-radio text-primary focus:ring-primary h-5 w-5 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                                                />
                                                <span className="ml-2 text-text-main dark:text-gray-300 text-base group-hover:text-primary transition-colors">
                                                    Femme
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Niveau d'étude */}
                                    <div className="flex flex-col gap-2 md:col-span-2">
                                        <Label htmlFor="niveauEtude">Niveau d'étude</Label>
                                        <Select
                                            id="niveauEtude"
                                            {...register("niveauEtude")}
                                            className={errors.niveauEtude ? "border-red-500" : ""}
                                        >
                                            <option value="" disabled>
                                                Sélectionnez un niveau
                                            </option>
                                            <option value="aucun">Aucun</option>
                                            <option value="primaire">Primaire</option>
                                            <option value="secondaire">Secondaire</option>
                                            <option value="universitaire">Universitaire</option>
                                            <option value="arabe">Arabe / Franco-arabe</option>
                                        </Select>
                                        {errors.niveauEtude && (
                                            <p className="text-red-500 text-xs mt-1">{errors.niveauEtude.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Référent Info */}
                            <div className="px-6 sm:px-10 pb-6">
                                <div className="flex items-center gap-2 mb-6 border-b border-border-light dark:border-border-dark pb-3">
                                    <Users className="h-5 w-5 text-primary" />
                                    <h3 className="text-text-main dark:text-white text-lg font-bold">
                                        Informations du Référent
                                    </h3>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="chefQuartier">Nom complet du Chef de Quartier</Label>
                                    <Input
                                        id="chefQuartier"
                                        placeholder="Entrez votre nom complet"
                                        {...register("chefQuartier")}
                                        className={errors.chefQuartier ? "border-red-500" : ""}
                                    />
                                    <p className="text-xs text-text-secondary dark:text-gray-500 mt-1 flex items-center gap-1">
                                        <Info className="h-3 w-3" />
                                        Ce nom sera utilisé pour valider l'inscription.
                                    </p>
                                    {errors.chefQuartier && (
                                        <p className="text-red-500 text-xs mt-1">{errors.chefQuartier.message}</p>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="px-6 sm:px-10 pb-6 flex flex-col gap-4 pt-4 border-t border-border-light dark:border-border-dark">
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-14 text-base shadow-lg shadow-primary/20"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-5 w-5 border-2 border-text-main/30 border-t-text-main rounded-full animate-spin" />
                                            Envoi en cours...
                                        </span>
                                    ) : (
                                        <>
                                            Soumettre l'inscription
                                            <Send className="h-5 w-5" />
                                        </>
                                    )}
                                </Button>
                                <p className="text-center text-sm text-text-secondary dark:text-gray-500">
                                    En soumettant ce formulaire, vous confirmez l'exactitude des informations.
                                </p>
                            </div>
                        </form>
                    </Card>

                    {/* Footer */}
                    <div className="py-6 flex justify-center items-center gap-4 text-sm text-text-secondary dark:text-gray-500">
                        <span>© SEFIMAP 2024</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                        <a href="#" className="hover:text-primary transition-colors">
                            Besoin d'aide ?
                        </a>
                    </div>
                </div>
            </main>

            {/* Success Toast */}
            {isSubmitted && (
                <div className="fixed bottom-6 right-6 max-w-sm w-full bg-surface-light dark:bg-surface-dark border-l-4 border-primary shadow-xl rounded-r-lg p-4 flex items-start gap-3 animate-fade-in z-50">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <div>
                        <h4 className="font-bold text-text-main dark:text-white text-sm">
                            Inscription envoyée !
                        </h4>
                        <p className="text-text-secondary dark:text-gray-400 text-xs mt-1">
                            En attente de validation par un administrateur.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
