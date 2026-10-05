-- 20261011 : la finance crée des dossiers (préinscriptions présentielles).
-- created_by accepte désormais 'finance'. Le front traite tout non-président
-- comme guichet (isPresidentRegistration = created_by = 'president'), donc
-- aucun workflow existant n'est impacté : les préinscriptions n'apparaissent
-- ni dans la file finance (présentielles exclues) ni dans les compteurs
-- président, et restent visibles côté secrétariat avec le badge À compléter.
ALTER TABLE public.inscriptions DROP CONSTRAINT IF EXISTS inscriptions_created_by_check;
ALTER TABLE public.inscriptions ADD CONSTRAINT inscriptions_created_by_check
    CHECK (created_by = ANY (ARRAY['public'::text, 'president'::text, 'secretariat'::text, 'finance'::text]));
