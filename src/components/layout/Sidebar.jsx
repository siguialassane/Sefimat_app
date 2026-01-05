import { NavLink, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    UserPlus,
    Download,
    Settings,
    LogOut,
    IdCard,
} from "lucide-react";
import { Mosque } from "@/components/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts";

const navItems = [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
    { to: "/admin/inscriptions", icon: Users, label: "Gestion des inscriptions" },
    { to: "/admin/inscription-presentielle", icon: UserPlus, label: "Inscription présentielle" },
    { to: "/admin/badges", icon: IdCard, label: "Gestion des badges" },
    { to: "/admin/exports", icon: Download, label: "Exports" },
];

export function Sidebar() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut();
            navigate("/login");
        } catch (error) {
            console.error('Erreur déconnexion:', error);
            navigate("/login"); // Rediriger quand même en cas d'erreur
        }
    };

    return (
        <aside className="hidden lg:flex w-72 flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark h-full flex-shrink-0 transition-colors duration-200">
            {/* Brand */}
            <div className="p-6 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                            <Mosque className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold tracking-tight text-text-main dark:text-white">
                                SEFIMAP
                            </h1>
                            <p className="text-xs font-medium text-text-secondary dark:text-gray-400 uppercase tracking-wider">
                                Admin Panel
                            </p>
                        </div>
                    </div>
                    {/* Theme Toggle */}
                    <ThemeToggle />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                                isActive
                                    ? "bg-primary/10 text-text-main dark:text-white border border-primary/20"
                                    : "text-text-secondary hover:bg-gray-50 dark:hover:bg-white/5 hover:text-text-main dark:hover:text-white"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon
                                    className={cn(
                                        "h-5 w-5 transition-colors",
                                        isActive ? "text-primary" : "group-hover:text-primary"
                                    )}
                                />
                                <span className={cn("text-sm", isActive ? "font-semibold" : "font-medium")}>
                                    {item.label}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Settings & Logout */}
            <div className="p-4 border-t border-border-light dark:border-border-dark space-y-1">
                <NavLink
                    to="/admin/settings"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:bg-gray-50 dark:hover:bg-white/5 hover:text-text-main dark:hover:text-white transition-colors group"
                >
                    <Settings className="h-5 w-5 group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium">Paramètres</span>
                </NavLink>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm font-medium">Déconnexion</span>
                </button>
            </div>

            {/* User Info */}
            <div className="p-4 border-t border-border-light dark:border-border-dark">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                        {user?.email?.substring(0, 2).toUpperCase() || 'AD'}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <p className="text-sm font-medium truncate text-text-main dark:text-white">
                            {user?.user_metadata?.full_name || 'Administrateur'}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-gray-400 truncate">
                            {user?.email || 'Non connecté'}
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
