import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

const DataContext = createContext({});

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

// === CONFIGURATION ===
const POLLING_INTERVAL = 3 * 60 * 1000; // 3 minutes en millisecondes
const LOADING_TIMEOUT = 15000; // 15 secondes timeout

/**
 * DataProvider - Contexte global SANS Realtime (Polling + Cache)
 * 
 * ARCHITECTURE SIMPLIFIÉE:
 * ✅ Pas de Realtime Supabase (source de bugs en mode gratuit)
 * ✅ Polling automatique toutes les 3 minutes
 * ✅ Bouton "Actualiser" pour rafraîchissement manuel
 * ✅ Cache mémoire entre les navigations
 * ✅ Optimistic updates pour UX fluide
 * ✅ 100% fiable et simple à maintenir
 */
export function DataProvider({ children }) {
  const { user } = useAuth();
  
  // === ÉTATS DES DONNÉES ===
  const [inscriptions, setInscriptions] = useState([]);
  const [chefsQuartier, setChefsQuartier] = useState([]);
  const [dortoirs, setDortoirs] = useState([]);
  const [paiements, setPaiements] = useState([]);

  // === ÉTATS CELLULE SCIENTIFIQUE ===
  const [notesExamens, setNotesExamens] = useState([]);
  const [classes, setClasses] = useState([]);
  const [configCapaciteClasses, setConfigCapaciteClasses] = useState([]);
  
  // === ÉTATS DE CHARGEMENT ===
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false); // Pour le polling silencieux
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // === REFS ===
  const isLoadingRef = useRef(false);
  const isMountedRef = useRef(true);
  const pollingIntervalRef = useRef(null);

  // === FONCTION DE CHARGEMENT PRINCIPAL ===
  const loadAllData = useCallback(async (options = {}) => {
    const { forceReload = false, silent = false } = options;

    // Ne pas recharger si déjà en cours
    if (isLoadingRef.current) {
      console.log('DataContext: Chargement déjà en cours, ignoré');
      return false;
    }

    // Ne pas recharger si déjà chargé (sauf forceReload)
    if (initialLoaded && !forceReload) {
      console.log('DataContext: Données déjà en cache');
      return true;
    }

    isLoadingRef.current = true;
    
    // Mode silencieux = polling automatique (pas de spinner)
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    // Timeout de sécurité
    const timeoutId = setTimeout(() => {
      console.warn('DataContext: Timeout atteint');
      isLoadingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    }, LOADING_TIMEOUT);

    console.log(`DataContext: Chargement des données... (silent: ${silent})`);
    const startTime = Date.now();

    try {
      // Charger toutes les données en parallèle
      const [
        inscriptionsRes, 
        chefsRes, 
        dortoirsRes, 
        paiementsRes, 
        notesRes, 
        classesRes, 
        configCapaciteRes
      ] = await Promise.all([
        supabase
          .from('inscriptions')
          .select(`
            *,
            chef_quartier:chefs_quartier(id, nom_complet, zone),
            dortoir:dortoirs(id, nom)
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('chefs_quartier')
          .select('*')
          .order('nom_complet'),

        supabase
          .from('dortoirs')
          .select('*')
          .order('nom'),

        supabase
          .from('paiements')
          .select(`
            *,
            inscription:inscriptions(id, nom, prenom, type_inscription)
          `)
          .order('date_paiement', { ascending: false }),

        supabase
          .from('notes_examens')
          .select(`
            *,
            inscription:inscriptions(id, nom, prenom, photo_url, sexe, age, dortoir_id),
            classe:classes(id, nom, niveau, numero)
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('classes')
          .select('*')
          .order('niveau')
          .order('numero'),

        supabase
          .from('config_capacite_classes')
          .select('*')
          .order('niveau')
      ]);

      // Vérifier les erreurs critiques
      if (inscriptionsRes.error) throw inscriptionsRes.error;
      if (chefsRes.error) throw chefsRes.error;
      if (dortoirsRes.error) throw dortoirsRes.error;
      if (paiementsRes.error) throw paiementsRes.error;

      // Erreurs non-critiques (tables peuvent ne pas exister)
      if (notesRes.error && !notesRes.error.message?.includes('does not exist')) {
        console.warn('DataContext: Erreur notes_examens:', notesRes.error.message);
      }
      if (classesRes.error && !classesRes.error.message?.includes('does not exist')) {
        console.warn('DataContext: Erreur classes:', classesRes.error.message);
      }

      if (isMountedRef.current) {
        setInscriptions(inscriptionsRes.data || []);
        setChefsQuartier(chefsRes.data || []);
        setDortoirs(dortoirsRes.data || []);
        setPaiements(paiementsRes.data || []);
        setNotesExamens(notesRes.data || []);
        setClasses(classesRes.data || []);
        setConfigCapaciteClasses(configCapaciteRes.data || []);
        setInitialLoaded(true);
        setLastUpdate(new Date());

        const elapsed = Date.now() - startTime;
        console.log(`DataContext: ✅ Données chargées en ${elapsed}ms`, {
          inscriptions: inscriptionsRes.data?.length || 0,
          paiements: paiementsRes.data?.length || 0,
          notes: notesRes.data?.length || 0,
          classes: classesRes.data?.length || 0
        });
      }

      return true;
    } catch (err) {
      console.error('DataContext: ❌ Erreur chargement:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Erreur lors du chargement des données');
        setInitialLoaded(true);
      }
      return false;
    } finally {
      clearTimeout(timeoutId);
      isLoadingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [initialLoaded]);

  // === FONCTION DE RAFRAÎCHISSEMENT MANUEL ===
  const refresh = useCallback(async () => {
    console.log('DataContext: 🔄 Rafraîchissement manuel demandé');
    return loadAllData({ forceReload: true, silent: false });
  }, [loadAllData]);

  // === FONCTION DE POLLING SILENCIEUX ===
  const silentRefresh = useCallback(async () => {
    console.log('DataContext: 🔄 Polling automatique...');
    return loadAllData({ forceReload: true, silent: true });
  }, [loadAllData]);

  // === EFFET PRINCIPAL: Charger les données + Polling ===
  useEffect(() => {
    isMountedRef.current = true;

    // Nettoyer le polling précédent
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Si pas d'utilisateur connecté, reset tout
    if (!user) {
      console.log('DataContext: Utilisateur déconnecté, nettoyage...');
      setInscriptions([]);
      setChefsQuartier([]);
      setDortoirs([]);
      setPaiements([]);
      setNotesExamens([]);
      setClasses([]);
      setConfigCapaciteClasses([]);
      setInitialLoaded(false);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      setLastUpdate(null);
      isLoadingRef.current = false;
      return;
    }

    // Charger les données initiales
    console.log('DataContext: 🚀 Initialisation pour user:', user.id);
    loadAllData({ forceReload: true });

    // Démarrer le polling automatique (toutes les 3 minutes)
    console.log(`DataContext: ⏱️ Polling démarré (intervalle: ${POLLING_INTERVAL / 1000}s)`);
    pollingIntervalRef.current = setInterval(() => {
      if (isMountedRef.current && !isLoadingRef.current) {
        silentRefresh();
      }
    }, POLLING_INTERVAL);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        console.log('DataContext: ⏹️ Polling arrêté');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [user, loadAllData, silentRefresh]);

  // === OPTIMISTIC UPDATES (mise à jour locale immédiate) ===
  
  // Inscriptions
  const addInscriptionLocal = useCallback((inscription) => {
    setInscriptions(prev => [inscription, ...prev]);
    setLastUpdate(new Date());
  }, []);

  const updateInscriptionLocal = useCallback((id, updates) => {
    setInscriptions(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    setLastUpdate(new Date());
  }, []);

  const deleteInscriptionLocal = useCallback((id) => {
    setInscriptions(prev => prev.filter(i => i.id !== id));
    setLastUpdate(new Date());
  }, []);

  // Paiements
  const addPaiementLocal = useCallback((paiement) => {
    setPaiements(prev => [paiement, ...prev]);
    setLastUpdate(new Date());
  }, []);

  const updatePaiementLocal = useCallback((id, updates) => {
    setPaiements(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    setLastUpdate(new Date());
  }, []);

  // Notes
  const addNoteLocal = useCallback((note) => {
    setNotesExamens(prev => [note, ...prev]);
    setLastUpdate(new Date());
  }, []);

  const updateNoteLocal = useCallback((id, updates) => {
    setNotesExamens(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    setLastUpdate(new Date());
  }, []);

  const deleteNoteLocal = useCallback((id) => {
    setNotesExamens(prev => prev.filter(n => n.id !== id));
    setLastUpdate(new Date());
  }, []);

  // Classes
  const addClasseLocal = useCallback((classe) => {
    setClasses(prev => [...prev, classe].sort((a, b) => {
      if (a.niveau !== b.niveau) return a.niveau.localeCompare(b.niveau);
      return a.numero - b.numero;
    }));
    setLastUpdate(new Date());
  }, []);

  const updateClasseLocal = useCallback((id, updates) => {
    setClasses(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    setLastUpdate(new Date());
  }, []);

  const deleteClasseLocal = useCallback((id) => {
    setClasses(prev => prev.filter(c => c.id !== id));
    setLastUpdate(new Date());
  }, []);

  // === STATISTIQUES CALCULÉES ===
  const stats = {
    // Inscriptions
    totalInscriptions: inscriptions.length,
    inscriptionsValidees: inscriptions.filter(i => i.statut === 'valide').length,
    inscriptionsEnAttente: inscriptions.filter(i => i.statut === 'en_attente').length,
    inscriptionsRejetees: inscriptions.filter(i => i.statut === 'rejete').length,
    
    // Paiements
    totalCollecte: inscriptions.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0),
    paiementsEnAttente: inscriptions.filter(i => 
      i.statut_paiement === 'partiel' && (i.montant_total_paye || 0) < (i.montant_requis || 4000)
    ).length,
    paiementsPartiels: inscriptions.filter(i => i.statut_paiement === 'partiel').length,
    paiementsComplets: inscriptions.filter(i => 
      i.statut_paiement === 'soldé' || i.statut_paiement === 'valide_financier'
    ).length,
    paiementsValides: paiements.filter(p => p.statut === 'validé').length,
    paiementsNonValides: paiements.filter(p => 
      p.statut === 'attente' || p.statut === 'en_attente'
    ).length,
    
    // Démographiques
    hommes: inscriptions.filter(i => i.sexe === 'homme').length,
    femmes: inscriptions.filter(i => i.sexe === 'femme').length,
    
    // Par type
    inscriptionsEnLigne: inscriptions.filter(i => i.type_inscription === 'en_ligne').length,
    inscriptionsPresentielle: inscriptions.filter(i => i.type_inscription === 'presentielle').length,
  };

  // === STATISTIQUES CELLULE SCIENTIFIQUE ===
  const statsScientifique = {
    totalParticipantsValides: inscriptions.filter(i => i.statut === 'valide').length,
    participantsAvecNoteEntree: notesExamens.filter(n => n.note_entree != null).length,
    participantsSansNoteEntree: inscriptions.filter(i => i.statut === 'valide').length - 
      notesExamens.filter(n => n.note_entree != null).length,
    parNiveau: {
      niveau_1: notesExamens.filter(n => n.niveau_attribue === 'niveau_1').length,
      niveau_2: notesExamens.filter(n => n.niveau_attribue === 'niveau_2').length,
      niveau_3: notesExamens.filter(n => n.niveau_attribue === 'niveau_3').length,
      niveau_superieur: notesExamens.filter(n => n.niveau_attribue === 'niveau_superieur').length,
    },
    participantsAvecMoyenne: notesExamens.filter(n => n.moyenne != null).length,
    totalClasses: classes.length,
  };

  // === VALEUR DU CONTEXTE ===
  const value = {
    // Données
    inscriptions,
    chefsQuartier,
    dortoirs,
    paiements,
    stats,

    // Données Cellule Scientifique
    notesExamens,
    classes,
    configCapaciteClasses,
    statsScientifique,

    // États
    loading,
    refreshing, // Nouveau: pour afficher un indicateur de polling
    initialLoaded,
    error,
    lastUpdate,

    // Actions principales
    refresh,
    silentRefresh,

    // Optimistic updates - Inscriptions
    addInscriptionLocal,
    updateInscriptionLocal,
    deleteInscriptionLocal,

    // Optimistic updates - Paiements
    addPaiementLocal,
    updatePaiementLocal,

    // Optimistic updates - Notes
    addNoteLocal,
    updateNoteLocal,
    deleteNoteLocal,

    // Optimistic updates - Classes
    addClasseLocal,
    updateClasseLocal,
    deleteClasseLocal,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
