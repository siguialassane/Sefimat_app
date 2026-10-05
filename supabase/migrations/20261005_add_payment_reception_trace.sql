-- 20261005_add_payment_reception_trace.sql
-- Guichet direct (scénario 4) : un versement créé 'validé' (staff finance /
-- secrétariat, argent en main) doit porter sa réception, sinon la traçabilité
-- est trouée (Reçu sans date ni acteur dans les Versements).
-- Idempotent : CREATE OR REPLACE, même signature que 20261003.
CREATE OR REPLACE FUNCTION public.add_payment(
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
