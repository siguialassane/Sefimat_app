import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  authenticateUser, 
  getStoredUser, 
  storeUser, 
  clearStoredUser,
  getDefaultRoute,
  normalizeStorageType,
  DEFAULT_AUTH_STORAGE,
  isValidStoredUser
} from '../config/users.config';

const AuthContext = createContext(null);

/**
 * AuthProvider simplifié - Authentification locale sans Supabase Auth
 * 
 * Avantages:
 * - Pas de tokens à gérer
 * - Pas de sessions qui expirent
 * - Pas de problèmes de rafraîchissement
 * - Simple et direct
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Au démarrage, vérifier si un utilisateur est stocké
  useEffect(() => {
    console.log('AuthContext: Vérification utilisateur stocké...');
    const storedUser = getStoredUser(DEFAULT_AUTH_STORAGE);
    
    if (storedUser) {
      console.log('AuthContext: Utilisateur trouvé:', storedUser.email);
      setUser(storedUser);
    } else {
      console.log('AuthContext: Aucun utilisateur stocké');
    }
    
    setLoading(false);
  }, []);

  // Permet de forcer une déconnexion depuis n'importe où (ex: page login)
  useEffect(() => {
    const handler = () => {
      console.log('AuthContext: Force logout event reçu');
      clearStoredUser('local');
      clearStoredUser('session');
      setUser(null);
    };
    window.addEventListener('sefimap-force-logout', handler);
    return () => window.removeEventListener('sefimap-force-logout', handler);
  }, []);

  // Connexion
  const signIn = useCallback(async (email, password, options = {}) => {
    console.log('AuthContext: Tentative de connexion pour:', email);
    setLoading(true);
    
    try {
      const authenticatedUser = authenticateUser(email, password);
      
      if (authenticatedUser) {
        console.log('AuthContext: ✅ Connexion réussie:', authenticatedUser.role);
        // Persistance configurable: none/session/local
        // - remember=true  => local
        // - remember=false => session (par défaut)
        // - storage='none' => aucune persistance
        const storage = options?.storage
          ? normalizeStorageType(options.storage)
          : (options?.remember ? 'local' : DEFAULT_AUTH_STORAGE);

        if (storage !== 'none') {
          storeUser(authenticatedUser, storage);
        }
        setUser(authenticatedUser);
        return { 
          data: { user: authenticatedUser }, 
          error: null 
        };
      } else {
        console.log('AuthContext: ❌ Identifiants incorrects');
        return { 
          data: null, 
          error: { message: 'Email ou mot de passe incorrect' } 
        };
      }
    } catch (err) {
      console.error('AuthContext: Erreur:', err);
      return { 
        data: null, 
        error: { message: err.message } 
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Déconnexion
  const signOut = useCallback(async () => {
    console.log('AuthContext: Déconnexion');
    // On purge les deux types pour éviter les surprises
    clearStoredUser('local');
    clearStoredUser('session');
    setUser(null);
  }, []);

  // Profil = user (tout est dans le même objet)
  const profile = user ? {
    id: user.id,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    role: user.role,
  } : null;

  // Si un user “caché” est invalide (format ancien), on le purge
  useEffect(() => {
    if (user && !isValidStoredUser(user)) {
      console.warn('AuthContext: user invalide détecté, purge');
      clearStoredUser('local');
      clearStoredUser('session');
      setUser(null);
    }
  }, [user]);

  const value = {
    user,
    profile,
    // Aliases de compatibilité avec l'ancien code
    userProfile: profile,
    userRole: user?.role || null,
    authError: null,
    isLoggingOut: false,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
    // Helper pour obtenir la route par défaut
    getDefaultRoute: () => user ? getDefaultRoute(user.role) : '/login',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider');
  }
  return context;
}

export default AuthContext;
