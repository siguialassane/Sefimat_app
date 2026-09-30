-- ============================================
-- MIGRATION: Reliquat abandonné (montant non dû)
-- Date: 2026-09-30
-- Description: Sauvegarde le reste "non dû" lorsqu'une validation
--              finance est faite sur un paiement partiel (ex. validé à
--              3000/4000 => 1000 FCFA non dus, à exclure du reste à recouvrer).
-- ============================================

-- 1. Nouvelle colonne (0 = rien d'abandonné)
ALTER TABLE inscriptions
ADD COLUMN IF NOT EXISTS montant_non_du INTEGER DEFAULT 0;

-- 2. Reprise de l'existant : dossiers président déjà validés (finance et/ou
--    secrétariat) avec un total inférieur au requis
UPDATE inscriptions
SET montant_non_du = GREATEST(0, COALESCE(montant_requis, 4000) - COALESCE(montant_total_paye, 0))
WHERE created_by = 'president'
  AND workflow_status IN ('pending_secretariat', 'completed')
  AND COALESCE(montant_total_paye, 0) < COALESCE(montant_requis, 4000);

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_inscriptions_montant_non_du ON inscriptions(montant_non_du);
