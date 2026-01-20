-- ============================================
-- MIGRATION: Workflow pour inscriptions par président
-- Date: 2026-01-19
-- Description: Ajout des champs pour gérer le workflow spécifique aux inscriptions faites par les présidents de section
-- ============================================

-- 1. Ajouter les colonnes de workflow à la table inscriptions
ALTER TABLE inscriptions 
ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'public' 
    CHECK (created_by IN ('public', 'president', 'secretariat'));

ALTER TABLE inscriptions 
ADD COLUMN IF NOT EXISTS workflow_status TEXT DEFAULT NULL
    CHECK (workflow_status IN ('pending_finance', 'pending_secretariat', 'completed', 'rejected'));

ALTER TABLE inscriptions 
ADD COLUMN IF NOT EXISTS validated_by_secretariat UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE inscriptions 
ADD COLUMN IF NOT EXISTS date_validation_secretariat TIMESTAMPTZ;

-- 2. Créer des index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_inscriptions_created_by ON inscriptions(created_by);
CREATE INDEX IF NOT EXISTS idx_inscriptions_workflow_status ON inscriptions(workflow_status);
CREATE INDEX IF NOT EXISTS idx_inscriptions_workflow_created ON inscriptions(workflow_status, created_by);

-- 3. Fonction trigger pour initialiser le workflow pour les inscriptions président
CREATE OR REPLACE FUNCTION set_president_workflow()
RETURNS TRIGGER AS $$
BEGIN
    -- Si l'inscription est faite par un président et qu'elle a un chef_quartier_id
    -- alors initialiser le workflow
    IF NEW.created_by = 'president' AND NEW.chef_quartier_id IS NOT NULL THEN
        NEW.workflow_status := 'pending_finance';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Créer le trigger sur INSERT
DROP TRIGGER IF EXISTS trigger_set_president_workflow ON inscriptions;
CREATE TRIGGER trigger_set_president_workflow
    BEFORE INSERT ON inscriptions
    FOR EACH ROW
    EXECUTE FUNCTION set_president_workflow();

-- 5. Mettre à jour les inscriptions existantes avec chef_quartier_id
-- Les marquer comme completed pour ne pas affecter le workflow existant
UPDATE inscriptions
SET 
    created_by = CASE 
        WHEN chef_quartier_id IS NOT NULL THEN 'president'
        ELSE 'public'
    END,
    workflow_status = 'completed' -- Les anciennes inscriptions sont considérées comme complètes
WHERE workflow_status IS NULL;

-- ============================================
-- COMMENTAIRES SUR LE WORKFLOW
-- ============================================
-- Workflow pour les inscriptions par président:
-- 1. Inscription créée par président → workflow_status = 'pending_finance'
-- 2. Validation par cellule financière → workflow_status = 'pending_secretariat'
-- 3. Validation par secrétariat (+ dortoir) → workflow_status = 'completed'
-- 4. Si rejeté à n'importe quelle étape → workflow_status = 'rejected'
--
-- Les inscriptions publiques (created_by = 'public') n'utilisent pas ce workflow
-- ============================================
