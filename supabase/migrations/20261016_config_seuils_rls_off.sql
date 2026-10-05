-- 20261016 : aligne config_seuils_niveaux sur le modèle réel de l'app.
-- Contexte : l'authentification est custom (users.config.js + localStorage),
-- aucune session Supabase Auth n'existe ; le front interroge PostgREST en rôle
-- anon. RLS est désactivé sur toutes les tables applicatives
-- (inscriptions, notes_examens, classes, config_capacite_classes...).
-- La migration 20261014 avait activé RLS sur config_seuils_niveaux avec des
-- policies "authenticated" : en anon, les SELECT revenaient vides et les
-- UPDATE affectaient 0 ligne sans erreur -> seuils non configurables.
-- Correctif : RLS OFF comme les autres tables (policies conservées au cas où
-- RLS serait réactivé globalement un jour).
ALTER TABLE public.config_seuils_niveaux DISABLE ROW LEVEL SECURITY;
SELECT 'Migration 20261016 RLS config_seuils_niveaux aligné!' as message;
