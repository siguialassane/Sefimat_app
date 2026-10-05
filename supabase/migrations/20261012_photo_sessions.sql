-- 20261012 : photo par téléphone (QR code).
-- photo_sessions : un QR = une session à usage unique, 15 min.
-- Le téléphone (page publique /scan/:token, sans login) dépose la photo ;
-- l'ordinateur reçoit photo_url en temps réel (publication realtime).
-- Table exposée en anon (cohérent avec inscriptions/paiements : RLS off) :
-- le token UUID imprévisible est la seule protection, usage unique + expiry.
CREATE TABLE IF NOT EXISTS public.photo_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token text NOT NULL UNIQUE,
    inscription_id uuid NOT NULL REFERENCES public.inscriptions(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
    photo_url text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    expires_at timestamptz NOT NULL DEFAULT NOW() + interval '15 minutes'
);
CREATE INDEX IF NOT EXISTS idx_photo_sessions_token ON public.photo_sessions(token);
CREATE INDEX IF NOT EXISTS idx_photo_sessions_inscription ON public.photo_sessions(inscription_id);

-- Temps réel pour l'écran secrétariat (UPDATE photo_url).
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_sessions;
EXCEPTION WHEN duplicate_object THEN
    -- déjà publiée : rien à faire
    NULL;
END $$;
