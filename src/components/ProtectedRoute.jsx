import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts";
import { getDefaultRoute } from "../config/users.config";

/**
 * ProtectedRoute - Protection des routes avec auth locale
 * @param {string[]} [allowedRoles] - rôles autorisés (optionnel : si absent, tout utilisateur connecté passe)
 */
export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // État de chargement initial
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

  // Pas d'utilisateur = redirection vers login
  if (!user) {
    console.log('ProtectedRoute: Pas connecté, redirection vers login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Rôle non autorisé = redirection vers le tableau de bord du rôle
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.log('ProtectedRoute: Rôle non autorisé, redirection');
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }

  // Utilisateur connecté = afficher le contenu
  return children;
}
