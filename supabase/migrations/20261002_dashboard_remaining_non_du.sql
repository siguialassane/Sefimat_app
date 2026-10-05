-- ============================================
-- MIGRATION: Reste à payer cohérent dans v_global_dashboard_stats
-- Date: 2026-10-01
-- Description: total_remaining = somme par dossier de
--              GREATEST(0, requis - déclaré - non_dû), comme
--              getRemainingDue() côté front (au lieu de nb * 4000 - déclaré,
--              qui ignorait le requis personnalisé et le reliquat abandonné).
--              Ajoute total_required et total_validated (même règle que
--              getFinanceCollectedAmount : 0 pour un dossier président non
--              validé par la finance).
--              DROP + CREATE (et non OR REPLACE) : les définitions existantes
--              n'ont pas les mêmes colonnes selon qu'elles viennent de
--              20260126 (sans total_remaining) ou du script manuel
--              EXECUTE-Ce-SQL.sql (avec), et OR REPLACE refuse de
--              réordonner/renommer. La vue est une feuille (aucune dépendance),
--              les GRANTs sont recréés ci-dessous.
-- ============================================

DROP VIEW IF EXISTS v_global_dashboard_stats;

CREATE VIEW v_global_dashboard_stats AS
SELECT
    -- Registration counts
    COUNT(id) AS total_inscriptions,

    -- Payment status counts
    COUNT(CASE WHEN statut_paiement IN ('soldé', 'valide_financier') THEN 1 END) AS fully_paid,
    COUNT(CASE WHEN statut_paiement = 'partiel' THEN 1 END) AS partially_paid,
    COUNT(CASE WHEN statut_paiement = 'non_payé' OR statut_paiement IS NULL THEN 1 END) AS unpaid,

    -- Payment amounts
    COALESCE(SUM(montant_total_paye), 0) AS total_collected,
    COALESCE(SUM(GREATEST(0, COALESCE(montant_requis, 4000) - COALESCE(montant_total_paye, 0) - COALESCE(montant_non_du, 0))), 0) AS total_remaining,

    -- Workflow status counts
    COUNT(CASE WHEN workflow_status = 'pending_finance' THEN 1 END) AS pending_finance,
    COUNT(CASE WHEN workflow_status = 'pending_secretariat' THEN 1 END) AS pending_secretariat,
    COUNT(CASE WHEN workflow_status = 'completed' THEN 1 END) AS completed,

    -- Gender distribution
    COUNT(CASE WHEN sexe = 'homme' THEN 1 END) AS male_count,
    COUNT(CASE WHEN sexe = 'femme' THEN 1 END) AS female_count,

    -- Age distribution (5-35 years)
    COUNT(CASE WHEN age >= 5 AND age < 10 THEN 1 END) AS age_5_9,
    COUNT(CASE WHEN age >= 10 AND age < 15 THEN 1 END) AS age_10_14,
    COUNT(CASE WHEN age >= 15 AND age < 18 THEN 1 END) AS age_15_17,
    COUNT(CASE WHEN age >= 18 AND age <= 25 THEN 1 END) AS age_18_25,
    COUNT(CASE WHEN age > 25 AND age <= 35 THEN 1 END) AS age_26_35,

    -- Required total + finance-validated total (front: getRequiredAmount / getFinanceCollectedAmount)
    COALESCE(SUM(COALESCE(montant_requis, 4000)), 0) AS total_required,
    COALESCE(SUM(CASE WHEN created_by = 'president' AND statut_paiement IS DISTINCT FROM 'valide_financier' AND workflow_status IS DISTINCT FROM 'pending_secretariat' AND workflow_status IS DISTINCT FROM 'completed' THEN 0 ELSE COALESCE(montant_total_paye, 0) END), 0) AS total_validated

FROM inscriptions;

GRANT SELECT ON v_global_dashboard_stats TO anon;
GRANT SELECT ON v_global_dashboard_stats TO authenticated;
