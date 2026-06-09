-- ============================================
-- MIGRATION: Vues et Fonctions pour Dashboard Global
-- Date: 2026-01-26
-- Description: Créer les vues et fonctions pour les statistiques globales
-- ============================================

-- 1. Vue: Statistiques globales du dashboard
CREATE OR REPLACE VIEW v_global_dashboard_stats AS
SELECT 
    COUNT(id) AS total_inscriptions,
    COUNT(CASE WHEN statut_paiement IN ('soldé', 'valide_financier') THEN 1 END) AS fully_paid,
    COUNT(CASE WHEN statut_paiement = 'partiel' THEN 1 END) AS partially_paid,
    COUNT(CASE WHEN statut_paiement = 'non_payé' OR statut_paiement IS NULL THEN 1 END) AS unpaid,
    COALESCE(SUM(montant_total_paye), 0) AS total_collected,
    (COUNT(id) * 4000) - COALESCE(SUM(montant_total_paye), 0) AS total_remaining,
    COUNT(CASE WHEN workflow_status = 'pending_finance' THEN 1 END) AS pending_finance,
    COUNT(CASE WHEN workflow_status = 'pending_secretariat' THEN 1 END) AS pending_secretariat,
    COUNT(CASE WHEN workflow_status = 'completed' THEN 1 END) AS completed,
    COUNT(CASE WHEN sexe = 'homme' THEN 1 END) AS male_count,
    COUNT(CASE WHEN sexe = 'femme' THEN 1 END) AS female_count,
    COUNT(CASE WHEN age >= 5 AND age < 10 THEN 1 END) AS age_5_9,
    COUNT(CASE WHEN age >= 10 AND age < 15 THEN 1 END) AS age_10_14,
    COUNT(CASE WHEN age >= 15 AND age < 18 THEN 1 END) AS age_15_17,
    COUNT(CASE WHEN age >= 18 AND age <= 25 THEN 1 END) AS age_18_25,
    COUNT(CASE WHEN age > 25 AND age <= 35 THEN 1 END) AS age_26_35
FROM inscriptions;

-- 2. Fonction: Inscriptions récentes
CREATE OR REPLACE FUNCTION get_recent_registrations(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    nom TEXT,
    prenom TEXT,
    photo_url TEXT,
    telephone TEXT,
    numero_parent TEXT,
    statut_paiement TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT i.id, i.nom, i.prenom, i.photo_url, i.telephone, i.numero_parent, i.statut_paiement, i.created_at
    FROM inscriptions i
    ORDER BY i.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 3. Fonction: Paiements récents
CREATE OR REPLACE FUNCTION get_recent_payments(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    inscription_id UUID,
    participant_nom TEXT,
    participant_prenom TEXT,
    montant INTEGER,
    mode_paiement TEXT,
    date_paiement TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.inscription_id, i.nom, i.prenom, p.montant, p.mode_paiement, p.date_paiement
    FROM paiements p
    JOIN inscriptions i ON p.inscription_id = i.id
    ORDER BY p.date_paiement DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 4. Index pour la performance
CREATE INDEX IF NOT EXISTS idx_inscriptions_statut_paiement ON inscriptions(statut_paiement);
CREATE INDEX IF NOT EXISTS idx_inscriptions_workflow_status ON inscriptions(workflow_status);
CREATE INDEX IF NOT EXISTS idx_paiements_inscription_id ON paiements(inscription_id);
CREATE INDEX IF NOT EXISTS idx_inscriptions_created_at ON inscriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_paiement);

-- 5. Permissions
GRANT SELECT ON v_global_dashboard_stats TO anon;
GRANT SELECT ON v_global_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_registrations(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_recent_registrations(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_payments(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_recent_payments(INTEGER) TO authenticated;
