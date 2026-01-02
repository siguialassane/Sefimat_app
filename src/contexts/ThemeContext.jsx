import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Check localStorage for saved preference, default to light mode (false)
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("sefimap-theme");
            return saved === "dark";
        }
        return false;
    });

    useEffect(() => {
        // Apply theme class to document
        if (isDarkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        // Save preference
        localStorage.setItem("sefimap-theme", isDarkMode ? "dark" : "light");
    }, [isDarkMode]);

    const toggleTheme = () => {
        setIsDarkMode((prev) => !prev);
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
