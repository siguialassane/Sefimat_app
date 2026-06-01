import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        // Check localStorage for saved preference, default to light mode
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("sefimap-theme");
            return saved || "light"; // light, dark, black
        }
        return "light";
    });

    useEffect(() => {
        // Apply theme class to document
        document.documentElement.classList.remove("dark", "black");
        if (theme === "dark") {
            document.documentElement.classList.add("dark");
        } else if (theme === "black") {
            document.documentElement.classList.add("dark", "black");
        }
        // Save preference
        localStorage.setItem("sefimap-theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => {
            if (prev === "light") return "dark";
            if (prev === "dark") return "black";
            return "light";
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
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
