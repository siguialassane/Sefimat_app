import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env
const envPath = path.resolve(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        env[key] = value;
    }
});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) { console.error("No credentials in .env"); process.exit(1); }

const supabase = createClient(url, key);

async function checkPresident() {
    const lienUnique = "85FD82C4";
    console.log(`Checking president with lien_unique: ${lienUnique}`);

    try {
        const { data, error } = await supabase
            .from("chefs_quartier")
            .select("*")
            .eq("lien_unique", lienUnique)
            .single();

        if (error) {
            console.error("Error fetching president:", error);
        } else {
            console.log("President found:", data);
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

checkPresident();
