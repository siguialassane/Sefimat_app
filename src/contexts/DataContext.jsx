import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  getFinanceCollectedAmount,
  getPendingAmount,
  getRemainingDue,
  isFinanceValidationPending,
  isVersementPending,
} from '../lib/finance';
import { useAuth } from './AuthContext';
import { isInSecretariatScope } from '../lib/secretariat';
import { isExcluScientifique } from '../lib/scientifique';
import { DataContext } from './data-context';

function buildStats(inscriptions, paiements) {
  const safeInscriptions = Array.isArray(inscriptions) ? inscriptions : [];
  const safePaiements = Array.isArray(paiements) ? paiements : [];

  // Pour les stats générales du secrétariat, ne compter que les inscriptions
  // visibles (cf. src/lib/secretariat.js)
  const inscriptionsVisiblesSecretariat = safeInscriptions.filter(i => {
    return isInSecretariatScope(i);
  });

  const totalInscriptions = inscriptionsVisiblesSecretariat.length;
  const inscriptionsValidees = inscriptionsVisiblesSecretariat.filter(i => i?.statut === 'valide').length;
  const inscriptionsEnAttente = inscriptionsVisiblesSecretariat.filter(i => i?.statut === 'en_attente').length;
  const hommes = inscriptionsVisiblesSecretariat.filter(i => i?.sexe === 'homme').length;
  const femmes = inscriptionsVisiblesSecretariat.filter(i => i?.sexe === 'femme').length;

  const totalCollecte = safeInscriptions.reduce((acc, i) => acc + getFinanceCollectedAmount(i), 0);
  const paiementsEnAttente = safeInscriptions.filter(i => isFinanceValidationPending(i)).length;
  // Soldé/partiel = état de la dette (déclaré + reste), indépendant de la réception en caisse.
  const paiementsPartiels = safeInscriptions.filter(i =>
    getRemainingDue(i) > 0 &&
    (i?.montant_total_paye || 0) > 0
  ).length;
  const paiementsComplets = safeInscriptions.filter(i =>
    getRemainingDue(i) === 0 &&
    (i?.montant_total_paye || 0) > 0
  ).length;
  // Caisse : dehors (attente) vs dedans (reçu).
  const versementsEnAttente = safePaiements.filter(p => isVersementPending(p)).length;
  const montantDehors = safeInscriptions.reduce((acc, i) => acc + getPendingAmount(i), 0);

  return {
    totalInscriptions,
    inscriptionsValidees,
    inscriptionsEnAttente,
    hommes,
    femmes,
    totalCollecte,
    montantDedans: totalCollecte,
    montantDehors,
    versementsEnAttente,
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
  const [configSeuilsNiveaux, setConfigSeuilsNiveaux] = useState([]);
  const [stats, setStats] = useState(() => buildStats([], []));
  const [lastUpdate, setLastUpdate] = useState(null);
  // Dernier versement arrivé en caisse (notif temps réel, consommé par la finance).
  const [caisseEvent, setCaisseEvent] = useState(null);

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
        configSeuilsRes,
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
        supabase.from('config_seuils_niveaux').select('*').order('note_max'),
      ]);

      if (!mountedRef.current) return;

      const nextInscriptions = inscriptionsRes.error ? [] : (inscriptionsRes.data || []);
      const nextPaiements = paiementsRes.error ? [] : (paiementsRes.data || []);
      const nextDortoirs = dortoirsRes.error ? [] : (dortoirsRes.data || []);
      const nextClasses = classesRes.error ? [] : (classesRes.data || []);
      const nextChefs = chefsQuartierRes.error ? [] : (chefsQuartierRes.data || []);
      const nextNotes = notesExamensRes.error ? [] : (notesExamensRes.data || []);
      const nextConfig = configCapaciteRes.error ? [] : (configCapaciteRes.data || []);
      const nextSeuils = configSeuilsRes.error ? [] : (configSeuilsRes.data || []);

      setInscriptions(nextInscriptions);
      setPaiements(nextPaiements);
      setDortoirs(nextDortoirs);
      setClasses(nextClasses);
      setChefsQuartier(nextChefs);
      setNotesExamens(nextNotes);
      setConfigCapaciteClasses(nextConfig);
      setConfigSeuilsNiveaux(nextSeuils);
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

    /* eslint-disable react-hooks/set-state-in-effect -- reset synchrone à la déconnexion */
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
    /* eslint-enable react-hooks/set-state-in-effect */

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

    // Pour la cellule scientifique, ne compter que les inscriptions qui sont visibles
    // c'est-à-dire : 
    // - Les inscriptions NON président validées (ancien système)
    // - Les inscriptions président avec workflow_status = 'completed'
    const inscriptionsVisiblesScientifique = safeInscriptions.filter(i => {
      // Pépinière : exclu de la cellule scientifique
      if (isExcluScientifique(i)) return false;
      // Si inscription président, elle doit être completed
      if (i?.created_by === 'president') {
        return i?.workflow_status === 'completed' && i?.statut === 'valide';
      }
      // Sinon, seules les inscriptions validées sont comptées
      return i?.statut === 'valide';
    });

    const totalParticipantsValides = inscriptionsVisiblesScientifique.length;

    const parNiveauSets = {
      niveau_1: new Set(),
      niveau_2: new Set(),
      niveau_3: new Set(),
      niveau_superieur: new Set(),
    };

    const inscriptionIdsAvecNoteEntree = new Set();
    const inscriptionIdsAvecMoyenne = new Set();
    const inscById = new Map(safeInscriptions.map(i => [i?.id, i]));

    for (const note of safeNotes) {
      const inscriptionId = note?.inscription_id;
      if (!inscriptionId) continue;
      // Pépinière : notes ignorées dans les stats scientifiques
      if (isExcluScientifique(note?.inscription ?? inscById.get(inscriptionId))) continue;

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

  // Temps réel caisse : un versement président arrive -> état local + event
  // pour le toast finance. Le polling reste en fallback.
  useEffect(() => {
    if (!isAuthenticated) return;
    const channel = supabase
      .channel("caisse-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "paiements" },
        (payload) => {
          const row = payload?.new;
          if (row) addPaiementLocal(row);
          if (row?.statut === "attente") {
            setCaisseEvent({ versement: row, at: Date.now() });
          }
          loadAll(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "paiements" },
        (payload) => {
          if (payload?.new?.id) updatePaiementLocal(payload.new.id, payload.new);
          loadAll(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inscriptions" },
        () => {
          loadAll(true);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, loadAll, addPaiementLocal, updatePaiementLocal]);

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
    configSeuilsNiveaux,
    stats,
    statsScientifique,
    lastUpdate,
    caisseEvent,
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

// useData + DataContext vivent dans ./data-context (fast refresh).
