-- 20261007_inscriptions_archive.sql
-- Suppression secrétariat = ARCHIVAGE (jamais de perte sèche) + restauration.
-- L'archive embarque le dossier complet + versements + notes d'examens
-- (notes_examens est en ON DELETE CASCADE : sans elle, les notes partaient
-- en silence avec le dossier).
-- Note RLS : même posture que inscriptions/paiements (RLS désactivé).

CREATE TABLE IF NOT EXISTS public.inscriptions_archive (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inscription_id uuid NOT NULL,
    snapshot jsonb NOT NULL,
    versements jsonb NOT NULL DEFAULT '[]'::jsonb,
    notes jsonb NOT NULL DEFAULT '[]'::jsonb,
    motif text NULL,
    deleted_by uuid NULL,
    deleted_at timestamptz NOT NULL DEFAULT now(),
    restored_at timestamptz NULL,
    restored_by uuid NULL
);
CREATE INDEX IF NOT EXISTS idx_archive_inscription ON public.inscriptions_archive(inscription_id);
CREATE INDEX IF NOT EXISTS idx_archive_unrestored ON public.inscriptions_archive(deleted_at DESC)
    WHERE restored_at IS NULL;

-- Archive atomique : snapshot dossier + versements + notes, puis suppression
-- (la cascade efface les enfants). La photo Storage n'est PAS supprimée :
-- photo_url reste valide pour la restauration.
CREATE OR REPLACE FUNCTION public.archive_inscription(
    p_inscription_id uuid,
    p_acteur uuid DEFAULT NULL,
    p_motif text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_row inscriptions%ROWTYPE;
    v_versements jsonb;
    v_notes jsonb;
    v_archive_id uuid;
BEGIN
    IF p_inscription_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Inscription non trouvée');
    END IF;

    SELECT * INTO v_row FROM inscriptions WHERE id = p_inscription_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Inscription non trouvée');
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.created_at), '[]'::jsonb)
    INTO v_versements
    FROM paiements p WHERE p.inscription_id = p_inscription_id;

    SELECT COALESCE(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
    INTO v_notes
    FROM notes_examens n WHERE n.inscription_id = p_inscription_id;

    INSERT INTO inscriptions_archive (inscription_id, snapshot, versements, notes, motif, deleted_by)
    VALUES (p_inscription_id, to_jsonb(v_row), v_versements, v_notes, p_motif, p_acteur)
    RETURNING id INTO v_archive_id;

    DELETE FROM inscriptions WHERE id = p_inscription_id;

    RETURN json_build_object(
        'success', true,
        'archive_id', v_archive_id,
        'versements', jsonb_array_length(v_versements),
        'notes', jsonb_array_length(v_notes)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Restauration exacte : même id dossier/versements/notes, puis ré-application
-- des champs que les triggers d'INSERT recalculent (reference_id, statut,
-- non-dû, workflow). La ligne d'archive est CONSERVÉE (restored_at) : la
-- table reste l'historique complet des suppressions.
CREATE OR REPLACE FUNCTION public.restore_inscription(
    p_archive_id uuid,
    p_acteur uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_arch inscriptions_archive%ROWTYPE;
    v_cols text;
BEGIN
    SELECT * INTO v_arch FROM inscriptions_archive WHERE id = p_archive_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Archive introuvable');
    END IF;
    IF v_arch.restored_at IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'Dossier déjà restauré');
    END IF;
    IF EXISTS (SELECT 1 FROM inscriptions WHERE id = v_arch.inscription_id) THEN
        RETURN json_build_object('success', false, 'error', 'Un dossier actif existe déjà avec cet identifiant');
    END IF;

    -- Listes de colonnes SANS les colonnes générées (ex : moyenne) :
    -- jsonb_populate_* fournirait sinon des valeurs interdites d'INSERT.
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inscriptions' AND is_generated = 'NEVER';
    EXECUTE format('INSERT INTO inscriptions (%s) SELECT %s FROM jsonb_populate_record(NULL::inscriptions, $1)', v_cols, v_cols)
    USING v_arch.snapshot;

    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'paiements' AND is_generated = 'NEVER';
    EXECUTE format('INSERT INTO paiements (%s) SELECT %s FROM jsonb_populate_recordset(NULL::paiements, $1)', v_cols, v_cols)
    USING v_arch.versements;

    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notes_examens' AND is_generated = 'NEVER';
    EXECUTE format('INSERT INTO notes_examens (%s) SELECT %s FROM jsonb_populate_recordset(NULL::notes_examens, $1)', v_cols, v_cols)
    USING v_arch.notes;

    -- updated_at reste à l'heure de la restauration (trigger update_updated_at).
    UPDATE inscriptions SET
        reference_id = v_arch.snapshot->>'reference_id',
        statut_paiement = v_arch.snapshot->>'statut_paiement',
        montant_non_du = COALESCE((v_arch.snapshot->>'montant_non_du')::int, 0),
        workflow_status = v_arch.snapshot->>'workflow_status'
    WHERE id = v_arch.inscription_id;

    UPDATE inscriptions_archive
    SET restored_at = now(), restored_by = p_acteur
    WHERE id = p_archive_id;

    RETURN json_build_object('success', true, 'inscription_id', v_arch.inscription_id);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.archive_inscription(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.archive_inscription(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_inscription(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.restore_inscription(uuid, uuid) TO authenticated;
