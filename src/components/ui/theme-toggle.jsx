import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/contexts";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }) {
    const { theme, toggleTheme } = useTheme();

    const getIcon = () => {
        if (theme === "light") return <Moon className="h-5 w-5" />;
        if (theme === "dark") return <Monitor className="h-5 w-5" />;
        return <Sun className="h-5 w-5" />;
    };

    const getTitle = () => {
        if (theme === "light") return "Passer en mode sombre (vert)";
        if (theme === "dark") return "Passer en mode noir";
        return "Passer en mode clair";
    };

    return (
        <button
            onClick={toggleTheme}
            className={cn(
                "flex items-center justify-center h-10 w-10 rounded-lg transition-colors",
                "bg-gray-100 hover:bg-gray-200 text-text-main",
                "dark:bg-white/10 dark:hover:bg-white/20 dark:text-white",
                className
            )}
            title={getTitle()}
        >
            {getIcon()}
        </button>
    );
}
