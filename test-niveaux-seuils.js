/* eslint-disable no-undef */
// Test ciblé des seuils note -> niveau (node test-niveaux-seuils.js)
// Couvre : règles par défaut, seuils configurables, plages d'affichage,
// validation des triplets, split auto A/B (logique pure).
import {
    choisirClasseDisponible,
    determinerNiveau,
    getSeuilsMap,
    plageNiveau,
    validerSeuils,
    DEFAULT_SEUILS,
} from "./src/lib/niveaux.js";

let failures = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "✅" : "❌"} ${name}`);
    if (!ok) {
        failures++;
        console.log(`   attendu: ${JSON.stringify(expected)} | reçu: ${JSON.stringify(actual)}`);
    }
}

// 1. Règles par défaut : 3 -> N1, bornes inclusives
{
    check("défaut: note 3 -> niveau_1", determinerNiveau(3), "niveau_1");
    check("défaut: note 5 -> niveau_1 (borne incluse)", determinerNiveau(5), "niveau_1");
    check("défaut: note 5.5 -> niveau_2", determinerNiveau(5.5), "niveau_2");
    check("défaut: note 10 -> niveau_2", determinerNiveau(10), "niveau_2");
    check("défaut: note 14 -> niveau_3", determinerNiveau(14), "niveau_3");
    check("défaut: note 15 -> niveau_superieur", determinerNiveau(15), "niveau_superieur");
    check("défaut: sans config -> DEFAULT_SEUILS", getSeuilsMap(null), DEFAULT_SEUILS);
    check("défaut: config vide -> DEFAULT_SEUILS", getSeuilsMap([]), DEFAULT_SEUILS);
}

// 2. Seuils configurables : N1 max 7 -> note 6 va en N1
{
    const rows = [
        { niveau: "niveau_1", note_max: 7 },
        { niveau: "niveau_2", note_max: 10 },
        { niveau: "niveau_3", note_max: 14 },
    ];
    check("config: seuils lus depuis les lignes", getSeuilsMap(rows), { niveau_1: 7, niveau_2: 10, niveau_3: 14 });
    check("config: note 6 -> niveau_1 (seuil 7)", determinerNiveau(6, rows), "niveau_1");
    check("config: note 7 -> niveau_1 (borne incluse)", determinerNiveau(7, rows), "niveau_1");
    check("config: note 8 -> niveau_2", determinerNiveau(8, rows), "niveau_2");
    check("config: ligne invalide ignorée", getSeuilsMap([{ niveau: "niveau_1", note_max: "abc" }]), DEFAULT_SEUILS);
}

// 3. Plages d'affichage suivent les seuils
{
    check("plage N1 par défaut", plageNiveau("niveau_1"), { min: 0, max: 5 });
    check("plage N2 par défaut", plageNiveau("niveau_2"), { min: 5, max: 10 });
    check("plage sup par défaut", plageNiveau("niveau_superieur"), { min: 14, max: 20 });
    const rows = [{ niveau: "niveau_1", note_max: 7 }];
    check("plage N1 après seuil 7", plageNiveau("niveau_1", rows), { min: 0, max: 7 });
    check("plage N2 après seuil 7", plageNiveau("niveau_2", rows), { min: 7, max: 10 });
}

// 4. Validation des triplets saisis
{
    check("triplet valide OK", validerSeuils(5, 10, 14), null);
    check("triplet décimal valide OK", validerSeuils(4.5, 9, 13), null);
    check("triplet non croissant refusé", validerSeuils(12, 10, 14) !== null, true);
    check("triplet égal refusé", validerSeuils(10, 10, 14) !== null, true);
    check("triplet hors borne refusé", validerSeuils(0, 10, 14) !== null, true);
    check("triplet non numérique refusé", validerSeuils("x", 10, 14) !== null, true);
}

// 5. Choix de classe : première avec de la place, sinon null (à créer)
{
    const A = { id: "a", numero: 1, capacite: 2 };
    const B = { id: "b", numero: 2, capacite: 2 };
    check("classe vide -> A", choisirClasseDisponible([A, B], {}, null), A);
    check("A pleine (2/2) -> B", choisirClasseDisponible([A, B], { a: 2 }, null), B);
    check("A et B pleines -> null", choisirClasseDisponible([A, B], { a: 2, b: 2 }, null), null);
    check("aucune classe -> null", choisirClasseDisponible([], {}, null), null);
    // Lot groupé : réservations extra comptées avant le re-rendu React
    check("lot: A 1 + 1 réservé -> B", choisirClasseDisponible([A, B], { a: 1 }, { a: 1 }), B);
    check("lot: A 0 + 2 réservés -> B", choisirClasseDisponible([A, B], {}, { a: 2 }), B);
    check("lot: A 0 + 1 réservé -> A", choisirClasseDisponible([A, B], {}, { a: 1 }), A);
}

console.log(failures === 0 ? "\nTous les tests passent." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
