-- 20261006_drop_auto_validate_payment.sql
-- Supprime le trigger legacy `check_auto_validate_payment` (hors repo) qui
-- forçait statut='validé' pour tout versement >= 4000 FCFA.
-- Il contredit le workflow caisse validé : l'argent président doit rester
-- DEHORS (attente) jusqu'à réception cochée par la finance, quel que soit
-- le montant. La transition vers le secrétariat reste assurée par
-- sync_inscription_montant (validé >= requis) + traçabilité front.
DROP TRIGGER IF EXISTS check_auto_validate_payment ON public.paiements;
DROP FUNCTION IF EXISTS public.auto_validate_payment();
