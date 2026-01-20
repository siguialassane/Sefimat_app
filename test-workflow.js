/**
 * Script de test pour vérifier le workflow des inscriptions président
 * 
 * Ce script vérifie que :
 * 1. Les inscriptions existantes ont été migrées correctement
 * 2. Les nouveaux champs sont présents
 * 3. Les états du workflow sont cohérents
 */

import { supabase } from './src/lib/supabase.js';

async function testWorkflow() {
    console.log('🔍 Test du workflow des inscriptions président\n');

    try {
        // 1. Vérifier la structure de la table
        console.log('1️⃣ Vérification de la structure de la table...');
        const { data: columns, error: colError } = await supabase
            .from('inscriptions')
            .select('*')
            .limit(1);

        if (colError) {
            console.error('❌ Erreur lors de la récupération des colonnes:', colError);
            return;
        }

        const sampleInscription = columns[0];
        const requiredFields = ['created_by', 'workflow_status', 'validated_by_secretariat', 'date_validation_secretariat'];
        const missingFields = requiredFields.filter(field => !(field in sampleInscription));

        if (missingFields.length > 0) {
            console.error('❌ Champs manquants:', missingFields.join(', '));
            return;
        }
        console.log('✅ Tous les champs requis sont présents\n');

        // 2. Vérifier les inscriptions par created_by
        console.log('2️⃣ Vérification des inscriptions par source...');
        const { data: byCreator } = await supabase
            .rpc('get_inscriptions_by_creator', {}, { count: 'exact' })
            .catch(async () => {
                // Si la fonction n'existe pas, faire une requête directe
                return await supabase
                    .from('inscriptions')
                    .select('created_by, workflow_status');
            });

        const stats = {};
        if (byCreator) {
            byCreator.forEach(row => {
                const key = `${row.created_by || 'NULL'}`;
                if (!stats[key]) stats[key] = { total: 0, statuses: {} };
                stats[key].total++;
                const status = row.workflow_status || 'NULL';
                stats[key].statuses[status] = (stats[key].statuses[status] || 0) + 1;
            });

            console.log('Statistiques par source :');
            Object.entries(stats).forEach(([creator, data]) => {
                console.log(`  📊 ${creator}: ${data.total} inscription(s)`);
                Object.entries(data.statuses).forEach(([status, count]) => {
                    console.log(`      └─ ${status}: ${count}`);
                });
            });
        }
        console.log('✅ Statistiques affichées\n');

        // 3. Vérifier les inscriptions en workflow actif
        console.log('3️⃣ Vérification des inscriptions en cours de workflow...');
        const { data: activeWorkflow, error: activeError } = await supabase
            .from('inscriptions')
            .select('id, nom, prenom, created_by, workflow_status, statut_paiement')
            .eq('created_by', 'president')
            .in('workflow_status', ['pending_finance', 'pending_secretariat']);

        if (activeError) {
            console.error('❌ Erreur:', activeError);
        } else if (activeWorkflow && activeWorkflow.length > 0) {
            console.log(`⚠️  ${activeWorkflow.length} inscription(s) en cours de workflow :`);
            activeWorkflow.forEach(i => {
                console.log(`  • ${i.nom} ${i.prenom} - ${i.workflow_status} (paiement: ${i.statut_paiement})`);
            });
        } else {
            console.log('✅ Aucune inscription en cours de workflow');
        }
        console.log();

        // 4. Vérifier les inscriptions complétées
        console.log('4️⃣ Vérification des inscriptions complétées...');
        const { data: completed, error: completedError } = await supabase
            .from('inscriptions')
            .select('id, nom, prenom, created_by, workflow_status', { count: 'exact' })
            .eq('created_by', 'president')
            .eq('workflow_status', 'completed');

        if (completedError) {
            console.error('❌ Erreur:', completedError);
        } else {
            console.log(`✅ ${completed.length} inscription(s) président complétée(s)`);
        }
        console.log();

        // 5. Test de cohérence
        console.log('5️⃣ Test de cohérence du workflow...');
        const { data: allInscriptions, error: allError } = await supabase
            .from('inscriptions')
            .select('id, created_by, workflow_status, statut_paiement, statut');

        if (allError) {
            console.error('❌ Erreur:', allError);
            return;
        }

        let inconsistencies = 0;
        allInscriptions.forEach(i => {
            // Vérifier que les inscriptions président ont un workflow_status
            if (i.created_by === 'president' && !i.workflow_status) {
                console.warn(`⚠️  Incohérence détectée: Inscription ${i.id} créée par président sans workflow_status`);
                inconsistencies++;
            }

            // Vérifier que les inscriptions en pending_finance n'ont pas de validation secrétariat
            if (i.workflow_status === 'pending_finance' && i.statut === 'valide') {
                console.warn(`⚠️  Incohérence détectée: Inscription ${i.id} en pending_finance mais déjà validée`);
                inconsistencies++;
            }
        });

        if (inconsistencies === 0) {
            console.log('✅ Aucune incohérence détectée');
        } else {
            console.log(`⚠️  ${inconsistencies} incohérence(s) détectée(s)`);
        }

        console.log('\n✨ Test du workflow terminé avec succès !');

    } catch (error) {
        console.error('\n❌ Erreur lors du test:', error);
    }
}

// Exécuter le test (si exécuté directement avec Node.js)
/* eslint-disable no-undef */
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('test-workflow')) {
    testWorkflow().then(() => {
        console.log('\n👋 Au revoir !');
    }).catch(err => {
        console.error('Erreur fatale:', err);
    });
}
/* eslint-enable no-undef */

export default testWorkflow;
