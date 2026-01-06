-- ============================================
-- MIGRATION: Dashboard Cellule Financier
-- Date: 2026-01-06
-- Description: Création des tables et colonnes pour la gestion financière
-- ============================================

-- 1. Table admin_users pour gérer les rôles des administrateurs
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('secretariat', 'financier', 'president_section')),
    nom_complet TEXT,
    chef_quartier_id UUID REFERENCES chefs_quartier(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches par rôle
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- RLS pour admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Politique RLS : permettre la lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can read admin_users" ON admin_users
    FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================

-- 2. Table paiements pour le suivi des paiements
CREATE TABLE IF NOT EXISTS paiements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscription_id UUID NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
    montant INTEGER NOT NULL CHECK (montant > 0), -- En FCFA
    date_paiement TIMESTAMPTZ DEFAULT NOW(),
    mode_paiement TEXT DEFAULT 'especes' CHECK (mode_paiement IN ('especes', 'mobile_money', 'virement')),
    recu_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_paiements_inscription_id ON paiements(inscription_id);
CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_paiement);

-- RLS pour paiements
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

-- Politique RLS : les utilisateurs authentifiés peuvent lire les paiements
CREATE POLICY "Authenticated users can read paiements" ON paiements
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique RLS : les utilisateurs authentifiés peuvent insérer des paiements
CREATE POLICY "Authenticated users can insert paiements" ON paiements
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================

-- 3. Modification de la table inscriptions pour ajouter les colonnes de paiement
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS montant_total_paye INTEGER DEFAULT 0;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS montant_requis INTEGER DEFAULT 4000;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS statut_paiement TEXT DEFAULT 'non_paye' 
    CHECK (statut_paiement IN ('non_paye', 'partiel', 'complet', 'valide_financier', 'refuse'));
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS valide_par_financier UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS date_validation_financier TIMESTAMPTZ;

-- ============================================

-- 4. Modification de la table chefs_quartier pour ajouter le lien unique
ALTER TABLE chefs_quartier ADD COLUMN IF NOT EXISTS lien_unique TEXT UNIQUE;

-- Générer les liens uniques pour les chefs existants
UPDATE chefs_quartier 
SET lien_unique = LOWER(REPLACE(REPLACE(nom_complet, ' ', '-'), '''', '')) || '-' || SUBSTRING(id::TEXT, 1, 8)
WHERE lien_unique IS NULL;

-- ============================================

-- 5. Insérer les utilisateurs admin existants
-- Note: Remplacez les UUIDs par les vrais IDs des utilisateurs Supabase Auth

-- Pour siguialassane93@gmail.com (Cellule Secrétariat)
-- INSERT INTO admin_users (id, email, role, nom_complet)
-- VALUES ('UUID_ICI', 'siguialassane93@gmail.com', 'secretariat', 'Admin Secrétariat')
-- ON CONFLICT (email) DO UPDATE SET role = 'secretariat';

-- Pour alassanesigui80@gmail.com (Cellule Financier)
-- INSERT INTO admin_users (id, email, role, nom_complet)
-- VALUES ('UUID_ICI', 'alassanesigui80@gmail.com', 'financier', 'Admin Financier')
-- ON CONFLICT (email) DO UPDATE SET role = 'financier';

-- ============================================

-- 6. Fonction trigger pour calculer automatiquement le montant total payé
CREATE OR REPLACE FUNCTION update_inscription_montant_total()
RETURNS TRIGGER AS $$
BEGIN
    -- Mise à jour du montant total payé pour l'inscription concernée
    UPDATE inscriptions
    SET montant_total_paye = (
        SELECT COALESCE(SUM(montant), 0)
        FROM paiements
        WHERE inscription_id = COALESCE(NEW.inscription_id, OLD.inscription_id)
    ),
    statut_paiement = CASE
        WHEN (
            SELECT COALESCE(SUM(montant), 0)
            FROM paiements
            WHERE inscription_id = COALESCE(NEW.inscription_id, OLD.inscription_id)
        ) >= 4000 THEN 'complet'
        WHEN (
            SELECT COALESCE(SUM(montant), 0)
            FROM paiements
            WHERE inscription_id = COALESCE(NEW.inscription_id, OLD.inscription_id)
        ) > 0 THEN 'partiel'
        ELSE 'non_paye'
    END
    WHERE id = COALESCE(NEW.inscription_id, OLD.inscription_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_update_inscription_montant ON paiements;
CREATE TRIGGER trigger_update_inscription_montant
AFTER INSERT OR UPDATE OR DELETE ON paiements
FOR EACH ROW
EXECUTE FUNCTION update_inscription_montant_total();

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================
