-- Migration: fix_workflow_auto_solde
-- Date: 2026-01-20
-- Description: Corrige le workflow pour les paiements soldés des présidents
--              Les inscriptions avec paiement >= 4000 passent directement au secrétariat

-- 1. Modifier le trigger pour auto-transition du workflow quand paiement soldé
CREATE OR REPLACE FUNCTION update_inscription_montant_total()
RETURNS TRIGGER AS $$
DECLARE
    v_montant_total INTEGER;
    v_created_by TEXT;
    v_current_workflow TEXT;
BEGIN
    -- Calculer le nouveau montant total
    SELECT COALESCE(SUM(montant), 0) INTO v_montant_total
    FROM paiements
    WHERE inscription_id = COALESCE(NEW.inscription_id, OLD.inscription_id);

    -- Récupérer les infos de l'inscription
    SELECT created_by, workflow_status INTO v_created_by, v_current_workflow
    FROM inscriptions
    WHERE id = COALESCE(NEW.inscription_id, OLD.inscription_id);

    -- Mise à jour de l'inscription
    UPDATE inscriptions
    SET
        montant_total_paye = v_montant_total,
        statut_paiement = CASE
            WHEN v_montant_total >= 4000 THEN 'soldé'
            WHEN v_montant_total > 0 THEN 'partiel'
            ELSE 'non_payé'
        END,
        -- AUTO-TRANSITION: Si paiement soldé ET inscription président en attente finance → passer à pending_secretariat
        workflow_status = CASE
            WHEN v_created_by = 'president'
                 AND v_current_workflow = 'pending_finance'
                 AND v_montant_total >= 4000
            THEN 'pending_secretariat'
            ELSE workflow_status
        END
    WHERE id = COALESCE(NEW.inscription_id, OLD.inscription_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Corriger les inscriptions existantes bloquées
-- Ces inscriptions avaient un paiement soldé mais restaient à pending_finance
UPDATE inscriptions
SET workflow_status = 'pending_secretariat'
WHERE created_by = 'president'
  AND workflow_status = 'pending_finance'
  AND montant_total_paye >= 4000;
