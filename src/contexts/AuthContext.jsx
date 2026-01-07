import { createContext, useContext, useState, useEffect } from 'react';
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

  // Fonction pour charger le profil utilisateur depuis admin_users
  const loadUserProfile = async (userId) => {
    if (!userId) {
      setUserProfile(null);
      setUserRole(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Utilisateur non trouvé dans admin_users:', error.message);
        setUserProfile(null);
        setUserRole(null);
        return null;
      }

      setUserProfile(data);
      setUserRole(data?.role || null);
      return data;
    } catch (err) {
      console.error('Erreur chargement profil:', err);
      setUserProfile(null);
      setUserRole(null);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Timeout de sécurité - si après 10 secondes on n'a toujours pas de réponse, arrêter le loading
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('AuthContext: Timeout de session - arrêt du chargement');
        setLoading(false);
      }
    }, 10000);

    // Vérifier la session au chargement
    const checkSession = async () => {
      try {
        console.log('AuthContext: Vérification de la session...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('AuthContext: Erreur getSession:', error);
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
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('AuthContext: Event auth state change:', _event);

      if (!isMounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await loadUserProfile(currentUser.id);
      } else {
        setUserProfile(null);
        setUserRole(null);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    console.log("AuthContext: signIn called for", email);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error("AuthContext: signInWithPassword error", error);
        throw error;
      }

      console.log("AuthContext: signInWithPassword success", data.user?.id);

      // Charger le profil après connexion
      if (data.user) {
        console.log("AuthContext: loading profile...");
        const profile = await loadUserProfile(data.user.id);
        console.log("AuthContext: profile loaded", profile);
        return { ...data, profile };
      }

      return data;
    } catch (err) {
      console.error("AuthContext: signIn exception", err);
      throw err;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUserProfile(null);
    setUserRole(null);
  };

  const value = {
    user,
    userProfile,
    userRole,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
