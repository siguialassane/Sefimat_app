import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase Lib: Using VITE_SUPABASE_URL:", supabaseUrl);
console.log("Supabase Lib: VITE_SUPABASE_ANON_KEY length:", supabaseAnonKey?.length);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

/**
 * Nettoie les anciennes données d'authentification Supabase du localStorage
 * Cette fonction est nécessaire car on utilise maintenant l'auth locale
 */
export function clearSupabaseAuthCache() {
  if (typeof window === 'undefined') return;

  console.log('Supabase Lib: Nettoyage du cache Supabase Auth...');

  // Patterns des clés Supabase Auth à nettoyer
  const supabaseAuthKeys = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('sb-') ||
      key.includes('supabase') ||
      key.includes('auth-token')
    )) {
      // Ne pas supprimer notre propre clé d'auth locale
      if (key !== 'sefimap_auth_user') {
        supabaseAuthKeys.push(key);
      }
    }
  }

  supabaseAuthKeys.forEach(key => {
    console.log(`Supabase Lib: Suppression de la clé "${key}"`);
    localStorage.removeItem(key);
  });

  if (supabaseAuthKeys.length > 0) {
    console.log(`Supabase Lib: ${supabaseAuthKeys.length} clé(s) Supabase Auth supprimée(s)`);
  }
}

// Nettoyer le cache au chargement du module
clearSupabaseAuthCache();

// Configuration du client Supabase
// IMPORTANT: persistSession est désactivé car on utilise l'authentification locale
// Le client Supabase est uniquement utilisé pour les opérations de base de données
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    // Pas de storage pour éviter les conflits avec l'auth locale
  },
  global: {
    headers: { 'x-my-custom-header': 'sefimap-app' },
  },
});
