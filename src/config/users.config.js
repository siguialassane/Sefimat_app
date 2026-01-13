/**
 * Configuration des utilisateurs pour l'authentification locale
 * 
 * ATTENTION: Ce fichier est pour les TESTS uniquement.
 * En production, utilisez une authentification sécurisée.
 * 
 * Pour ajouter un utilisateur:
 * 1. Ajouter une entrée dans le tableau USERS
 * 2. L'email doit être unique
 * 3. Le rôle doit être: 'secretaire', 'financier', 'scientifique', ou 'president'
 */

export const USERS = [
  {
    id: '6f2b1d90-6fbe-4e3a-9b7c-3f9c7a5c1e01',
    email: 'siguialassane93@gmail.com',
    password: 'alasco22',
    nom: 'Sigui',
    prenom: 'Alassane',
    role: 'secretaire',
  },
  {
    id: '5b9d9f5d-0a50-4dd0-9f2b-5f2e3b3b1a02',
    email: 'alassanesigui80@gmail.com',
    password: 'alasco22',
    nom: 'Kone',
    prenom: 'Alassane',
    role: 'financier',
  },
  {
    id: 'cf8a7282-5a11-4e43-a88d-8bdbf4f74d03',
    email: 'alassanesigui99@gmail.com',
    password: 'alasco22',
    nom: 'Toure',
    prenom: 'Alassane',
    role: 'scientifique',
  },
];

// Clé de stockage
export const AUTH_STORAGE_KEY = 'sefimap_auth_user';

/**
 * Type de persistance:
 * - 'none'    : ne persiste pas (perdu au refresh)
 * - 'session' : sessionStorage (perdu quand on ferme l'onglet)
 * - 'local'   : localStorage (reste après fermeture)
 */
export const DEFAULT_AUTH_STORAGE = /** @type {'none'|'session'|'local'} */ (
  (import.meta?.env?.VITE_AUTH_STORAGE || 'session').toLowerCase()
);

function getStorageApi(storageType) {
  if (typeof window === 'undefined') return null;
  if (storageType === 'local') return window.localStorage;
  if (storageType === 'session') return window.sessionStorage;
  return null;
}

export function normalizeStorageType(storageType) {
  const t = (storageType || DEFAULT_AUTH_STORAGE || 'session').toLowerCase();
  if (t === 'none' || t === 'session' || t === 'local') return t;
  return 'session';
}

export function findUserByIdOrEmail(idOrEmail) {
  if (!idOrEmail) return null;
  const key = String(idOrEmail).toLowerCase();
  return (
    USERS.find(u => String(u.id) === String(idOrEmail)) ||
    USERS.find(u => u.email.toLowerCase() === key) ||
    null
  );
}

export function isValidStoredUser(user) {
  if (!user || typeof user !== 'object') return false;
  if (!user.email || !user.role) return false;
  const found = findUserByIdOrEmail(user.id || user.email);
  if (!found) return false;
  // On ne compare pas le password (on ne le stocke pas)
  return found.email.toLowerCase() === String(user.email).toLowerCase();
}

/**
 * Trouve un utilisateur par email et mot de passe
 * @param {string} email 
 * @param {string} password 
 * @returns {object|null} L'utilisateur sans le mot de passe, ou null
 */
export function authenticateUser(email, password) {
  const user = USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (user) {
    // Retourner l'utilisateur SANS le mot de passe
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  return null;
}

/**
 * Récupère l'utilisateur stocké (local/session/none)
 * @returns {object|null}
 */
export function getStoredUser(storageType) {
  try {
    const api = getStorageApi(normalizeStorageType(storageType));
    if (!api) return null;
    const stored = api.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (isValidStoredUser(parsed)) return parsed;
      // Cache invalide (ancien format / user supprimé) => purge
      api.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  } catch (err) {
    console.error('Erreur lecture storage:', err);
  }
  return null;
}

/**
 * Stocke l'utilisateur (local/session/none)
 * @param {object} user 
 */
export function storeUser(user, storageType) {
  try {
    const api = getStorageApi(normalizeStorageType(storageType));
    if (!api) return;
    api.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Erreur écriture storage:', err);
  }
}

/**
 * Supprime l'utilisateur du storage (local/session) et nettoie le cache Supabase (localStorage)
 */
export function clearStoredUser(storageType) {
  try {
    // Supprimer notre clé d'auth locale (sur le storage configuré)
    const api = getStorageApi(normalizeStorageType(storageType));
    if (api) api.removeItem(AUTH_STORAGE_KEY);

    // Nettoyer aussi les éventuels restes de Supabase Auth
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth-token'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    console.log('Auth: Cache utilisateur nettoyé');
  } catch (err) {
    console.error('Erreur suppression localStorage:', err);
  }
}

/**
 * Mapping des rôles vers les routes
 */
export const ROLE_ROUTES = {
  secretaire: '/admin/dashboard',
  financier: '/finance/dashboard',
  scientifique: '/scientifique/dashboard',
  president: '/president',
};

/**
 * Obtient la route par défaut pour un rôle
 * @param {string} role 
 * @returns {string}
 */
export function getDefaultRoute(role) {
  return ROLE_ROUTES[role] || '/dashboard';
}
