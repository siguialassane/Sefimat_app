-- 20261013 : codes SEFI- uniques, sans réutilisation.
-- Cause des doublons (SEFI-11 x2...) : le compteur config_reference_id a été
-- remis à 0 alors que des lignes vivantes portaient déjà ces codes ; les
-- nouveaux dossiers réutilisaient les mêmes numéros.
-- 1. Renumérote les doublons (garde le plus ancien par code).
-- 2. Recale le compteur sur le max vivant (jamais en arrière).
-- 3. Contrainte UNIQUE : un doublon futur échoue bruyamment au lieu de
--    corrompre silencieusement la recherche par code.
-- 4. generate_reference_id() boucle jusqu'à un code libre (anti-course).
DO $$
DECLARE
    r RECORD;
    v_max INT;
BEGIN
    SELECT COALESCE(MAX((regexp_replace(reference_id, 'SEFI-', ''))::int), 0)
    INTO v_max
    FROM inscriptions
    WHERE reference_id ~ '^SEFI-[0-9]+$';

    FOR r IN
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY reference_id ORDER BY created_at, id) AS rn
            FROM inscriptions
            WHERE reference_id ~ '^SEFI-[0-9]+$'
        ) s WHERE rn > 1 ORDER BY id
    LOOP
        v_max := v_max + 1;
        UPDATE inscriptions
        SET reference_id = 'SEFI-' || LPAD(v_max::text, 2, '0'), updated_at = NOW()
        WHERE id = r.id;
    END LOOP;

    UPDATE config_reference_id
    SET last_number = GREATEST(last_number, v_max)
    WHERE id = 1;
END $$;

ALTER TABLE public.inscriptions DROP CONSTRAINT IF EXISTS inscriptions_reference_id_unique;
ALTER TABLE public.inscriptions ADD CONSTRAINT inscriptions_reference_id_unique UNIQUE (reference_id);

CREATE OR REPLACE FUNCTION public.generate_reference_id()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    next_number INTEGER;
    reference_id TEXT;
BEGIN
    LOOP
        UPDATE config_reference_id
        SET last_number = last_number + 1
        WHERE id = 1
        RETURNING last_number INTO next_number;

        reference_id := 'SEFI-' || LPAD(next_number::TEXT, 2, '0');

        EXIT WHEN NOT EXISTS (SELECT 1 FROM inscriptions WHERE inscriptions.reference_id = generate_reference_id.reference_id);
    END LOOP;

    RETURN reference_id;
END;
$function$;
