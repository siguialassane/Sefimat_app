-- ============================================
-- Seuils de notes configurables + noms de classes en lettres (A/B/C...)
-- ============================================

-- 1. Table des seuils note -> niveau (bornes max inclusives, croissantes)
CREATE TABLE IF NOT EXISTS config_seuils_niveaux (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    niveau TEXT NOT NULL UNIQUE CHECK (niveau IN ('niveau_1', 'niveau_2', 'niveau_3')),
    note_max NUMERIC(4,2) NOT NULL CHECK (note_max > 0 AND note_max < 20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valeurs par défaut = règles actuelles (ne pas écraser une config existante)
INSERT INTO config_seuils_niveaux (niveau, note_max) VALUES
    ('niveau_1', 5),
    ('niveau_2', 10),
    ('niveau_3', 14)
ON CONFLICT (niveau) DO NOTHING;

-- RLS (même modèle que config_capacite_classes)
ALTER TABLE config_seuils_niveaux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read config_seuils_niveaux" ON config_seuils_niveaux;
CREATE POLICY "Authenticated users can read config_seuils_niveaux" ON config_seuils_niveaux
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update config_seuils_niveaux" ON config_seuils_niveaux;
CREATE POLICY "Authenticated users can update config_seuils_niveaux" ON config_seuils_niveaux
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS trigger_config_seuils_updated_at ON config_seuils_niveaux;
CREATE TRIGGER trigger_config_seuils_updated_at
BEFORE UPDATE ON config_seuils_niveaux
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. Noms de classes en lettres : "Niveau 1-A" au lieu de "Niveau 1 - 1"
ALTER TABLE classes DROP COLUMN IF EXISTS nom;
ALTER TABLE classes ADD COLUMN nom TEXT GENERATED ALWAYS AS (
    CASE niveau
        WHEN 'niveau_1' THEN 'Niveau 1-' || CHR(64 + numero)
        WHEN 'niveau_2' THEN 'Niveau 2-' || CHR(64 + numero)
        WHEN 'niveau_3' THEN 'Niveau 3-' || CHR(64 + numero)
        WHEN 'niveau_superieur' THEN 'Niveau Supérieur-' || CHR(64 + numero)
    END
) STORED;

SELECT 'Migration seuils niveaux + classes A/B appliquée avec succès!' as message;
SELECT * FROM config_seuils_niveaux ORDER BY note_max;
