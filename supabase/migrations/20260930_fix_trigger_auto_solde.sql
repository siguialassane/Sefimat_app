-- ============================================
-- MIGRATION: Réparer l'auto-transition du trigger actif + reprise paiements
-- Date: 2026-09-30
-- Contexte: en BD réelle, le trigger attaché à la table paiements est
--   trigger_update_inscription_after_payment -> update_inscription_after_payment(),
--   qui recalculait les totaux mais SANS l'auto-transition "soldé ->
--   pending_secretariat" (la fonction update_inscription_montant_total du repo
--   existe en BD mais n'est attachée à aucun trigger).
-- Cette migration aligne la fonction ATTACHÉE sur le comportement attendu.
-- ============================================

-- 1. Auto-transition dans la fonction réellement attachée
CREATE OR REPLACE FUNCTION public.update_inscription_after_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
    v_total_paye INTEGER;
    v_inscription_id UUID;
    v_created_by TEXT;
    v_current_workflow TEXT;
    v_montant_requis INTEGER;
BEGIN
    v_inscription_id := COALESCE(NEW.inscription_id, OLD.inscription_id);

    SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
    FROM paiements
    WHERE inscription_id = v_inscription_id
    AND statut IN ('validé', 'attente');

    SELECT created_by, workflow_status, COALESCE(montant_requis, 4000)
    INTO v_created_by, v_current_workflow, v_montant_requis
    FROM inscriptions WHERE id = v_inscription_id;

    UPDATE inscriptions
    SET
        montant_total_paye = v_total_paye,
        statut_paiement = CASE
            WHEN v_total_paye >= v_montant_requis THEN 'soldé'
            WHEN v_total_paye > 0 THEN 'partiel'
            ELSE 'non_payé'
        END,
        -- AUTO-TRANSITION: dossier président soldé en attente finance -> secrétariat
        workflow_status = CASE
            WHEN v_created_by = 'president'
                 AND v_current_workflow = 'pending_finance'
                 AND v_total_paye >= v_montant_requis
            THEN 'pending_secretariat'
            ELSE workflow_status
        END,
        updated_at = NOW()
    WHERE id = v_inscription_id;

    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. Reprise : créer les lignes paiements manquantes pour les inscriptions
--    ayant un total payé mais aucun historique (sinon le trigger recalculerait
--    un total faux au prochain complément)
INSERT INTO paiements (inscription_id, montant, mode_paiement, statut, type_paiement, date_paiement)
SELECT i.id, i.montant_total_paye, COALESCE(i.mode_paiement, 'especes'), 'validé', 'inscription', i.created_at
FROM inscriptions i
WHERE COALESCE(i.montant_total_paye, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM paiements p WHERE p.inscription_id = i.id);
