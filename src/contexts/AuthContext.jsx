import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Ref pour éviter les doubles appels simultanés
  const isLoadingProfile = useRef(false);

  // Fonction pour nettoyer la session corrompue
  const clearCorruptedSession = useCallback(async () => {
    console.log('AuthContext: Nettoyage session...');
    try {
      // Nettoyer localStorage des clés Supabase
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('AuthContext: Erreur nettoyage:', e);
    }
  }, []);

  // Fonction pour charger le profil utilisateur depuis admin_users
  const loadUserProfile = useCallback(async (userId) => {
    if (!userId) {
      setUserProfile(null);
      setUserRole(null);
      return null;
    }

    // Éviter les doubles appels simultanés
    if (isLoadingProfile.current) {
      console.log('AuthContext: Chargement profil déjà en cours');
      return null;
    }
    isLoadingProfile.current = true;

    try {
      console.log('AuthContext: Chargement profil pour', userId);
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('AuthContext: Utilisateur non trouvé dans admin_users:', error.message);
        setUserProfile(null);
        setUserRole(null);
        return null;
      }

      console.log('AuthContext: Profil chargé, rôle:', data?.role);
      setUserProfile(data);
      setUserRole(data?.role || null);
      return data;
    } catch (err) {
      console.error('AuthContext: Erreur chargement profil:', err);
      setUserProfile(null);
      setUserRole(null);
      return null;
    } finally {
      isLoadingProfile.current = false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Timeout de sécurité - 8 secondes max
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('AuthContext: Timeout de session - arrêt du chargement');
        setLoading(false);
        setAuthError('Connexion lente. Veuillez rafraîchir la page.');
      }
    }, 8000);

    // Vérifier la session au chargement
    const checkSession = async () => {
      try {
        console.log('AuthContext: Vérification de la session...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('AuthContext: Erreur getSession:', error);
          // Nettoyer si session invalide ou expirée
          if (error.message?.includes('Invalid') || error.message?.includes('expired')) {
            await clearCorruptedSession();
          }
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (!isMounted) return;

        const currentUser = session?.user ?? null;
        console.log('AuthContext: Session trouvée:', currentUser?.id || 'aucun utilisateur');
        setUser(currentUser);

        if (currentUser) {
          await loadUserProfile(currentUser.id);
        }
      } catch (err) {
        console.error('AuthContext: Exception lors de getSession:', err);
        if (isMounted) {
          await clearCorruptedSession();
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    checkSession();

    // Écouter les changements d'auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthContext: Event auth:', event);

      if (!isMounted) return;

      // Ignorer TOKEN_REFRESHED pour éviter rechargements inutiles
      if (event === 'TOKEN_REFRESHED') return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (event === 'SIGNED_OUT') {
        setUserProfile(null);
        setUserRole(null);
        setAuthError(null);
      } else if (currentUser && event === 'SIGNED_IN') {
        await loadUserProfile(currentUser.id);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [loadUserProfile, clearCorruptedSession]);

  const signIn = async (email, password) => {
    console.log("AuthContext: signIn pour", email);
    setAuthError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error("AuthContext: Erreur signIn", error);
        // Messages d'erreur plus clairs en français
        if (error.message?.includes('Invalid login')) {
          throw new Error('Email ou mot de passe incorrect');
        }
        if (error.message?.includes('Email not confirmed')) {
          throw new Error('Veuillez confirmer votre email');
        }
        throw error;
      }

      console.log("AuthContext: Connexion réussie", data.user?.id);

      if (data.user) {
        const profile = await loadUserProfile(data.user.id);
        if (!profile) {
          throw new Error('Compte non autorisé. Contactez l\'administrateur.');
        }
        return { ...data, profile };
      }

      return data;
    } catch (err) {
      console.error("AuthContext: Exception signIn", err);
      setAuthError(err.message);
      throw err;
    }
  };

  const signOut = async () => {
    console.log("AuthContext: Déconnexion...");
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("AuthContext: Erreur signOut", e);
      await clearCorruptedSession();
    } finally {
      setUser(null);
      setUserProfile(null);
      setUserRole(null);
      setAuthError(null);
    }
  };

  // Fonction utilitaire pour rafraîchir la session
  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        await clearCorruptedSession();
        setUser(null);
        setUserProfile(null);
        setUserRole(null);
        return false;
      }
      if (data.user) {
        setUser(data.user);
        await loadUserProfile(data.user.id);
      }
      return true;
    } catch (e) {
      console.error("AuthContext: Erreur refresh", e);
      return false;
    }
  };

  const value = {
    user,
    userProfile,
    userRole,
    loading,
    authError,
    signIn,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
