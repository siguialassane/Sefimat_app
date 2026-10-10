/* eslint-disable no-undef */
// Test ciblé de la règle pépinière (node test-pepiniere.js)
// Verrouille : un dossier est_pepiniere est exclu de toute la cellule
// scientifique (listes d'inscriptions comme listes de notes).
import {
    isExcluScientifique,
    sansPepiniereNotes,
} from "./src/lib/scientifique.js";

let failures = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "✅" : "❌"} ${name}`);
    if (!ok) {
        failures++;
        console.log(`   attendu: ${JSON.stringify(expected)} | reçu: ${JSON.stringify(actual)}`);
    }
}

// 1. Prédicat sur inscription
{
    check("pépinière exclu", isExcluScientifique({ est_pepiniere: true }), true);
    check("non pépinière inclus", isExcluScientifique({ est_pepiniere: false }), false);
    check("flag absent inclus (défaut)", isExcluScientifique({ statut: "valide" }), false);
    check("flag null inclus", isExcluScientifique({ est_pepiniere: null }), false);
    check("inscription nulle incluse", isExcluScientifique(null), false);
    check("inscription undefined incluse", isExcluScientifique(undefined), false);
}

// 2. Filtre sur notes_examens (jointure inscription)
{
    const n1 = { id: "n1", inscription: { est_pepiniere: false } };
    const n2 = { id: "n2", inscription: { est_pepiniere: true } };
    const n3 = { id: "n3", inscription: { statut: "valide" } };
    check("notes pépinière retirées", sansPepiniereNotes([n1, n2, n3]).map(n => n.id), ["n1", "n3"]);
    check("liste vide OK", sansPepiniereNotes([]), []);
    check("liste nulle OK", sansPepiniereNotes(null), []);
    check("note sans jointure gardée", sansPepiniereNotes([{ id: "x" }]).map(n => n.id), ["x"]);
}

console.log(failures === 0 ? "\nTous les tests passent." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
