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
    // Vérifier la session au chargement
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await loadUserProfile(currentUser.id);
      }

      setLoading(false);
    });

    // Écouter les changements d'auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await loadUserProfile(currentUser.id);
      } else {
        setUserProfile(null);
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Charger le profil après connexion
    if (data.user) {
      const profile = await loadUserProfile(data.user.id);
      return { ...data, profile };
    }

    return data;
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
