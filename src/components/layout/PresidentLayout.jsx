import { Outlet, NavLink, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import {
    UserPlus,
    CreditCard,
    LogOut,
    Menu,
    X,
    Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export function PresidentLayout() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [president, setPresident] = useState(null);
    const [loading, setLoading] = useState(true);
    const { lienUnique } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (lienUnique) {
            loadPresidentInfo();
        }
    }, [lienUnique]);

    const loadPresidentInfo = async () => {
        try {
            const { data, error } = await supabase
                .from("chefs_quartier")
                .select("*")
                .eq("lien_unique", lienUnique.toUpperCase())
                .single();

            if (error || !data) {
                console.error("Président non trouvé:", error);
                navigate("/inscription");
                return;
            }

            setPresident(data);
        } catch (err) {
            console.error("Erreur:", err);
            navigate("/inscription");
        } finally {
            setLoading(false);
        }
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

    if (loading) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-text-secondary">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!president) {
        return null;
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
                                <h1 className="font-bold text-lg text-text-main dark:text-white">
                                    SEFIMAP
                                </h1>
                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                    Espace Président
                                </p>
                            </div>
                        </div>
                        <ThemeToggle />
                    </div>
                </div>

                {/* President Info */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 mx-4 mt-4 rounded-lg">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                        Président de section
                    </p>
                    <p className="font-bold text-text-main dark:text-white">
                        {president.nom_complet}
                    </p>
                    <p className="text-sm text-text-secondary">
                        Zone: {president.zone}
                    </p>
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
                        className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Retour au site public
                    </a>
                </div>
            </aside>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <>
                    <div
                        className="lg:hidden fixed inset-0 bg-black/50 z-40"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    <aside className="lg:hidden fixed inset-y-0 left-0 w-64 bg-surface-light dark:bg-surface-dark z-50 flex flex-col">
                        {/* Logo */}
                        <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600">
                                    <Users className="h-6 w-6" />
                                </div>
                                <div>
                                    <h1 className="font-bold text-lg text-text-main dark:text-white">
                                        SEFIMAP
                                    </h1>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                        Espace Président
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setMobileMenuOpen(false)}
                                className="text-text-secondary hover:text-text-main"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* President Info */}
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 mx-4 mt-4 rounded-lg">
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                                Président de section
                            </p>
                            <p className="font-bold text-text-main dark:text-white">
                                {president.nom_complet}
                            </p>
                            <p className="text-sm text-text-secondary">
                                Zone: {president.zone}
                            </p>
                        </div>

                        {/* Navigation */}
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

                        {/* Footer */}
                        <div className="p-4 border-t border-border-light dark:border-border-dark">
                            <a
                                href="/inscription"
                                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
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
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="text-text-secondary hover:text-text-main dark:hover:text-white"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <span className="font-bold text-sm text-text-main dark:text-white block">
                                    {president.nom_complet}
                                </span>
                                <span className="text-xs text-text-secondary">
                                    {president.zone}
                                </span>
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
