import { createContext, useContext } from "react";

// Contexte partagé isolé (react-refresh: un fichier = un rôle).
export const DataContext = createContext(null);

export function useData() {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error("useData doit être utilisé dans DataProvider");
    }
    return context;
}

export default DataContext;
