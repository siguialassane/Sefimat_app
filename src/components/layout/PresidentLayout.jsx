import { Outlet, NavLink, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { UserPlus, CreditCard, LogOut, Menu, X, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export function PresidentLayout() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [president, setPresident] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { lienUnique } = useParams();

    useEffect(() => {
        loadPresident();
    }, [lienUnique]);

    const loadPresident = async () => {
        if (!lienUnique) {
            setError("Lien invalide");
            setLoading(false);
            return;
        }

        try {
            const { data, error: err } = await supabase
                .from("chefs_quartier")
                .select("*")
                .eq("lien_unique", lienUnique.toUpperCase())
                .maybeSingle();

            if (err) {
                console.error("Erreur Supabase:", err);
                setError("Erreur de connexion");
            } else if (!data) {
                setError("Président non trouvé");
            } else {
                setPresident(data);
            }
        } catch (e) {
            console.error("Erreur:", e);
            setError("Erreur de connexion");
        }
        setLoading(false);
    };

    const menuItems = [
        {
            icon: UserPlus,
            label: "Nouvelle Inscription",
            path: `/president/${lienUnique}/inscription`,
        },
        {
            icon: CreditCard,
            label: "Suivi des Paiements",
            path: `/president/${lienUnique}/paiements`,
        },
    ];

    // Chargement
    if (loading) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-text-secondary">Chargement...</p>
                </div>
            </div>
        );
    }

    // Erreur
    if (error || !president) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <div className="text-center max-w-md bg-surface-light dark:bg-surface-dark p-8 rounded-xl shadow-lg">
                    <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-text-main dark:text-white mb-2">
                        Lien invalide
                    </h2>
                    <p className="text-text-secondary mb-4">
                        {error || "Ce lien n'existe pas."}
                    </p>
                    <p className="text-sm text-text-secondary mb-6">
                        Lien: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{lienUnique}</code>
                    </p>
                    <a
                        href="/inscription"
                        className="inline-block px-6 py-3 bg-primary hover:bg-primary-hover text-text-main font-medium rounded-lg"
                    >
                        Retour au site
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark">
                {/* Logo */}
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="font-bold text-lg text-text-main dark:text-white">SEFIMAP</h1>
                                <p className="text-xs text-amber-600 font-medium">Espace Président</p>
                            </div>
                        </div>
                        <ThemeToggle />
                    </div>
                </div>

                {/* President Info */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 mx-4 mt-4 rounded-lg">
                    <p className="text-xs text-amber-600 font-medium mb-1">Président de section</p>
                    <p className="font-bold text-text-main dark:text-white">{president.nom_complet}</p>
                    <p className="text-sm text-text-secondary">Zone: {president.zone}</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                        : "text-text-secondary hover:text-text-main dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                                )
                            }
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-border-light dark:border-border-dark">
                    <a
                        href="/inscription"
                        className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-100 dark:hover:bg-white/5"
                    >
                        <LogOut className="h-4 w-4" />
                        Retour au site public
                    </a>
                </div>
            </aside>

            {/* Mobile Sidebar */}
            {mobileMenuOpen && (
                <>
                    <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileMenuOpen(false)} />
                    <aside className="lg:hidden fixed inset-y-0 left-0 w-64 bg-surface-light dark:bg-surface-dark z-50 flex flex-col">
                        <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600">
                                    <Users className="h-6 w-6" />
                                </div>
                                <div>
                                    <h1 className="font-bold text-lg text-text-main dark:text-white">SEFIMAP</h1>
                                    <p className="text-xs text-amber-600 font-medium">Espace Président</p>
                                </div>
                            </div>
                            <button onClick={() => setMobileMenuOpen(false)} className="text-text-secondary">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 mx-4 mt-4 rounded-lg">
                            <p className="text-xs text-amber-600 font-medium mb-1">Président de section</p>
                            <p className="font-bold text-text-main dark:text-white">{president.nom_complet}</p>
                            <p className="text-sm text-text-secondary">Zone: {president.zone}</p>
                        </div>
                        <nav className="flex-1 p-4 space-y-1">
                            {menuItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={({ isActive }) =>
                                        cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                : "text-text-secondary hover:text-text-main dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                                        )
                                    }
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>
                        <div className="p-4 border-t border-border-light dark:border-border-dark">
                            <a href="/inscription" className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-100 dark:hover:bg-white/5">
                                <LogOut className="h-4 w-4" />
                                Retour au site public
                            </a>
                        </div>
                    </aside>
                </>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between p-4 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setMobileMenuOpen(true)} className="text-text-secondary hover:text-text-main">
                            <Menu className="h-6 w-6" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <span className="font-bold text-sm text-text-main dark:text-white block">{president.nom_complet}</span>
                                <span className="text-xs text-text-secondary">{president.zone}</span>
                            </div>
                        </div>
                    </div>
                    <ThemeToggle />
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto">
                    <Outlet context={{ president }} />
                </div>
            </main>
        </div>
    );
}
