/* eslint-disable no-undef */
// Test ciblé du périmètre secrétaire (node test-secretariat-scope.js)
// Verrouille : un dossier président n'est visible (liste, exports, stats)
// qu'après validation finance ; le filtre PostgREST des exports est équivalent.
import {
    applySecretariatScope,
    isInSecretariatScope,
    SECRETARIAT_SCOPE_OR,
    SECRETARIAT_WORKFLOW_OK,
} from "./src/lib/secretariat.js";

let failures = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "✅" : "❌"} ${name}`);
    if (!ok) {
        failures++;
        console.log(`   attendu: ${JSON.stringify(expected)} | reçu: ${JSON.stringify(actual)}`);
    }
}

// 1. Dossiers président : invisibles tant que la finance n'a pas validé
{
    check("président pending_finance exclu", isInSecretariatScope({ created_by: "president", workflow_status: "pending_finance" }), false);
    check("président sans workflow exclu", isInSecretariatScope({ created_by: "president", workflow_status: null }), false);
    check("président pending_secretariat visible", isInSecretariatScope({ created_by: "president", workflow_status: "pending_secretariat" }), true);
    check("président completed visible", isInSecretariatScope({ created_by: "president", workflow_status: "completed" }), true);
}

// 2. Autres dossiers toujours visibles (argent encaissé direct au guichet)
{
    check("finance visible", isInSecretariatScope({ created_by: "finance", workflow_status: null }), true);
    check("secretariat visible", isInSecretariatScope({ created_by: "secretariat", workflow_status: "en_attente_finance" }), true);
    check("public visible", isInSecretariatScope({ created_by: "public" }), true);
    check("ligne nulle exclue", isInSecretariatScope(null), false);
}

// 3. Filtre serveur des exports équivalent au prédicat
{
    const seen = [];
    const fakeQuery = { or: (s) => { seen.push(s); return "scoped"; } };
    check("applySecretariatScope retourne la requête", applySecretariatScope(fakeQuery), "scoped");
    check("clause OR émise", seen, [SECRETARIAT_SCOPE_OR]);
    check("statuts autorisés", SECRETARIAT_WORKFLOW_OK, ["pending_secretariat", "completed"]);
}

console.log(failures === 0 ? "\nTous les tests passent." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
