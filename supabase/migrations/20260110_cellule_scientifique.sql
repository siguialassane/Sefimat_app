-- ============================================
-- MIGRATION: Cellule Scientifique
-- Date: 2026-01-10
-- Description: Création des tables pour la gestion des classes et notes
-- Niveaux: niveau_1 (0-5), niveau_2 (5-10), niveau_3 (10-14), niveau_superieur (15-20)
-- ============================================

-- 1. Table config_capacite_classes pour définir la capacité par niveau
CREATE TABLE IF NOT EXISTS config_capacite_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    niveau TEXT NOT NULL UNIQUE CHECK (niveau IN ('niveau_1', 'niveau_2', 'niveau_3', 'niveau_superieur')),
    capacite INTEGER NOT NULL DEFAULT 10 CHECK (capacite > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les configurations par défaut pour les 4 niveaux
INSERT INTO config_capacite_classes (niveau, capacite) VALUES
    ('niveau_1', 10),
    ('niveau_2', 10),
    ('niveau_3', 10),
    ('niveau_superieur', 10)
ON CONFLICT (niveau) DO UPDATE SET capacite = EXCLUDED.capacite;

-- RLS pour config_capacite_classes
ALTER TABLE config_capacite_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read config_capacite_classes" ON config_capacite_classes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update config_capacite_classes" ON config_capacite_classes
    FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================

-- 2. Table classes pour gérer les classes par niveau
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    niveau TEXT NOT NULL CHECK (niveau IN ('niveau_1', 'niveau_2', 'niveau_3', 'niveau_superieur')),
    numero INTEGER NOT NULL DEFAULT 1,
    nom TEXT GENERATED ALWAYS AS (
        CASE niveau
            WHEN 'niveau_1' THEN 'Niveau 1 - ' || numero
            WHEN 'niveau_2' THEN 'Niveau 2 - ' || numero
            WHEN 'niveau_3' THEN 'Niveau 3 - ' || numero
            WHEN 'niveau_superieur' THEN 'Niveau Supérieur - ' || numero
        END
    ) STORED,
    capacite INTEGER NOT NULL DEFAULT 10 CHECK (capacite > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(niveau, numero)
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_classes_niveau ON classes(niveau);

-- RLS pour classes
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read classes" ON classes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert classes" ON classes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update classes" ON classes
    FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================

-- 3. Table notes_examens pour les notes des participants
CREATE TABLE IF NOT EXISTS notes_examens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscription_id UUID NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
    classe_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    
    -- Note d'entrée (test initial pour déterminer le niveau)
    note_entree DECIMAL(4,2) CHECK (note_entree >= 0 AND note_entree <= 20),
    niveau_attribue TEXT CHECK (niveau_attribue IN ('niveau_1', 'niveau_2', 'niveau_3', 'niveau_superieur')),
    
    -- Notes additionnelles
    note_cahiers DECIMAL(4,2) CHECK (note_cahiers >= 0 AND note_cahiers <= 20),
    note_conduite DECIMAL(4,2) CHECK (note_conduite >= 0 AND note_conduite <= 20),
    note_sortie DECIMAL(4,2) CHECK (note_sortie >= 0 AND note_sortie <= 20),
    
    -- Moyenne calculée
    moyenne DECIMAL(4,2),
    
    -- Métadonnées
    saisi_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(inscription_id)
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_notes_examens_inscription_id ON notes_examens(inscription_id);
CREATE INDEX IF NOT EXISTS idx_notes_examens_classe_id ON notes_examens(classe_id);
CREATE INDEX IF NOT EXISTS idx_notes_examens_niveau ON notes_examens(niveau_attribue);

-- RLS pour notes_examens
ALTER TABLE notes_examens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notes_examens" ON notes_examens
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert notes_examens" ON notes_examens
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update notes_examens" ON notes_examens
    FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================

-- 4. Fonction pour calculer automatiquement la moyenne
CREATE OR REPLACE FUNCTION calculate_moyenne()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer la moyenne si toutes les notes sont présentes
    IF NEW.note_entree IS NOT NULL 
       AND NEW.note_cahiers IS NOT NULL 
       AND NEW.note_conduite IS NOT NULL 
       AND NEW.note_sortie IS NOT NULL THEN
        NEW.moyenne := (NEW.note_entree + NEW.note_cahiers + NEW.note_conduite + NEW.note_sortie) / 4;
    ELSE
        NEW.moyenne := NULL;
    END IF;
    
    -- Mettre à jour updated_at
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour calculer la moyenne
DROP TRIGGER IF EXISTS trigger_calculate_moyenne ON notes_examens;
CREATE TRIGGER trigger_calculate_moyenne
BEFORE INSERT OR UPDATE ON notes_examens
FOR EACH ROW
EXECUTE FUNCTION calculate_moyenne();

-- ============================================

-- 5. Fonction pour mettre à jour updated_at sur config et classes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_config_capacite_updated_at ON config_capacite_classes;
CREATE TRIGGER trigger_config_capacite_updated_at
BEFORE UPDATE ON config_capacite_classes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_classes_updated_at ON classes;
CREATE TRIGGER trigger_classes_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

-- Vérification
SELECT 'Migration Cellule Scientifique appliquée avec succès!' as message;
SELECT * FROM config_capacite_classes ORDER BY niveau;
