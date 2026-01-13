import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

function buildStats(inscriptions, paiements) {
  const safeInscriptions = Array.isArray(inscriptions) ? inscriptions : [];
  const safePaiements = Array.isArray(paiements) ? paiements : [];

  const totalInscriptions = safeInscriptions.length;
  const inscriptionsValidees = safeInscriptions.filter(i => i?.statut === 'valide').length;
  const inscriptionsEnAttente = safeInscriptions.filter(i => i?.statut === 'en_attente').length;
  const hommes = safeInscriptions.filter(i => i?.sexe === 'homme').length;
  const femmes = safeInscriptions.filter(i => i?.sexe === 'femme').length;

  const totalCollecte = safeInscriptions.reduce((acc, i) => acc + (i?.montant_total_paye || 0), 0);
  const paiementsEnAttente = safePaiements.filter(p => p?.statut === 'attente' || p?.statut === 'en_attente').length;
  const paiementsPartiels = safeInscriptions.filter(i => i?.statut_paiement === 'partiel').length;
  const paiementsComplets = safeInscriptions.filter(i => i?.statut_paiement === 'soldé' || i?.statut_paiement === 'valide_financier').length;

  return {
    totalInscriptions,
    inscriptionsValidees,
    inscriptionsEnAttente,
    hommes,
    femmes,
    totalCollecte,
    paiementsEnAttente,
    paiementsPartiels,
    paiementsComplets,
  };
}

/**
 * DataProvider: API attendue par les pages (Dashboard/Finance/Scientifique/Secrétariat)
 * - pas d'auth Supabase, mais CRUD Supabase reste actif
 */
export function DataProvider({ children }) {
  const { isAuthenticated } = useAuth();

  const [inscriptions, setInscriptions] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [dortoirs, setDortoirs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [chefsQuartier, setChefsQuartier] = useState([]);
  const [notesExamens, setNotesExamens] = useState([]);
  const [configCapaciteClasses, setConfigCapaciteClasses] = useState([]);
  const [stats, setStats] = useState(() => buildStats([], []));
  const [lastUpdate, setLastUpdate] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const pollingRef = useRef(null);
  const isLoadingRef = useRef(false);

  const loadAll = useCallback(async (silent = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    if (!silent) setLoading(true);

    const startTime = Date.now();
    try {
      const [
        inscriptionsRes,
        paiementsRes,
        dortoirsRes,
        classesRes,
        chefsQuartierRes,
        notesExamensRes,
        configCapaciteRes,
      ] = await Promise.all([
        supabase
          .from('inscriptions')
          .select('*, chef_quartier:chefs_quartier(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('paiements')
          .select('*, inscription:inscriptions(*)')
          .order('created_at', { ascending: false }),
        supabase.from('dortoirs').select('*').order('nom'),
        supabase.from('classes').select('*').order('nom'),
        supabase.from('chefs_quartier').select('*').order('nom_complet'),
        supabase
          .from('notes_examens')
          .select('*, inscription:inscriptions(*), classe:classes(*)'),
        supabase.from('config_capacite_classes').select('*').order('niveau'),
      ]);

      if (!mountedRef.current) return;

      const nextInscriptions = inscriptionsRes.error ? [] : (inscriptionsRes.data || []);
      const nextPaiements = paiementsRes.error ? [] : (paiementsRes.data || []);
      const nextDortoirs = dortoirsRes.error ? [] : (dortoirsRes.data || []);
      const nextClasses = classesRes.error ? [] : (classesRes.data || []);
      const nextChefs = chefsQuartierRes.error ? [] : (chefsQuartierRes.data || []);
      const nextNotes = notesExamensRes.error ? [] : (notesExamensRes.data || []);
      const nextConfig = configCapaciteRes.error ? [] : (configCapaciteRes.data || []);

      setInscriptions(nextInscriptions);
      setPaiements(nextPaiements);
      setDortoirs(nextDortoirs);
      setClasses(nextClasses);
      setChefsQuartier(nextChefs);
      setNotesExamens(nextNotes);
      setConfigCapaciteClasses(nextConfig);
      setStats(buildStats(nextInscriptions, nextPaiements));
      setLastUpdate(new Date());
      setError(null);

      console.log(`DataContext: ✅ Chargé en ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error('DataContext: Erreur:', err?.message || err);
      if (mountedRef.current) setError(err?.message || 'Erreur chargement données');
    } finally {
      if (mountedRef.current) setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!isAuthenticated) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setInscriptions([]);
      setPaiements([]);
      setDortoirs([]);
      setClasses([]);
      setChefsQuartier([]);
      setNotesExamens([]);
      setConfigCapaciteClasses([]);
      setStats(buildStats([], []));
      setLastUpdate(null);
      setLoading(false);
      setError(null);
      return;
    }

    console.log('DataContext: 🚀 Utilisateur connecté, chargement...');
    loadAll(false);

    pollingRef.current = setInterval(() => {
      if (mountedRef.current) {
        loadAll(true);
      }
    }, 3 * 60 * 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isAuthenticated, loadAll]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const refresh = useCallback(async () => {
    console.log('DataContext: Rafraîchissement manuel');
    await loadAll(false);
  }, [loadAll]);

  const statsScientifique = useMemo(() => {
    const safeInscriptions = Array.isArray(inscriptions) ? inscriptions : [];
    const safeNotes = Array.isArray(notesExamens) ? notesExamens : [];
    const safeClasses = Array.isArray(classes) ? classes : [];

    const totalParticipantsValides = safeInscriptions.filter(i => i?.statut === 'valide').length;

    const parNiveauSets = {
      niveau_1: new Set(),
      niveau_2: new Set(),
      niveau_3: new Set(),
      niveau_superieur: new Set(),
    };

    const inscriptionIdsAvecNoteEntree = new Set();
    const inscriptionIdsAvecMoyenne = new Set();

    for (const note of safeNotes) {
      const inscriptionId = note?.inscription_id;
      if (!inscriptionId) continue;

      const niveau = note?.niveau_attribue;
      if (niveau && Object.prototype.hasOwnProperty.call(parNiveauSets, niveau)) {
        parNiveauSets[niveau].add(inscriptionId);
      }

      const noteEntree = note?.note_entree;
      if (noteEntree !== null && noteEntree !== undefined && noteEntree !== '') {
        inscriptionIdsAvecNoteEntree.add(inscriptionId);
      }

      const moyenne = note?.moyenne;
      if (moyenne !== null && moyenne !== undefined && moyenne !== '') {
        inscriptionIdsAvecMoyenne.add(inscriptionId);
      }
    }

    return {
      totalParticipantsValides,
      participantsAvecNoteEntree: inscriptionIdsAvecNoteEntree.size,
      participantsAvecMoyenne: inscriptionIdsAvecMoyenne.size,
      totalClasses: safeClasses.length,
      parNiveau: {
        niveau_1: parNiveauSets.niveau_1.size,
        niveau_2: parNiveauSets.niveau_2.size,
        niveau_3: parNiveauSets.niveau_3.size,
        niveau_superieur: parNiveauSets.niveau_superieur.size,
      },
    };
  }, [inscriptions, notesExamens, classes]);

  // Fonctions “locales” utilisées par certaines pages pour mise à jour instantanée UI
  const updateInscriptionLocal = useCallback((id, updates) => {
    setInscriptions(prev => prev.map(i => (i?.id === id ? { ...i, ...updates } : i)));
  }, []);

  const deleteInscriptionLocal = useCallback((id) => {
    setInscriptions(prev => prev.filter(i => i?.id !== id));
  }, []);

  const updatePaiementLocal = useCallback((id, updates) => {
    setPaiements(prev => prev.map(p => (p?.id === id ? { ...p, ...updates } : p)));
  }, []);

  const updateNoteLocal = useCallback((id, updates) => {
    setNotesExamens(prev => prev.map(n => (n?.id === id ? { ...n, ...updates } : n)));
  }, []);

  const addInscriptionLocal = useCallback((inscription) => {
    if (!inscription) return;
    setInscriptions(prev => {
      const next = Array.isArray(prev) ? prev : [];
      const exists = next.some(i => i?.id === inscription?.id);
      return exists ? next.map(i => (i?.id === inscription?.id ? { ...i, ...inscription } : i)) : [inscription, ...next];
    });
  }, []);

  const addPaiementLocal = useCallback((paiement) => {
    if (!paiement) return;
    setPaiements(prev => {
      const next = Array.isArray(prev) ? prev : [];
      const exists = next.some(p => p?.id === paiement?.id);
      return exists ? next.map(p => (p?.id === paiement?.id ? { ...p, ...paiement } : p)) : [paiement, ...next];
    });
  }, []);

  const addClasseLocal = useCallback((classe) => {
    if (!classe) return;
    setClasses(prev => {
      const next = Array.isArray(prev) ? prev : [];
      const exists = next.some(c => c?.id === classe?.id);
      return exists ? next.map(c => (c?.id === classe?.id ? { ...c, ...classe } : c)) : [...next, classe];
    });
  }, []);

  const addNoteLocal = useCallback((note) => {
    if (!note) return;
    setNotesExamens(prev => {
      const next = Array.isArray(prev) ? prev : [];
      const exists = next.some(n => n?.id === note?.id);
      return exists ? next.map(n => (n?.id === note?.id ? { ...n, ...note } : n)) : [...next, note];
    });
  }, []);

  const value = {
    inscriptions,
    paiements,
    dortoirs,
    classes,
    chefsQuartier,
    notesExamens,
    configCapaciteClasses,
    stats,
    statsScientifique,
    lastUpdate,
    loading,
    error,
    refresh,
    addInscriptionLocal,
    addPaiementLocal,
    addClasseLocal,
    addNoteLocal,
    updateInscriptionLocal,
    deleteInscriptionLocal,
    updatePaiementLocal,
    updateNoteLocal,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData doit être utilisé dans DataProvider');
  }
  return context;
}

export default DataContext;
