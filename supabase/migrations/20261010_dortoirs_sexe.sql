-- Sexe des dortoirs : colonne + backfill aleatoire + exposition dans la vue stats.
ALTER TABLE dortoirs
  ADD COLUMN IF NOT EXISTS sexe TEXT CHECK (sexe IN ('homme', 'femme'));

-- Backfill aleatoire des dortoirs existants (environ moitie homme / moitie femme).
UPDATE dortoirs
SET sexe = CASE WHEN random() < 0.5 THEN 'homme' ELSE 'femme' END
WHERE sexe IS NULL;

-- Exposer le sexe dans la vue de statistiques (colonne ajoutee en fin de liste).
CREATE OR REPLACE VIEW vue_statistiques_dortoirs AS
SELECT
  d.id,
  d.nom,
  d.capacite,
  COALESCE(count(i.id), 0::bigint) AS nombre_inscrits,
  (d.capacite - COALESCE(count(i.id), 0::bigint)) AS places_disponibles,
  CASE
    WHEN (d.capacite > 0) THEN round((((COALESCE(count(i.id), 0::bigint))::numeric / (d.capacite)::numeric) * 100::numeric), 1)
    ELSE 0::numeric
  END AS taux_remplissage,
  d.sexe
FROM (dortoirs d
  LEFT JOIN inscriptions i ON (((d.id = i.dortoir_id) AND (i.statut = 'valide'::statut_inscription_enum))))
GROUP BY d.id, d.nom, d.capacite, d.sexe
ORDER BY d.nom;
