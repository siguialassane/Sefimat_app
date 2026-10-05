-- 20261008 : préinscription présentielle (finance) puis complétion (secrétariat).
-- La finance crée le dossier avec nom/prénom/montant uniquement ; le
-- secrétariat complète ensuite (âge, sexe, contacts, photo...).
-- 1. Les colonnes remplies à la complétion deviennent NULLables.
-- 2. dossier_complet marque l'état : FALSE = préinscrit (en attente de
--    complétion), TRUE = dossier complet (comportement historique).
--    Défaut TRUE : toutes les lignes existantes restent complètes.
--    restore_inscription() réinsère le snapshot complet : la colonne est
--    restaurée automatiquement, aucun patch requis.

ALTER TABLE public.inscriptions ALTER COLUMN age DROP NOT NULL;
ALTER TABLE public.inscriptions ALTER COLUMN sexe DROP NOT NULL;
ALTER TABLE public.inscriptions ALTER COLUMN niveau_etude DROP NOT NULL;

ALTER TABLE public.inscriptions
    ADD COLUMN IF NOT EXISTS dossier_complet boolean NOT NULL DEFAULT true;
