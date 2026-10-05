-- ============================================
-- MIGRATION: Caisse finance (dehors/dedans) + traçabilité + realtime
-- Date: 2026-10-02
-- Description:
--   - Versements : réception par versement ('attente' -> 'validé' | 'refuse'
--     avec motif), date/acteur de réception, acteur de création.
--   - Dossiers : montant_valide (somme des versements cochés, maintenu par
--     trigger) = argent DEDANS ; auto-transition au secrétariat quand le
--     validé couvre le requis (scénario 1).
--   - Reprise : les versements des dossiers président non approuvés repassent
--     'attente' (file caisse réelle), le reste est considéré reçu.
--   - add_payment : nouveau statut initial 'attente' (dehors) par défaut,
--     'validé' explicite pour le guichet (dedans direct), acteur tracé.
--   - Vue dashboard : total_validated = somme de montant_valide.
--   - Publication realtime pour les tables caisse (notif temps réel).
-- ============================================

-- 1. Colonnes réception / traçabilité / validé.
ALTER TABLE paiements
ADD COLUMN IF NOT EXISTS date_reception TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS motif_refus TEXT,
ADD COLUMN IF NOT EXISTS cree_par UUID;

ALTER TABLE inscriptions
ADD COLUMN IF NOT EXISTS montant_valide INTEGER DEFAULT 0;

UPDATE inscriptions SET montant_valide = 0 WHERE montant_valide IS NULL;

-- 2. Statut versement : 'refuse' rejoint 'validé'/'attente'.
ALTER TABLE paiements DROP CONSTRAINT IF EXISTS paiements_statut_check;
ALTER TABLE paiements ADD CONSTRAINT paiements_statut_check
    CHECK (statut IN ('validé', 'attente', 'refuse'));

-- 3. Trigger : maintient montant_valide + auto-transition sur le VALIDÉ.
-- (Même worker sync_inscription_montant(UUID) qu'en 20261001, étendu : les
-- wrappers et le trigger branché dessus sont inchangés.)
CREATE OR REPLACE FUNCTION public.sync_inscription_montant(p_inscription_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_total_paye     INTEGER;
    v_total_valide   INTEGER;
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

    -- Validé (dedans) : versements cochés reçus uniquement.
    SELECT COALESCE(SUM(montant), 0) INTO v_total_valide
    FROM paiements
    WHERE inscription_id = p_inscription_id
      AND statut = 'validé';

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
    -- L'argent doit être arrivé ET coché (validé couvre le requis).
    v_new_workflow := v_workflow;
    IF v_created_by = 'president'
       AND v_workflow = 'pending_finance'
       AND v_total_valide >= v_requis THEN
        v_new_workflow := 'pending_secretariat';
    END IF;

    UPDATE inscriptions
    SET montant_total_paye = v_total_paye,
        montant_valide = v_total_valide,
        montant_non_du = v_new_non_du,
        statut_paiement = v_new_statut,
        workflow_status = v_new_workflow,
        updated_at = NOW()
    WHERE id = p_inscription_id;
END;
$function$;

-- 4a. Reprise historique : les versements des dossiers président NON approuvés
-- (pending_finance/rejected) n'ont jamais été réceptionnés en caisse : ils
-- rouvrent la file d'attente (dehors). Le reste (guichet + dossiers approuvés)
-- est considéré reçu (dedans). Le trigger resync montant_valide au passage.
UPDATE paiements p
SET statut = 'attente'
FROM inscriptions i
WHERE p.inscription_id = i.id
  AND p.statut = 'validé'
  AND i.created_by = 'president'
  AND NOT (i.statut_paiement = 'valide_financier'
           OR i.workflow_status IN ('pending_secretariat', 'completed'));

-- 4b. Reprise : montant_valide = versements cochés.
UPDATE inscriptions i
SET montant_valide = COALESCE((
    SELECT SUM(p.montant) FROM paiements p
    WHERE p.inscription_id = i.id AND p.statut = 'validé'
), 0);

-- 5. add_payment : statut initial + acteur. DROP obligatoire (changement de
-- signature : OR REPLACE créerait une surcharge et l'ancien resterait actif).
DROP FUNCTION IF EXISTS public.add_payment(uuid, integer, text, text);

CREATE FUNCTION public.add_payment(
    p_inscription_id uuid,
    p_montant integer,
    p_mode_paiement text DEFAULT 'especes'::text,
    p_type_paiement text DEFAULT 'inscription'::text,
    p_statut text DEFAULT 'attente'::text,
    p_acteur uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_current_total INTEGER;
    v_new_total INTEGER;
    v_new_status TEXT;
    v_payment_id UUID;
    v_montant_requis INTEGER;
BEGIN
    IF p_inscription_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Inscription non trouvée');
    END IF;

    SELECT montant_total_paye, montant_requis
    INTO v_current_total, v_montant_requis
    FROM inscriptions
    WHERE id = p_inscription_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Inscription non trouvée');
    END IF;

    IF p_montant IS NULL OR p_montant <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Le montant doit être supérieur à 0');
    END IF;

    IF p_statut NOT IN ('attente', 'validé') THEN
        RETURN json_build_object('success', false, 'error', 'Statut initial invalide (attente ou validé)');
    END IF;

    -- Plafond = requis - déclaré (le non-dû reste encaissable, voir front).
    v_montant_requis := COALESCE(v_montant_requis, 4000);
    v_current_total := COALESCE(v_current_total, 0);

    IF v_current_total + p_montant > v_montant_requis THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Le montant dépasse le reste à payer (' || (v_montant_requis - v_current_total) || ' FCFA)'
        );
    END IF;

    v_new_total := v_current_total + p_montant;

    IF v_new_total >= v_montant_requis THEN
        v_new_status := 'soldé';
    ELSIF v_new_total > 0 THEN
        v_new_status := 'partiel';
    ELSE
        v_new_status := 'non_payé';
    END IF;

    -- Président : 'attente' (dehors, notifié). Guichet/staff : 'validé' (dedans direct).
    INSERT INTO paiements (inscription_id, montant, mode_paiement, statut, type_paiement, cree_par)
    VALUES (p_inscription_id, p_montant, p_mode_paiement, p_statut, p_type_paiement, p_acteur)
    RETURNING id INTO v_payment_id;

    -- Note: Le trigger met à jour automatiquement l'inscription.

    RETURN json_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'new_total', v_new_total,
        'new_status', v_new_status,
        'message', 'Paiement enregistré avec succès'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.add_payment(uuid, integer, text, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.add_payment(uuid, integer, text, text, text, uuid) TO authenticated;

-- 6. Vue dashboard : validé = somme de montant_valide (mêmes colonnes).
CREATE OR REPLACE VIEW v_global_dashboard_stats AS
SELECT
    COUNT(id) AS total_inscriptions,
    COUNT(CASE WHEN statut_paiement IN ('soldé', 'valide_financier') THEN 1 END) AS fully_paid,
    COUNT(CASE WHEN statut_paiement = 'partiel' THEN 1 END) AS partially_paid,
    COUNT(CASE WHEN statut_paiement = 'non_payé' OR statut_paiement IS NULL THEN 1 END) AS unpaid,
    COALESCE(SUM(montant_total_paye), 0) AS total_collected,
    COALESCE(SUM(GREATEST(0, COALESCE(montant_requis, 4000) - COALESCE(montant_total_paye, 0) - COALESCE(montant_non_du, 0))), 0) AS total_remaining,
    COUNT(CASE WHEN workflow_status = 'pending_finance' THEN 1 END) AS pending_finance,
    COUNT(CASE WHEN workflow_status = 'pending_secretariat' THEN 1 END) AS pending_secretariat,
    COUNT(CASE WHEN workflow_status = 'completed' THEN 1 END) AS completed,
    COUNT(CASE WHEN sexe = 'homme' THEN 1 END) AS male_count,
    COUNT(CASE WHEN sexe = 'femme' THEN 1 END) AS female_count,
    COUNT(CASE WHEN age >= 5 AND age < 10 THEN 1 END) AS age_5_9,
    COUNT(CASE WHEN age >= 10 AND age < 15 THEN 1 END) AS age_10_14,
    COUNT(CASE WHEN age >= 15 AND age < 18 THEN 1 END) AS age_15_17,
    COUNT(CASE WHEN age >= 18 AND age <= 25 THEN 1 END) AS age_18_25,
    COUNT(CASE WHEN age > 25 AND age <= 35 THEN 1 END) AS age_26_35,
    COALESCE(SUM(COALESCE(montant_requis, 4000)), 0) AS total_required,
    COALESCE(SUM(COALESCE(montant_valide, 0)), 0) AS total_validated
FROM inscriptions;

-- 7. Realtime : notif instantanée des versements (tolérant si hors Supabase).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        RAISE NOTICE 'publication supabase_realtime absente : realtime non configuré (tests locaux)';
        RETURN;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'paiements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.paiements;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inscriptions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inscriptions;
    END IF;
END $$;
