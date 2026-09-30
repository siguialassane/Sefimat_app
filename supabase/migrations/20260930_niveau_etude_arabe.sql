-- ============================================
-- MIGRATION: Autoriser le niveau d'étude 'arabe'
-- Date: 2026-09-30
-- Contexte: les formulaires (président, présentiel, modal secrétaire)
--   proposent l'option "Arabe", mais le CHECK BD ne l'autorisait pas,
--   ce qui rejetait l'inscription. On aligne le CHECK sur le front.
-- ============================================
ALTER TABLE inscriptions DROP CONSTRAINT IF EXISTS inscriptions_niveau_etude_check;
ALTER TABLE inscriptions ADD CONSTRAINT inscriptions_niveau_etude_check
    CHECK (niveau_etude IN ('aucun', 'primaire', 'secondaire', 'superieur', 'arabe'));
