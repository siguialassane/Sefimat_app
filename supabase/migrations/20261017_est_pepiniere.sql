-- 20261017 : flag pépinière (case manuelle secrétaire).
-- Un dossier marqué pépinière (petit enfant) garde son badge mais est exclu
-- de toute la cellule scientifique : test d'entrée, notes, classes,
-- bulletins et statistiques.
ALTER TABLE public.inscriptions
    ADD COLUMN IF NOT EXISTS est_pepiniere BOOLEAN NOT NULL DEFAULT false;

SELECT 'Migration 20261017 est_pepiniere OK!' as message;
