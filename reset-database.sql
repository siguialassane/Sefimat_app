-- Script de réinitialisation de la base de données SEFIMAP
-- À exécuter dans Supabase SQL Editor

-- 1. Supprimer tous les participants
DELETE FROM inscriptions;

-- 2. Réinitialiser la séquence des IDs à 8 (pour avoir SEFI-08 comme prochain ID)
-- Vérifier d'abord le nom exact de la séquence
-- Si vous avez une séquence pour reference_id, utilisez:
-- ALTER SEQUENCE reference_id_seq RESTART WITH 8;

-- Si vous utilisez une fonction pour générer les IDs, vous devrez peut-être:
-- 1. Trouver la table qui stocke le dernier numéro
-- 2. Le mettre à jour à 7 (car le prochain sera 8)

-- Exemple si vous avez une table de configuration:
-- UPDATE config SET last_reference_number = 7 WHERE key = 'last_inscription_id';

-- 3. Afficher le résultat
SELECT 'Base de données réinitialisée avec succès!' as message;
SELECT COUNT(*) as total_inscriptions FROM inscriptions;
