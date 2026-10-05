import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
    LayoutDashboard,
    CheckCircle,
    FileSpreadsheet,
    BarChart3,
    LogOut,
    Menu,
    X,
    List,
    Wallet,
    UserPlus,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth, useData } from "@/contexts";
import { notify } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const menuItems = [
    {
        icon: LayoutDashboard,
        label: "Tableau de bord",
        path: "/finance/dashboard",
    },
    {
        icon: Wallet,
        label: "Caisse",
        path: "/finance/caisse",
        badgeKey: "versementsEnAttente",
    },
    {
        icon: CheckCircle,
        label: "Dossiers",
        path: "/finance/validation",
    },
    {
        icon: List,
        label: "Versements",
        path: "/finance/liste",
    },
    {
        icon: FileSpreadsheet,
        label: "Synthèse",
        path: "/finance/synthese",
    },
    {
        icon: BarChart3,
        label: "Stats",
        path: "/finance/stats",
    },
    {
        icon: UserPlus,
        label: "Préinscriptions",
        path: "/finance/preinscription",
    },
];

// Toast temps réel : prévient la finance dès qu'un versement arrive en caisse.
function CaisseRealtimeWatcher() {
    const { caisseEvent, inscriptions, chefsQuartier } = useData();
    const lastShownRef = useRef(0);
    useEffect(() => {
        if (!caisseEvent || caisseEvent.at <= lastShownRef.current) return;
        lastShownRef.current = caisseEvent.at;
        const v = caisseEvent.versement || {};
        const inscription = (inscriptions || []).find((i) => i.id === v.inscription_id);
        const chef = (chefsQuartier || []).find((c) => c.id === inscription?.chef_quartier_id);
        const montant = new Intl.NumberFormat("fr-FR").format(v.montant || 0);
        const qui = inscription
            ? `${inscription.nom || ""} ${inscription.prenom || ""}`.trim()
            : "Versement";
        notify.info(`${montant} FCFA — ${qui} (${chef ? chef.nom_complet : "Guichet"})`, {
            title: "Nouveau versement en attente",
        });
    }, [caisseEvent, inscriptions, chefsQuartier]);
    return null;
}

export function FinanceLayout() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { signOut, userProfile } = useAuth();
    const { stats } = useData();
    const caisseBadge = stats?.versementsEnAttente || 0;
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate("/login");
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
            <CaisseRealtimeWatcher />
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark">
                {/* Logo */}
                <div className="p-6 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Logo />
                            <div>
                                <h1 className="font-bold text-lg text-text-main dark:text-white">
                                    SEFIMAP
                                </h1>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                    Cellule Financier
                                </p>
                            </div>
                        </div>
                        <ThemeToggle />
                    </div>
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
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "text-text-secondary hover:text-text-main dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                                )
                            }
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                            {item.badgeKey && caisseBadge > 0 && (
                                <span className="ml-auto min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                                    {caisseBadge}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User Info & Logout */}
                <div className="p-4 border-t border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold text-sm">
                            {userProfile?.nom_complet?.charAt(0) || "F"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-main dark:text-white truncate">
                                {userProfile?.nom_complet || "Admin Financier"}
                            </p>
                            <p className="text-xs text-text-secondary truncate">
                                {userProfile?.email || "Cellule Financier"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Déconnexion
                    </button>
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
                                <Logo />
                                <div>
                                    <h1 className="font-bold text-lg text-text-main dark:text-white">
                                        SEFIMAP
                                    </h1>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                        Cellule Financier
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
                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                : "text-text-secondary hover:text-text-main dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                                        )
                                    }
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                    {item.badgeKey && caisseBadge > 0 && (
                                        <span className="ml-auto min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                                            {caisseBadge}
                                        </span>
                                    )}
                                </NavLink>
                            ))}
                        </nav>

                        {/* Logout */}
                        <div className="p-4 border-t border-border-light dark:border-border-dark">
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                Déconnexion
                            </button>
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
                            <Logo className="h-8 w-8" />
                            <span className="font-bold text-lg text-text-main dark:text-white">
                                Financier
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold text-xs">
                            {userProfile?.nom_complet?.charAt(0) || "F"}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
