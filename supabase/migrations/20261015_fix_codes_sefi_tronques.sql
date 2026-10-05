-- 20261015 : débloque la création des inscriptions (codes SEFI- tronqués).
-- Cause : le trigger historique set_sefi_id() (BEFORE INSERT, exécuté en premier
-- car "set_..." < "trigger_..." en ordre alphabétique) écrase systématiquement
-- NEW.reference_id avec 'SEFI-' || LPAD(nextval('sefi_id_seq'), 2, '0').
-- Or LPAD() TRONQUE les chaînes plus longues que la cible : dès que la séquence
-- dépasse 99 (elle est à 146), chaque insertion produit 'SEFI-14' -> violation
-- de la contrainte UNIQUE. Le trigger sûr (compteur config_reference_id) ne
-- s'exécutait jamais car il ne remplit que les valeurs NULL.
-- Correctif : supprime le trigger/séquence historiques, et durcit
-- generate_reference_id() contre la même troncature à 100+ (compteur à 73).

-- 1. Supprimer le trigger historique + sa fonction + sa séquence
DROP TRIGGER IF EXISTS set_sefi_id ON public.inscriptions;
DROP FUNCTION IF EXISTS public.generate_sefi_id();
DROP SEQUENCE IF EXISTS public.sefi_id_seq;

-- 2. generate_reference_id() sans troncature (zéro initial sous 10, jamais de coupe)
CREATE OR REPLACE FUNCTION public.generate_reference_id()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    next_number INTEGER;
    new_reference_id TEXT;
BEGIN
    LOOP
        UPDATE config_reference_id
        SET last_number = last_number + 1
        WHERE id = 1
        RETURNING last_number INTO next_number;

        -- 'SEFI-05' sous 10, 'SEFI-100' au-delà : LPAD(...,2) tronquerait à 100+
        IF next_number < 10 THEN
            new_reference_id := 'SEFI-0' || next_number::TEXT;
        ELSE
            new_reference_id := 'SEFI-' || next_number::TEXT;
        END IF;

        EXIT WHEN NOT EXISTS (SELECT 1 FROM inscriptions WHERE inscriptions.reference_id = new_reference_id);
    END LOOP;

    RETURN new_reference_id;
END;
$function$;

-- 3. Recaler le compteur sur le max vivant (sécurité, jamais en arrière)
UPDATE config_reference_id
SET last_number = GREATEST(
    last_number,
    COALESCE((SELECT MAX((regexp_replace(reference_id, 'SEFI-', ''))::int)
              FROM inscriptions WHERE reference_id ~ '^SEFI-[0-9]+$'), 0)
)
WHERE id = 1;

SELECT 'Migration 20261015 codes SEFI débloqués!' as message;
SELECT last_number AS compteur FROM config_reference_id WHERE id = 1;
