-- ============================================
-- MIGRATION: Unifier les triggers de montants + CHECK legacy statut_workflow
-- Date: 2026-10-01
-- Contexte (inspecté dans le repo) :
--   - Deux fonctions recalculaient montant_total_paye de façon divergente :
--     update_inscription_montant_total() (repo, trigger_update_inscription_montant)
--     somme TOUS les paiements, seuil 4000 dur, RETURN NEW (casse DELETE),
--     sans montant_requis ni montant_non_du ;
--     update_inscription_after_payment() (prod, trigger_update_inscription_after_payment)
--     somme statut IN ('validé','attente') avec montant_requis, mais écrase
--     statut_paiement ('valide_financier'/'refuse') et ignore montant_non_du.
--     Le front compense par un double UPDATE manuel après la RPC add_payment
--     (AddPaymentDialog.jsx, PresidentPayments.jsx) : course trigger/front.
--   - montant_non_du (20260930_montant_non_du) n'était maintenu par aucun
--     trigger : après validation partielle (3000/4000 => 1000 non dus), un
--     complément laissait un reliquat périmé (reste = requis-payé-non_du).
--   - statut_workflow (colonne legacy hors-président : en_attente_finance,
--     en_attente_secretariat, valide, rejete) n'a AUCUNE définition/CHECK
--     dans les migrations : contrainte prod non inspectée, jamais alignée.
--     Idem : paiements.statut/type_paiement/valide_par et
--     inscriptions.mode_paiement, écrits par le front mais jamais migrés.
-- Cette migration résout ces trois manques en une seule fois.
-- ============================================

-- ------------------------------------------------
-- 0. Colonnes legacy/hors-migrations (idempotent)
-- ------------------------------------------------
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS statut_workflow TEXT;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS mode_paiement TEXT DEFAULT 'especes';
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS montant_total_paye INTEGER DEFAULT 0;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS montant_requis INTEGER DEFAULT 4000;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS montant_non_du INTEGER DEFAULT 0;

ALTER TABLE paiements ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'validé';
ALTER TABLE paiements ADD COLUMN IF NOT EXISTS type_paiement TEXT DEFAULT 'inscription';
ALTER TABLE paiements ADD COLUMN IF NOT EXISTS valide_par UUID;

-- Backfill sans risque CHECK (colonnes INTEGER/TEXT libre).
-- Les backfills/normalisations touchant des colonnes sous CHECK historique
-- (paiements.statut, inscriptions.statut_paiement/statut_workflow/mode_paiement)
-- sont placés APRÈS la dépose des anciens CHECK (voir 1a/1b/1c/1d) : les
-- normaliser avant échouerait contre l'ancien ensemble autorisé.
UPDATE paiements SET type_paiement = 'inscription' WHERE type_paiement IS NULL;
UPDATE inscriptions SET montant_total_paye = 0 WHERE montant_total_paye IS NULL;
UPDATE inscriptions SET montant_requis = 4000 WHERE montant_requis IS NULL;
UPDATE inscriptions SET montant_non_du = 0 WHERE montant_non_du IS NULL;

-- ------------------------------------------------
-- 1. CHECK alignés sur les valeurs réellement écrites/lues
--    (chaque étape : dépose ancien CHECK -> normalisation -> pose conditionnelle)
-- ------------------------------------------------
-- 1a. inscriptions.statut_paiement : valeurs écrites par le front et les
--     triggers (PaymentValidation, InPersonRegistration, PresidentRegistration,
--     AddPaymentDialog, PaymentList) + 'en_attente_validation' lu par
--     finance.js + synonymes legacy conservés pour ne jamais casser l'existant.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'inscriptions'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%statut_paiement%'
    LOOP
        EXECUTE format('ALTER TABLE inscriptions DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;
-- Normaliser le vocabulaire 20260106 ('non_paye','complet') vers le front
-- ('non_payé','soldé') une fois l'ancien CHECK déposé.
UPDATE inscriptions SET statut_paiement = 'non_payé' WHERE statut_paiement = 'non_paye';
UPDATE inscriptions SET statut_paiement = 'soldé' WHERE statut_paiement = 'complet';
-- Pose conditionnelle (même principe : signaler, ne jamais casser le déploiement).
DO $$
DECLARE n_violations INTEGER;
BEGIN
    SELECT COUNT(*) INTO n_violations FROM inscriptions
    WHERE statut_paiement IS NOT NULL
      AND statut_paiement NOT IN (
        'non_payé', 'non_paye', 'partiel', 'soldé', 'complet',
        'valide_financier', 'refuse', 'en_attente_validation');
    IF n_violations = 0 THEN
        ALTER TABLE inscriptions ADD CONSTRAINT inscriptions_statut_paiement_check
            CHECK (statut_paiement IN (
                'non_payé', 'non_paye', 'partiel', 'soldé', 'complet',
                'valide_financier', 'refuse', 'en_attente_validation'
            ));
    ELSE
        RAISE NOTICE 'CHECK inscriptions_statut_paiement_check non posé : % ligne(s) hors ensemble, valeurs distinctes : %',
            n_violations,
            (SELECT string_agg(DISTINCT statut_paiement, ', ') FROM inscriptions
             WHERE statut_paiement IS NOT NULL
               AND statut_paiement NOT IN (
                 'non_payé', 'non_paye', 'partiel', 'soldé', 'complet',
                 'valide_financier', 'refuse', 'en_attente_validation'));
    END IF;
END $$;

-- 1b. inscriptions.statut_workflow (legacy NON-président, inspecté ici) :
--     valeurs observées dans PaymentValidation.jsx, InPersonRegistration.jsx,
--     RegistrationManagement.jsx, test-finance-rules.js. NULL autorisé
--     (dossiers président qui utilisent workflow_status).
--     En prod cette colonne peut être un ENUM (statut_workflow_enum) au lieu
--     de TEXT : le type porte alors déjà la contrainte, on vérifie juste son
--     vocabulaire et on saute la normalisation TEXT (qui échouerait).
DO $$
DECLARE
    r RECORD;
    v_is_enum BOOLEAN;
    v_bad_labels TEXT;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'inscriptions'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%statut_workflow%'
    LOOP
        EXECUTE format('ALTER TABLE inscriptions DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    SELECT (t.typtype = 'e') INTO v_is_enum
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE c.relname = 'inscriptions' AND a.attname = 'statut_workflow';

    IF COALESCE(v_is_enum, FALSE) THEN
        SELECT string_agg(e.enumlabel, ', ') INTO v_bad_labels
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_attribute a ON a.atttypid = t.oid
        JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relname = 'inscriptions' AND a.attname = 'statut_workflow'
          AND e.enumlabel NOT IN (
            'en_attente_finance', 'en_attente_secretariat', 'valide', 'rejete');
        IF v_bad_labels IS NULL THEN
            RAISE NOTICE 'statut_workflow est un ENUM déjà aligné : rien à faire.';
        ELSE
            RAISE NOTICE 'statut_workflow ENUM avec valeur(s) hors vocabulaire (conservées) : %', v_bad_labels;
        END IF;
        RETURN;
    END IF;

    -- Colonne TEXT : synonymes legacy plausibles -> vocabulaire canonique front.
    UPDATE inscriptions SET statut_workflow = 'en_attente_finance'
    WHERE statut_workflow IN ('en_attente', 'attente_finance', 'pending_finance');
    UPDATE inscriptions SET statut_workflow = 'en_attente_secretariat'
    WHERE statut_workflow IN ('attente_secretariat', 'pending_secretariat');
    UPDATE inscriptions SET statut_workflow = 'valide'
    WHERE statut_workflow IN ('validé', 'valide_financier', 'completed');
    UPDATE inscriptions SET statut_workflow = 'rejete'
    WHERE statut_workflow IN ('refusé', 'refuse', 'rejected', 'rejeté');
END $$;
-- Pose conditionnelle (TEXT uniquement) : ne jamais faire échouer la migration
-- sur un résidu legacy inconnu, mais le signaler explicitement (NOTICE).
DO $$
DECLARE
    n_violations INTEGER;
    v_is_enum BOOLEAN;
BEGIN
    SELECT (t.typtype = 'e') INTO v_is_enum
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE c.relname = 'inscriptions' AND a.attname = 'statut_workflow';
    IF COALESCE(v_is_enum, FALSE) THEN
        RETURN;
    END IF;
    SELECT COUNT(*) INTO n_violations FROM inscriptions
    WHERE statut_workflow IS NOT NULL
      AND statut_workflow NOT IN (
        'en_attente_finance', 'en_attente_secretariat', 'valide', 'rejete');
    IF n_violations = 0 THEN
        ALTER TABLE inscriptions ADD CONSTRAINT inscriptions_statut_workflow_check
            CHECK (statut_workflow IN (
                'en_attente_finance', 'en_attente_secretariat', 'valide', 'rejete'
            ));
    ELSE
        RAISE NOTICE 'CHECK inscriptions_statut_workflow_check non posé : % ligne(s) hors ensemble, valeurs distinctes : %',
            n_violations,
            (SELECT string_agg(DISTINCT statut_workflow, ', ') FROM inscriptions
             WHERE statut_workflow IS NOT NULL
               AND statut_workflow NOT IN (
                 'en_attente_finance', 'en_attente_secretariat', 'valide', 'rejete'));
    END IF;
END $$;

-- 1c. inscriptions.mode_paiement : mêmes modes que paiements.
--     Colonne legacy possiblement pré-existante en prod : ne poser le CHECK
--     que si les données sont propres, sinon signaler le résidu (NOTICE).
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'inscriptions'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%mode_paiement%'
    LOOP
        EXECUTE format('ALTER TABLE inscriptions DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;
UPDATE inscriptions SET mode_paiement = 'especes' WHERE mode_paiement IS NULL;
DO $$
DECLARE n_violations INTEGER;
BEGIN
    SELECT COUNT(*) INTO n_violations FROM inscriptions
    WHERE mode_paiement IS NOT NULL
      AND mode_paiement NOT IN ('especes', 'mobile_money', 'virement');
    IF n_violations = 0 THEN
        ALTER TABLE inscriptions ADD CONSTRAINT inscriptions_mode_paiement_check
            CHECK (mode_paiement IN ('especes', 'mobile_money', 'virement'));
    ELSE
        RAISE NOTICE 'CHECK inscriptions_mode_paiement_check non posé : % ligne(s) hors ensemble, valeurs distinctes : %',
            n_violations,
            (SELECT string_agg(DISTINCT mode_paiement, ', ') FROM inscriptions
             WHERE mode_paiement IS NOT NULL
               AND mode_paiement NOT IN ('especes', 'mobile_money', 'virement'));
    END IF;
END $$;

-- 1d. paiements.statut : 'validé' (insert front : présentiel, président),
--     'attente' (filtre PresidentDetails + trigger 20260930). NULL toléré
--     pour les lignes historiques sans statut.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'paiements'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%statut%'
          AND pg_get_constraintdef(oid) NOT ILIKE '%mode_paiement%'
    LOOP
        EXECUTE format('ALTER TABLE paiements DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
END $$;
UPDATE paiements SET statut = 'validé' WHERE statut IS NULL;
DO $$
DECLARE n_violations INTEGER;
BEGIN
    SELECT COUNT(*) INTO n_violations FROM paiements
    WHERE statut IS NOT NULL AND statut NOT IN ('validé', 'attente');
    IF n_violations = 0 THEN
        ALTER TABLE paiements ADD CONSTRAINT paiements_statut_check
            CHECK (statut IS NULL OR statut IN ('validé', 'attente'));
    ELSE
        RAISE NOTICE 'CHECK paiements_statut_check non posé : % ligne(s) hors ensemble, valeurs distinctes : %',
            n_violations,
            (SELECT string_agg(DISTINCT statut, ', ') FROM paiements
             WHERE statut IS NOT NULL AND statut NOT IN ('validé', 'attente'));
    END IF;
END $$;

-- ------------------------------------------------
-- 2. Logique UNIQUE de resync des montants (une seule implémentation)
-- ------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_inscription_montant(p_inscription_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
    v_total_paye     INTEGER;
    v_created_by     TEXT;
    v_workflow       TEXT;
    v_statut         TEXT;
    v_requis         INTEGER;
    v_old_non_du     INTEGER;
    v_new_non_du     INTEGER;
    v_new_statut     TEXT;
    v_new_workflow   TEXT;
BEGIN
    IF p_inscription_id IS NULL THEN
        RETURN;
    END IF;

    SELECT created_by, workflow_status, statut_paiement,
           COALESCE(montant_requis, 4000), COALESCE(montant_non_du, 0)
    INTO v_created_by, v_workflow, v_statut, v_requis, v_old_non_du
    FROM inscriptions WHERE id = p_inscription_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Total : paiements comptables uniquement. Les lignes historiques sans
    -- statut (NULL) restent comptées (tolérance legacy).
    SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
    FROM paiements
    WHERE inscription_id = p_inscription_id
      AND (statut IS NULL OR statut IN ('validé', 'attente'));

    -- Reliquat non dû : gelé par la décision finance, il ne fait que FONDRE
    -- quand de l'argent arrive (jamais de regain si le total baisse).
    -- Formule identique au front (AddPaymentDialog / PresidentPayments).
    v_new_non_du := GREATEST(0, LEAST(v_old_non_du, v_requis - v_total_paye));

    -- Statut paiement : 'refuse' (décision finance) est préservé ; sinon
    -- recalcul factuel. 'valide_financier' est volontairement recalculé à
    -- l'arrivée d'argent (comme le fait déjà le front) : l'approbation
    -- survit via workflow_status (pending_secretariat/completed).
    IF v_statut = 'refuse' OR v_workflow = 'rejected' THEN
        v_new_statut := 'refuse';
    ELSIF v_total_paye >= v_requis THEN
        v_new_statut := 'soldé';
    ELSIF v_total_paye > 0 THEN
        v_new_statut := 'partiel';
    ELSE
        v_new_statut := 'non_payé';
    END IF;

    -- Workflow : auto-transition avant uniquement (jamais de régression).
    v_new_workflow := v_workflow;
    IF v_created_by = 'president'
       AND v_workflow = 'pending_finance'
       AND v_total_paye >= v_requis THEN
        v_new_workflow := 'pending_secretariat';
    END IF;

    UPDATE inscriptions
    SET montant_total_paye = v_total_paye,
        montant_non_du = v_new_non_du,
        statut_paiement = v_new_statut,
        workflow_status = v_new_workflow,
        updated_at = NOW()
    WHERE id = p_inscription_id;
END;
$function$;

-- Déclencheur unique (nouveau nom) + wrappers legacy : les trois noms
-- historiques partagent désormais la même implémentation, sans divergence.
CREATE OR REPLACE FUNCTION public.sync_inscription_montants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.inscription_id IS DISTINCT FROM OLD.inscription_id THEN
        PERFORM public.sync_inscription_montant(OLD.inscription_id);
        PERFORM public.sync_inscription_montant(NEW.inscription_id);
    ELSE
        PERFORM public.sync_inscription_montant(COALESCE(NEW.inscription_id, OLD.inscription_id));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_inscription_after_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.inscription_id IS DISTINCT FROM OLD.inscription_id THEN
        PERFORM public.sync_inscription_montant(OLD.inscription_id);
        PERFORM public.sync_inscription_montant(NEW.inscription_id);
    ELSE
        PERFORM public.sync_inscription_montant(COALESCE(NEW.inscription_id, OLD.inscription_id));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_inscription_montant_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.inscription_id IS DISTINCT FROM OLD.inscription_id THEN
        PERFORM public.sync_inscription_montant(OLD.inscription_id);
        PERFORM public.sync_inscription_montant(NEW.inscription_id);
    ELSE
        PERFORM public.sync_inscription_montant(COALESCE(NEW.inscription_id, OLD.inscription_id));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Un seul trigger branché (les deux noms divergents sont déposés).
DROP TRIGGER IF EXISTS trigger_update_inscription_montant ON paiements;
DROP TRIGGER IF EXISTS trigger_update_inscription_after_payment ON paiements;
DROP TRIGGER IF EXISTS trigger_sync_inscription_montants ON paiements;
CREATE TRIGGER trigger_sync_inscription_montants
AFTER INSERT OR UPDATE OR DELETE ON paiements
FOR EACH ROW
EXECUTE FUNCTION public.sync_inscription_montants();

-- ------------------------------------------------
-- 3. Reprise de données (idempotent, montants seuls : jamais de
--    régression statut/workflow ici)
-- ------------------------------------------------
-- 3a. Lignes paiements manquantes pour les totaux sans historique
--     (sinon le trigger recalculerait un total faux au prochain complément).
INSERT INTO paiements (inscription_id, montant, mode_paiement, statut, type_paiement, date_paiement)
SELECT i.id, i.montant_total_paye, COALESCE(i.mode_paiement, 'especes'),
       'validé', 'inscription', i.created_at
FROM inscriptions i
WHERE COALESCE(i.montant_total_paye, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM paiements p WHERE p.inscription_id = i.id);

-- 3b. Reliquats non dus jamais figés (validés finance/secrétariat partiels).
UPDATE inscriptions
SET montant_non_du = GREATEST(0, COALESCE(montant_requis, 4000) - COALESCE(montant_total_paye, 0)),
    updated_at = NOW()
WHERE created_by = 'president'
  AND workflow_status IN ('pending_secretariat', 'completed')
  AND COALESCE(montant_total_paye, 0) < COALESCE(montant_requis, 4000)
  AND COALESCE(montant_non_du, 0) = 0;

-- 3c. Reliquats périmés (complément arrivé sans sync front) : fondre.
UPDATE inscriptions
SET montant_non_du = GREATEST(0, COALESCE(montant_requis, 4000) - COALESCE(montant_total_paye, 0)),
    updated_at = NOW()
WHERE COALESCE(montant_non_du, 0) > 0
  AND COALESCE(montant_total_paye, 0) + COALESCE(montant_non_du, 0) > COALESCE(montant_requis, 4000);

-- 3d. Totaux dérivés (montants seuls, statut/workflow préservés).
WITH totals AS (
    SELECT inscription_id, COALESCE(SUM(montant), 0) AS total
    FROM paiements
    WHERE statut IS NULL OR statut IN ('validé', 'attente')
    GROUP BY inscription_id
)
UPDATE inscriptions i
SET montant_total_paye = t.total,
    montant_non_du = GREATEST(0, LEAST(COALESCE(i.montant_non_du, 0),
        COALESCE(i.montant_requis, 4000) - t.total)),
    updated_at = NOW()
FROM totals t
WHERE t.inscription_id = i.id
  AND COALESCE(i.montant_total_paye, 0) IS DISTINCT FROM t.total;

-- ------------------------------------------------
-- 4. Index complémentaires
-- ------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inscriptions_statut_workflow ON inscriptions(statut_workflow);
CREATE INDEX IF NOT EXISTS idx_inscriptions_montant_non_du ON inscriptions(montant_non_du);
CREATE INDEX IF NOT EXISTS idx_paiements_statut ON paiements(statut);
