import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ajtdfnplpbzansdkduvg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqdGRmbnBscGJ6YW5zZGtkdXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjQyMjUsImV4cCI6MjA4MTAwMDIyNX0.J-_PzJwwJ0v9FVHqbuNZ_VvV6hjgYRqPnHP-rdLwK9A';

console.log('🔍 Test de connexion Supabase...\n');

try {
  // Créer le client Supabase
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('✅ Client Supabase créé avec succès');
  console.log(`📍 URL: ${supabaseUrl}`);
  console.log(`🔑 Clé anonyme: ${supabaseAnonKey.substring(0, 20)}...`);

  // Test 1: Vérifier la santé de la base de données
  console.log('\n🔗 Tentative de connexion à la base de données...');
  const { data, error } = await supabase
    .from('profiles')
    .select('count()', { count: 'exact', head: true })
    .limit(1);

  if (error) {
    console.log('\n❌ Erreur lors de la requête:');
    console.log(`   Message: ${error.message}`);
    console.log(`   Code: ${error.code}`);
    console.log(`   Détails: ${JSON.stringify(error.details || 'N/A', null, 2)}`);
  } else {
    console.log('\n✅ Connexion à la base de données réussie!');
    console.log('   La requête a été exécutée avec succès');
    if (data !== null) {
      console.log(`   Réponse: ${JSON.stringify(data)}`);
    }
  }

  // Test 2: Essayer une requête simple
  console.log('\n📊 Test d\'une requête simple...');
  const { data: registrations, error: regError, count } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .limit(1);

  if (regError) {
    console.log(`   ⚠️  Table "registrations" non trouvée ou pas d'accès: ${regError.message}`);
  } else {
    console.log(`   ✅ Accès à la table "registrations" réussi`);
    console.log(`   Nombre total d'entrées: ${count}`);
  }

  console.log('\n✨ Test de connexion terminé avec succès!\n');
  process.exit(0);

} catch (err) {
  console.log('\n❌ Erreur générale:');
  console.log(err.message);
  if (err.stack) {
    console.log('\nStack trace:');
    console.log(err.stack);
  }
  process.exit(1);
}
