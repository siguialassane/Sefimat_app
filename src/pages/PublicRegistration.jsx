import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Mosque } from "@/components/icons";
import { ArrowRight, MapPin, Users } from "lucide-react";

const accessOptions = [
    {
        icon: Users,
        title: "Depuis un président de section",
        description: "Un président de section peut enregistrer votre inscription dans l'application.",
    },
    {
        icon: MapPin,
        title: "En présentiel",
        description: "Vous pouvez aussi vous inscrire directement à l'école Saint Exupérie de Port-Bouët.",
    },
];

export function PublicRegistration() {
    return (
        <div className="min-h-screen bg-background-light text-text-main dark:bg-background-dark dark:text-white">
            <header className="border-b border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
                    <a href="/" className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Mosque className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold tracking-[0.16em] text-text-secondary uppercase">
                                Port-Bouët
                            </p>
                            <h1 className="text-lg font-bold">SEFIMAP</h1>
                        </div>
                    </a>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <Button asChild className="px-5 font-semibold">
                            <a href="/login">Connexion</a>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
                <section className="border border-border-light bg-surface-light p-6 dark:border-border-dark dark:bg-surface-dark sm:p-10">
                    <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
                            Séminaire 2026
                    </p>

                    <h2 className="max-w-3xl text-2xl font-bold leading-tight sm:text-4xl">
                        Le SEFIMAP signifie Séminaire de Formation Islamique, Managériale et Académique de Port-Bouët.
                    </h2>

                    <div className="mt-6 max-w-3xl space-y-4 text-base leading-8 text-text-secondary dark:text-gray-300">
                        <p>
                            Cette plateforme a été mise en place pour présenter l&apos;événement et faciliter
                            l&apos;organisation des inscriptions des participants.
                        </p>
                        <p>
                            L&apos;inscription peut se faire soit par l&apos;intermédiaire d&apos;un président de
                            section, soit en présentiel à l&apos;école Saint Exupérie.
                        </p>
                    </div>

                    <div className="mt-8">
                        <Button asChild size="lg" className="h-11 px-6 text-sm font-semibold">
                            <a href="/login">
                                Connexion
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                </section>

                <section className="mt-8 grid gap-4 md:grid-cols-2">
                        {accessOptions.map(({ icon: Icon, title, description }) => (
                            <div
                                key={title}
                            className="border border-border-light bg-surface-light p-6 dark:border-border-dark dark:bg-surface-dark"
                            >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Icon className="h-5 w-5" />
                                </div>
                            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                            <p className="mt-2 text-sm leading-7 text-text-secondary dark:text-gray-300">
                                    {description}
                                </p>
                            </div>
                        ))}
                </section>
            </main>
        </div>
    );
}
