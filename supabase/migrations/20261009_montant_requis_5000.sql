-- 20261009 : prix de participation 4000 -> 5000 FCFA, partout.
-- 1. Défaut + lignes existantes (le front lit montant_requis en priorité,
--    le COALESCE(..., 4000) des fonctions/vues n'est qu'un filet).
-- 2. Statuts resynchronisés : un dossier soldé à 4000 redevient partiel
--    (reste 1000) ; les lignes déjà validées finance (valide_financier) ou
--    refusées sont préservées.
-- 3. Fallbacks 4000 -> 5000 dans add_payment / sync_inscription_montant.
-- 4. calculate_collection_rate : taux sur SUM(montant_requis) au lieu de
--    nb * 4000 dur.

ALTER TABLE public.inscriptions ALTER COLUMN montant_requis SET DEFAULT 5000;

UPDATE public.inscriptions SET montant_requis = 5000;

UPDATE public.inscriptions
SET statut_paiement = 'partiel', updated_at = NOW()
WHERE statut_paiement = 'soldé'
  AND COALESCE(montant_total_paye, 0) < 5000;

CREATE OR REPLACE FUNCTION public.add_payment(p_inscription_id uuid, p_montant integer, p_mode_paiement text DEFAULT 'especes'::text, p_type_paiement text DEFAULT 'inscription'::text, p_statut text DEFAULT 'attente'::text, p_acteur uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    v_montant_requis := COALESCE(v_montant_requis, 5000);
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

    -- Président : 'attente' (dehors, notifié). Guichet/staff : 'validé' (dedans
    -- direct) AVEC réception horodatée et acteur (= traçabilité scénario 4).
    INSERT INTO paiements (inscription_id, montant, mode_paiement, statut, type_paiement, cree_par, date_reception, recu_par)
    VALUES (
        p_inscription_id, p_montant, p_mode_paiement, p_statut, p_type_paiement, p_acteur,
        CASE WHEN p_statut = 'validé' THEN now() ELSE NULL END,
        CASE WHEN p_statut = 'validé' THEN p_acteur ELSE NULL END
    )
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

CREATE OR REPLACE FUNCTION public.sync_inscription_montant(p_inscription_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
           COALESCE(montant_requis, 5000), COALESCE(montant_non_du, 0)
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

CREATE OR REPLACE FUNCTION public.calculate_collection_rate(p_president_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_collected INTEGER;
    v_total_requis INTEGER;
    v_rate INTEGER;
BEGIN
    SELECT
        COALESCE(SUM(montant_total_paye), 0),
        COALESCE(SUM(COALESCE(montant_requis, 5000)), 0)
    INTO v_total_collected, v_total_requis
    FROM inscriptions
    WHERE chef_quartier_id = p_president_id;

    IF v_total_requis > 0 THEN
        v_rate := (v_total_collected * 100) / v_total_requis;
    ELSE
        v_rate := 0;
    END IF;

    RETURN v_rate;
END;
$function$;
