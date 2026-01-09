import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook personnalisé pour charger des données avec gestion robuste des erreurs,
 * timeouts, et protection contre les appels simultanés.
 *
 * @param {Function} fetchFunction - Fonction async qui retourne les données
 * @param {Object} options - Options de configuration
 * @param {number} options.timeout - Timeout en ms (défaut: 15000)
 * @param {boolean} options.autoLoad - Charger automatiquement au montage (défaut: true)
 * @param {Array} options.dependencies - Dépendances pour recharger (défaut: [])
 * @param {Function} options.onError - Callback en cas d'erreur
 * @param {Function} options.onSuccess - Callback en cas de succès
 *
 * @returns {Object} { data, loading, error, reload, isStale }
 */
export function useDataLoader(fetchFunction, options = {}) {
  const {
    timeout = 15000,
    autoLoad = true,
    dependencies = [],
    onError,
    onSuccess,
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);

  // Refs pour la gestion des appels
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef(null);
  const timeoutIdRef = useRef(null);
  const retryCountRef = useRef(0);

  // Fonction de chargement principale
  const load = useCallback(async (forceReload = false) => {
    // Protection contre les appels simultanés (sauf si forceReload)
    if (isLoadingRef.current && !forceReload) {
      console.log('useDataLoader: Chargement déjà en cours, ignoré');
      return;
    }

    // Annuler tout appel précédent
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }

    isLoadingRef.current = true;
    abortControllerRef.current = new AbortController();

    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    // Timeout de sécurité
    const timeoutPromise = new Promise((_, reject) => {
      timeoutIdRef.current = setTimeout(() => {
        reject(new Error('TIMEOUT: Le chargement a pris trop de temps. Veuillez réessayer.'));
      }, timeout);
    });

    try {
      // Course entre la requête et le timeout
      const result = await Promise.race([
        fetchFunction(abortControllerRef.current.signal),
        timeoutPromise
      ]);

      clearTimeout(timeoutIdRef.current);

      if (isMountedRef.current) {
        setData(result);
        setIsStale(false);
        setError(null);
        retryCountRef.current = 0;

        if (onSuccess) {
          onSuccess(result);
        }
      }
    } catch (err) {
      clearTimeout(timeoutIdRef.current);

      // Ignorer les erreurs d'abort (navigation away)
      if (err.name === 'AbortError') {
        console.log('useDataLoader: Requête annulée');
        return;
      }

      console.error('useDataLoader: Erreur:', err.message);

      if (isMountedRef.current) {
        // Message d'erreur utilisateur-friendly
        let userMessage = err.message;
        if (err.message.includes('TIMEOUT')) {
          userMessage = 'Le chargement a pris trop de temps. Cliquez sur "Actualiser" pour réessayer.';
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          userMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
        }

        setError(userMessage);
        setIsStale(true);

        if (onError) {
          onError(err);
        }
      }
    } finally {
      isLoadingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFunction, timeout, onError, onSuccess]);

  // Fonction de rechargement exposée
  const reload = useCallback(() => {
    return load(true);
  }, [load]);

  // Chargement automatique au montage et quand les dépendances changent
  useEffect(() => {
    isMountedRef.current = true;

    if (autoLoad) {
      load();
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return {
    data,
    loading,
    error,
    reload,
    isStale,
    setData, // Pour permettre les mises à jour locales
  };
}

/**
 * Wrapper pour les appels Supabase avec meilleure gestion d'erreurs
 */
export async function supabaseQuery(queryBuilder, signal) {
  const { data, error } = await queryBuilder;

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(error.message || 'Erreur lors du chargement des données');
  }

  return data;
}

export default useDataLoader;
