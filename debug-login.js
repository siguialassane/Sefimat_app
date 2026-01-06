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

console.log("Connecting to Supabase...");
const supabase = createClient(url, key);

async function test() {
    console.log("Attempting login for siguialassane93@gmail.com...");
    try {
        const start = Date.now();
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'siguialassane93@gmail.com',
            password: 'alasco22'
        });
        console.log(`Login call took ${Date.now() - start}ms`);

        if (error) {
            console.error("Login Error:", error);
            return;
        }

        console.log("Login Success! User ID:", data.user.id);

        console.log("Querying admin_users table...");
        const dbStart = Date.now();
        const { data: profile, error: dbError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', data.user.id); // Not using single() to avoid error if 0 rows

        console.log(`DB Query took ${Date.now() - dbStart}ms`);

        if (dbError) {
            console.error("admin_users Query Error:", dbError);
        } else if (profile.length === 0) {
            console.log("No profile found in admin_users for this ID.");
        } else {
            console.log("Profile found:", profile[0]);
        }

    } catch (e) {
        console.error("Script Exception:", e);
    }
}

test();
