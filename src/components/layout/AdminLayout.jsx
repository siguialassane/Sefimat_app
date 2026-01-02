import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";
import { Mosque } from "@/components/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useState } from "react";

export function AdminLayout() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
            {/* Sidebar */}
            <Sidebar />

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileMenuOpen(false)}
                />
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
                            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                <Mosque className="h-5 w-5" />
                            </div>
                            <span className="font-bold text-lg text-text-main dark:text-white">SEFIMAP</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            AK
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
