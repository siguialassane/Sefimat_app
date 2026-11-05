import { createClient } from "@supabase/supabase-js";

// Session distincte de la connexion locale historique, pour les données privées.
export const memberClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { storageKey: "sefimap-member-auth", persistSession: true, autoRefreshToken: true },
});
