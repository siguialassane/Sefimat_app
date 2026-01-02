import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }) {
    const { isDarkMode, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={cn(
                "flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                "bg-gray-100 hover:bg-gray-200 text-text-main",
                "dark:bg-white/10 dark:hover:bg-white/20 dark:text-white",
                className
            )}
            title={isDarkMode ? "Passer en mode clair" : "Passer en mode sombre"}
        >
            {isDarkMode ? (
                <Sun className="h-5 w-5" />
            ) : (
                <Moon className="h-5 w-5" />
            )}
        </button>
    );
}
