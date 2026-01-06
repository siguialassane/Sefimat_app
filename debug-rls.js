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

async function checkRLS() {
    console.log("Testing anonymous access to chefs_quartier...");

    // Test 1: Simple select without auth
    const { data, error } = await supabase
        .from("chefs_quartier")
        .select("*")
        .limit(3);

    if (error) {
        console.error("❌ Error querying chefs_quartier:", error);
        console.log("\nThis likely means RLS is blocking anonymous access.");
    } else {
        console.log("✅ Success! Found", data.length, "records");
        console.log("Sample data:", data);
    }

    // Test 2: Specific query with lien_unique
    const lienUnique = "85FD82C4";
    const { data: data2, error: error2 } = await supabase
        .from("chefs_quartier")
        .select("*")
        .eq("lien_unique", lienUnique)
        .single();

    if (error2) {
        console.error("\n❌ Error querying specific president:", error2);
    } else {
        console.log("\n✅ Found president:", data2.nom_complet);
    }
}

checkRLS();
