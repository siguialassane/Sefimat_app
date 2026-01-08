import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts";

export function ProtectedRoute({ children }) {
  const { user, loading, authError } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Sauvegarder l'URL pour rediriger après connexion
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
