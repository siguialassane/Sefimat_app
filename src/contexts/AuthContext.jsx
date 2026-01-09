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

  // Refs pour la gestion des appels
  const isLoadingProfile = useRef(false);
  const profileLoadTimeout = useRef(null);
  const isSigningIn = useRef(false); // Flag pour éviter le conflit signIn/onAuthStateChange

  // Fonction pour nettoyer la session corrompue - AGRESSIVE
  const clearCorruptedSession = useCallback(async () => {
    console.log('AuthContext: Nettoyage session COMPLET...');
    try {
      // Nettoyer TOUS les caches Supabase du localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth-token'))) {
          keysToRemove.push(key);
        }
      }
      console.log('AuthContext: Suppression de', keysToRemove.length, 'clés cache');
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Nettoyer aussi sessionStorage
      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

      // Reset les flags
      isLoadingProfile.current = false;
      isSigningIn.current = false;

      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('AuthContext: Erreur nettoyage:', e);
    }
  }, []);

  // Fonction pour charger le profil utilisateur depuis admin_users
  const loadUserProfile = async (userId, forceReload = false) => {
    if (!userId) {
      setUserProfile(null);
      setUserRole(null);
      return null;
    }

    // Si déjà en cours et pas de forceReload, attendre max 2 secondes
    if (isLoadingProfile.current && !forceReload) {
      console.log('AuthContext: Chargement profil déjà en cours, attente courte...');
      let attempts = 0;
      while (isLoadingProfile.current && attempts < 20) { // Max 2 secondes
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      // Si le profil est déjà chargé, le retourner
      if (userProfile && userProfile.id === userId) {
        return userProfile;
      }
      // Sinon, forcer le rechargement
      if (isLoadingProfile.current) {
        console.log('AuthContext: Timeout attente, forçage rechargement');
        isLoadingProfile.current = false;
      }
    }

    isLoadingProfile.current = true;

    // Timeout de sécurité: reset après 5 secondes
    if (profileLoadTimeout.current) {
      clearTimeout(profileLoadTimeout.current);
    }
    profileLoadTimeout.current = setTimeout(() => {
      console.warn('AuthContext: Timeout chargement profil, reset flag');
      isLoadingProfile.current = false;
    }, 5000);

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
      clearTimeout(profileLoadTimeout.current);
      isLoadingProfile.current = false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Timeout de sécurité - 15 secondes max (augmenté)
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('AuthContext: Timeout de session - arrêt du chargement');
        // Ne pas afficher d'erreur, juste terminer le chargement
        setLoading(false);
      }
    }, 15000);

    // Vérifier la session au chargement
    const checkSession = async () => {
      try {
        console.log('AuthContext: Vérification de la session...');

        // Vérifier d'abord si le localStorage contient des données corrompues
        const authKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('sb-')) {
            authKeys.push(key);
          }
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('AuthContext: Erreur getSession:', error);
          // Nettoyer si session invalide ou expirée
          await clearCorruptedSession();
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
        isSigningIn.current = false;
      } else if (currentUser && event === 'SIGNED_IN') {
        // IMPORTANT: Ne pas charger le profil ici si signIn est en cours
        // pour éviter le double appel et la race condition
        if (!isSigningIn.current) {
          console.log('AuthContext: SIGNED_IN event - chargement profil');
          await loadUserProfile(currentUser.id);
        } else {
          console.log('AuthContext: SIGNED_IN event ignoré (signIn en cours)');
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearCorruptedSession]);

  const signIn = async (email, password) => {
    console.log("AuthContext: signIn pour", email);
    setAuthError(null);

    // IMPORTANT: Marquer qu'on est en train de se connecter
    isSigningIn.current = true;

    // Réinitialiser les flags avant connexion
    isLoadingProfile.current = false;

    try {
      // Nettoyer le cache AVANT de tenter la connexion pour éviter les conflits
      console.log("AuthContext: Nettoyage cache avant connexion...");
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      if (keysToRemove.length > 0) {
        console.log("AuthContext: Suppression de", keysToRemove.length, "clés avant connexion");
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("AuthContext: Erreur signIn", error);
        isSigningIn.current = false;
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
        // Charger le profil directement (pas d'attente car on gère via isSigningIn)
        const profile = await loadUserProfile(data.user.id, true); // forceReload=true

        // Reset le flag après chargement du profil
        isSigningIn.current = false;

        if (!profile) {
          throw new Error('Compte non autorisé. Contactez l\'administrateur.');
        }
        return { ...data, profile };
      }

      isSigningIn.current = false;
      return data;
    } catch (err) {
      console.error("AuthContext: Exception signIn", err);
      isSigningIn.current = false;
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
