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

/**
 * DataProvider - Contexte global pour toutes les données de l'application
 * 
 * AVANTAGES:
 * - Cache des données entre les navigations (plus de rechargement constant)
 * - Une seule subscription Realtime pour toute l'app
 * - Évite les requêtes parallèles et les race conditions
 * - Chargement initial unique, mise à jour incrémentale ensuite
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
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // === REFS POUR ÉVITER LES RACE CONDITIONS ===
  const isLoadingRef = useRef(false);
  const channelRef = useRef(null);
  const isMountedRef = useRef(true);
  const initialLoadedRef = useRef(false); // Ref pour éviter la boucle de dépendances

  // === FONCTION DE CHARGEMENT PRINCIPAL ===
  const loadAllData = useCallback(async (forceReload = false) => {
    // Ne pas recharger si déjà en cours ou si déjà chargé (sauf forceReload)
    if (isLoadingRef.current) {
      console.log('DataContext: Chargement déjà en cours, ignoré');
      return;
    }

    // Utiliser la ref pour éviter les boucles de dépendances
    if (initialLoadedRef.current && !forceReload) {
      console.log('DataContext: Données déjà en cache, pas de rechargement');
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    // Timeout de sécurité: 15 secondes max
    const timeoutId = setTimeout(() => {
      console.warn('DataContext: Timeout atteint, forçage fin chargement');
      isLoadingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
        setInitialLoaded(true);
        initialLoadedRef.current = true; // Marquer comme chargé même en cas de timeout
      }
    }, 15000);

    console.log('DataContext: Chargement de toutes les données...');
    const startTime = Date.now();

    try {
      // Charger toutes les données en parallèle
      const [inscriptionsRes, chefsRes, dortoirsRes, paiementsRes, notesRes, classesRes, configCapaciteRes] = await Promise.all([
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

        // Cellule Scientifique
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

      // Vérifier les erreurs
      if (inscriptionsRes.error) throw inscriptionsRes.error;
      if (chefsRes.error) throw chefsRes.error;
      if (dortoirsRes.error) throw dortoirsRes.error;
      if (paiementsRes.error) throw paiementsRes.error;
      // Pour les tables scientifiques, on ignore les erreurs si elles n'existent pas encore
      if (notesRes.error && !notesRes.error.message?.includes('does not exist')) {
        console.warn('DataContext: Erreur notes_examens:', notesRes.error);
      }
      if (classesRes.error && !classesRes.error.message?.includes('does not exist')) {
        console.warn('DataContext: Erreur classes:', classesRes.error);
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
        initialLoadedRef.current = true; // Mettre à jour la ref aussi
        setLastUpdate(new Date());

        const elapsed = Date.now() - startTime;
        console.log(`DataContext: Données chargées en ${elapsed}ms`, {
          inscriptions: inscriptionsRes.data?.length || 0,
          chefs: chefsRes.data?.length || 0,
          dortoirs: dortoirsRes.data?.length || 0,
          paiements: paiementsRes.data?.length || 0,
          notes: notesRes.data?.length || 0,
          classes: classesRes.data?.length || 0
        });
      }
    } catch (err) {
      console.error('DataContext: Erreur chargement:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Erreur lors du chargement des données');
        setInitialLoaded(true);
        initialLoadedRef.current = true; // Marquer comme chargé même en erreur pour éviter boucle infinie
      }
    } finally {
      clearTimeout(timeoutId);
      isLoadingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []); // Aucune dépendance - utilise des refs pour éviter les boucles

  // === MISE À JOUR INCRÉMENTALE (plus rapide que rechargement complet) ===
  const handleInscriptionChange = useCallback(async (payload) => {
    // Protection: ne pas exécuter si l'utilisateur n'est pas connecté
    if (!user || !isMountedRef.current) {
      console.log('DataContext: Changement inscription ignoré (pas de user ou unmounted)');
      return;
    }

    console.log('DataContext: Changement inscription:', payload.eventType);

    if (payload.eventType === 'INSERT') {
      // Charger la nouvelle inscription avec ses relations
      const { data, error } = await supabase
        .from('inscriptions')
        .select(`*, chef_quartier:chefs_quartier(id, nom_complet, zone), dortoir:dortoirs(id, nom)`)
        .eq('id', payload.new.id)
        .single();

      if (!error && data && isMountedRef.current) {
        setInscriptions(prev => [data, ...prev]);
        setLastUpdate(new Date());
      }
    } else if (payload.eventType === 'UPDATE') {
      const { data, error } = await supabase
        .from('inscriptions')
        .select(`*, chef_quartier:chefs_quartier(id, nom_complet, zone), dortoir:dortoirs(id, nom)`)
        .eq('id', payload.new.id)
        .single();

      if (!error && data && isMountedRef.current) {
        setInscriptions(prev => prev.map(i => i.id === data.id ? data : i));
        setLastUpdate(new Date());
      }
    } else if (payload.eventType === 'DELETE') {
      if (isMountedRef.current) {
        setInscriptions(prev => prev.filter(i => i.id !== payload.old.id));
        setLastUpdate(new Date());
      }
    }
  }, [user]);

  const handlePaiementChange = useCallback(async (payload) => {
    // Protection: ne pas exécuter si l'utilisateur n'est pas connecté
    if (!user || !isMountedRef.current) {
      console.log('DataContext: Changement paiement ignoré (pas de user ou unmounted)');
      return;
    }

    console.log('DataContext: Changement paiement:', payload.eventType);

    if (payload.eventType === 'INSERT') {
      const { data, error } = await supabase
        .from('paiements')
        .select(`*, inscription:inscriptions(id, nom, prenom, type_inscription)`)
        .eq('id', payload.new.id)
        .single();

      if (!error && data && isMountedRef.current) {
        setPaiements(prev => [data, ...prev]);
        // Recharger aussi l'inscription associée pour avoir le montant_total_paye à jour
        if (payload.new.inscription_id) {
          const { data: inscData } = await supabase
            .from('inscriptions')
            .select(`*, chef_quartier:chefs_quartier(id, nom_complet, zone), dortoir:dortoirs(id, nom)`)
            .eq('id', payload.new.inscription_id)
            .single();
          if (inscData) {
            setInscriptions(prev => prev.map(i => i.id === inscData.id ? inscData : i));
          }
        }
        setLastUpdate(new Date());
      }
    } else if (payload.eventType === 'UPDATE') {
      const { data, error } = await supabase
        .from('paiements')
        .select(`*, inscription:inscriptions(id, nom, prenom, type_inscription)`)
        .eq('id', payload.new.id)
        .single();

      if (!error && data && isMountedRef.current) {
        setPaiements(prev => prev.map(p => p.id === data.id ? data : p));
        // Recharger l'inscription associée
        if (payload.new.inscription_id) {
          const { data: inscData } = await supabase
            .from('inscriptions')
            .select(`*, chef_quartier:chefs_quartier(id, nom_complet, zone), dortoir:dortoirs(id, nom)`)
            .eq('id', payload.new.inscription_id)
            .single();
          if (inscData) {
            setInscriptions(prev => prev.map(i => i.id === inscData.id ? inscData : i));
          }
        }
        setLastUpdate(new Date());
      }
    } else if (payload.eventType === 'DELETE') {
      if (isMountedRef.current) {
        setPaiements(prev => prev.filter(p => p.id !== payload.old.id));
        setLastUpdate(new Date());
      }
    }
  }, [user]);

  // === HANDLER POUR NOTES EXAMENS (Cellule Scientifique) ===
  const handleNotesChange = useCallback(async (payload) => {
    // Protection: ne pas exécuter si l'utilisateur n'est pas connecté
    if (!user || !isMountedRef.current) {
      console.log('DataContext: Changement notes ignoré (pas de user ou unmounted)');
      return;
    }

    console.log('DataContext: Changement notes_examens:', payload.eventType);

    if (payload.eventType === 'INSERT') {
      const { data, error } = await supabase
        .from('notes_examens')
        .select(`
          *,
          inscription:inscriptions(id, nom, prenom, photo_url, sexe, age, dortoir_id),
          classe:classes(id, nom, niveau, numero)
        `)
        .eq('id', payload.new.id)
        .single();

      if (!error && data && isMountedRef.current) {
        setNotesExamens(prev => [data, ...prev]);
        setLastUpdate(new Date());
      }
    } else if (payload.eventType === 'UPDATE') {
      const { data, error } = await supabase
        .from('notes_examens')
        .select(`
          *,
          inscription:inscriptions(id, nom, prenom, photo_url, sexe, age, dortoir_id),
          classe:classes(id, nom, niveau, numero)
        `)
        .eq('id', payload.new.id)
        .single();

      if (!error && data && isMountedRef.current) {
        setNotesExamens(prev => prev.map(n => n.id === data.id ? data : n));
        setLastUpdate(new Date());
      }
    } else if (payload.eventType === 'DELETE') {
      if (isMountedRef.current) {
        setNotesExamens(prev => prev.filter(n => n.id !== payload.old.id));
        setLastUpdate(new Date());
      }
    }
  }, [user]);

  // === HANDLER POUR CLASSES ===
  const handleClassesChange = useCallback(async (payload) => {
    // Protection: ne pas exécuter si l'utilisateur n'est pas connecté
    if (!user || !isMountedRef.current) {
      console.log('DataContext: Changement classes ignoré (pas de user ou unmounted)');
      return;
    }

    console.log('DataContext: Changement classes:', payload.eventType);

    if (payload.eventType === 'INSERT') {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', payload.new.id)
        .single();

      if (!error && data && isMountedRef.current) {
        setClasses(prev => [...prev, data].sort((a, b) => {
          if (a.niveau !== b.niveau) return a.niveau.localeCompare(b.niveau);
          return a.numero - b.numero;
        }));
        setLastUpdate(new Date());
      }
    } else if (payload.eventType === 'UPDATE') {
      if (isMountedRef.current) {
        setClasses(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
        setLastUpdate(new Date());
      }
    } else if (payload.eventType === 'DELETE') {
      if (isMountedRef.current) {
        setClasses(prev => prev.filter(c => c.id !== payload.old.id));
        setLastUpdate(new Date());
      }
    }
  }, [user]);

  // === EFFET PRINCIPAL: Charger les données et s'abonner aux changements ===
  useEffect(() => {
    isMountedRef.current = true;

    // Ne charger que si l'utilisateur est connecté
    if (!user) {
      console.log('DataContext: Utilisateur déconnecté, nettoyage...');

      // IMPORTANT: Supprimer la subscription Realtime AVANT de réinitialiser les données
      if (channelRef.current) {
        console.log('DataContext: Suppression subscription Realtime (déconnexion)');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Réinitialiser toutes les données
      setInscriptions([]);
      setChefsQuartier([]);
      setDortoirs([]);
      setPaiements([]);
      setNotesExamens([]);
      setClasses([]);
      setConfigCapaciteClasses([]);
      setInitialLoaded(false);
      initialLoadedRef.current = false; // Réinitialiser la ref aussi
      setLoading(false);
      setError(null);
      isLoadingRef.current = false;
      return;
    }

    // Charger les données initiales
    loadAllData();

    // S'abonner aux changements Realtime (UNE SEULE subscription pour toute l'app)
    if (!channelRef.current) {
      console.log('DataContext: Création subscription Realtime...');
      channelRef.current = supabase
        .channel('data-context-global')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inscriptions' },
          handleInscriptionChange
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'paiements' },
          handlePaiementChange
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notes_examens' },
          handleNotesChange
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'classes' },
          handleClassesChange
        )
        .subscribe((status) => {
          console.log('DataContext: Subscription status:', status);
        });
    }

    // Cleanup quand l'effet se re-exécute (changement de user)
    return () => {
      isMountedRef.current = false;
    };
  }, [user, loadAllData, handleInscriptionChange, handlePaiementChange, handleNotesChange, handleClassesChange]);

  // === CLEANUP FINAL: Supprimer la subscription au démontage du composant ===
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        console.log('DataContext: Suppression subscription Realtime (unmount)');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // === STATISTIQUES CALCULÉES (dérivées des données en cache) ===
  const stats = {
    // Inscriptions
    totalInscriptions: inscriptions.length,
    inscriptionsValidees: inscriptions.filter(i => i.statut === 'valide').length,
    inscriptionsEnAttente: inscriptions.filter(i => i.statut === 'en_attente').length,
    inscriptionsRejetees: inscriptions.filter(i => i.statut === 'rejete').length,
    
    // Paiements
    totalCollecte: inscriptions.reduce((acc, i) => acc + (i.montant_total_paye || 0), 0),
    paiementsEnAttente: inscriptions.filter(i => i.statut_paiement === 'partiel' && (i.montant_total_paye || 0) < (i.montant_requis || 4000)).length,
    paiementsPartiels: inscriptions.filter(i => i.statut_paiement === 'partiel').length,
    paiementsComplets: inscriptions.filter(i => i.statut_paiement === 'soldé' || i.statut_paiement === 'valide_financier').length,
    paiementsValides: paiements.filter(p => p.statut === 'validé').length,
    paiementsNonValides: paiements.filter(p => p.statut === 'attente' || p.statut === 'en_attente').length,
    
    // Démographiques
    hommes: inscriptions.filter(i => i.sexe === 'homme').length,
    femmes: inscriptions.filter(i => i.sexe === 'femme').length,
    
    // Par type
    inscriptionsEnLigne: inscriptions.filter(i => i.type_inscription === 'en_ligne').length,
    inscriptionsPresentielle: inscriptions.filter(i => i.type_inscription === 'presentielle').length,
  };

  // === FONCTIONS EXPOSÉES ===
  const refresh = useCallback(() => {
    initialLoadedRef.current = false; // Réinitialiser la ref
    setInitialLoaded(false); // Force le rechargement
    return loadAllData(true);
  }, [loadAllData]);

  // Ajout local d'une inscription (optimistic update)
  const addInscriptionLocal = useCallback((inscription) => {
    setInscriptions(prev => [inscription, ...prev]);
    setLastUpdate(new Date());
  }, []);

  // Mise à jour locale d'une inscription (optimistic update)
  const updateInscriptionLocal = useCallback((id, updates) => {
    setInscriptions(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    setLastUpdate(new Date());
  }, []);

  // Suppression locale d'une inscription (optimistic update)
  const deleteInscriptionLocal = useCallback((id) => {
    setInscriptions(prev => prev.filter(i => i.id !== id));
    setLastUpdate(new Date());
  }, []);

  // Mise à jour locale d'une note (optimistic update)
  const updateNoteLocal = useCallback((id, updates) => {
    setNotesExamens(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  }, []);

  // Ajout local d'une note (optimistic update)
  const addNoteLocal = useCallback((note) => {
    setNotesExamens(prev => [note, ...prev]);
  }, []);

  // Ajout local d'une classe (optimistic update)
  const addClasseLocal = useCallback((classe) => {
    setClasses(prev => [...prev, classe].sort((a, b) => {
      if (a.niveau !== b.niveau) return a.niveau.localeCompare(b.niveau);
      return a.numero - b.numero;
    }));
  }, []);

  // === STATISTIQUES CELLULE SCIENTIFIQUE ===
  const statsScientifique = {
    totalParticipantsValides: inscriptions.filter(i => i.statut === 'valide').length,
    participantsAvecNoteEntree: notesExamens.filter(n => n.note_entree != null).length,
    participantsSansNoteEntree: inscriptions.filter(i => i.statut === 'valide').length - notesExamens.filter(n => n.note_entree != null).length,
    parNiveau: {
      niveau_1: notesExamens.filter(n => n.niveau_attribue === 'niveau_1').length,
      niveau_2: notesExamens.filter(n => n.niveau_attribue === 'niveau_2').length,
      niveau_3: notesExamens.filter(n => n.niveau_attribue === 'niveau_3').length,
      niveau_superieur: notesExamens.filter(n => n.niveau_attribue === 'niveau_superieur').length,
    },
    participantsAvecMoyenne: notesExamens.filter(n => n.moyenne != null).length,
    totalClasses: classes.length,
  };

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
    initialLoaded,
    error,
    lastUpdate,

    // Actions
    refresh,
    addInscriptionLocal,
    updateInscriptionLocal,
    deleteInscriptionLocal,

    // Actions Cellule Scientifique
    updateNoteLocal,
    addNoteLocal,
    addClasseLocal,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
