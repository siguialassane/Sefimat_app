-- ============================================
-- MIGRATION: Reprise historique file caisse (prod : 20261003 déjà appliquée)
-- Date: 2026-10-02
-- Description: rejoue la section 4a de 20261003 pour les bases où 20261003
--              a été appliquée avant l'ajout de la reprise : les versements
--              des dossiers président NON approuvés (pending_finance/rejected)
--              n'ont jamais été réceptionnés en caisse, ils rouvrent la file
--              d'attente (dehors). Le trigger resync montant_valide au passage.
--              (Installations fraîches : 20261003 contient déjà cette reprise,
--              ce fichier est alors un no-op.)
-- ============================================

UPDATE paiements p
SET statut = 'attente'
FROM inscriptions i
WHERE p.inscription_id = i.id
  AND p.statut = 'validé'
  AND i.created_by = 'president'
  AND NOT (i.statut_paiement = 'valide_financier'
           OR i.workflow_status IN ('pending_secretariat', 'completed'));
