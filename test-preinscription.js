// Test ciblé du flux présentiel en 2 temps (node test-preinscription.js)
// Finance préinscrit (nom/prénom/montant -> code SEFI-) puis le secrétariat
// finalise par code (nom/prénom verrouillés). L'ancien flux de création
// complète côté secrétariat est supprimé.
import { readFileSync, existsSync } from "node:fs";

let failures = 0;
function check(name, ok, detail = "") {
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " | " + detail : ""}`);
    if (!ok) failures++;
}

const mig = "./supabase/migrations/20261008_preinscription_presentielle.sql";
check("migration préinscription existe", existsSync(mig));
if (existsSync(mig)) {
    const sql = readFileSync(mig, "utf8");
    check("migration: dossier_complet", sql.includes("dossier_complet"));
    check("migration: âge/sexe/niveau NULLables", sql.includes("DROP NOT NULL"));
}

const app = readFileSync("./src/App.jsx", "utf8");
check("route /finance/preinscription", app.includes('path="preinscription"'));

const layout = readFileSync("./src/components/layout/FinanceLayout.jsx", "utf8");
check("menu finance Préinscriptions", layout.includes("/finance/preinscription"));

const pre = readFileSync("./src/pages/finance/Preinscription.jsx", "utf8");
check("préinscription: montant > 0 exigé", pre.includes("minimum 1 FCFA") || pre.includes("value <= 0"));
check("préinscription: plafond 5000 (constante partagée)", pre.includes("REQUIRED_PAYMENT_AMOUNT") && !pre.includes("4000"));
check("préinscription: dossier incomplet", pre.includes("dossier_complet: false"));
check("préinscription: versement validé direct", pre.includes('statut: "validé"') && pre.includes("date_reception"));
check("préinscription: code affiché", pre.includes("reference_id"));

const fin = readFileSync("./src/pages/InPersonRegistration.jsx", "utf8");
check("finalisation: choix dans liste (chargerACompleter)", fin.includes("chargerACompleter") && fin.includes("choisirDossier"));
check("finalisation: nom/prénom verrouillés", !fin.includes('register("nom")') && !fin.includes('register("prenom")'));
check("finalisation: dossier_complet true", fin.includes("dossier_complet: true"));
check("finalisation: photo obligatoire", fin.includes("La photo est obligatoire"));
check("finalisation: pas de saisie montant", !fin.includes('register("montantPaye")'));

const mgmt = readFileSync("./src/pages/RegistrationManagement.jsx", "utf8");
check("gestion: validation bloquée si incomplet", mgmt.includes("dossier_complet === false"));
check("gestion: badge À compléter", mgmt.includes("À compléter"));

const migQR = "./supabase/migrations/20261012_photo_sessions.sql";
check("migration photo_sessions existe", existsSync(migQR));
if (existsSync(migQR)) {
    const sql = readFileSync(migQR, "utf8");
    check("sessions: usage unique + 15 min", sql.includes("15 minutes") && sql.includes("UNIQUE"));
    check("sessions: temps réel publié", sql.includes("supabase_realtime"));
}

const appRoutes = readFileSync("./src/App.jsx", "utf8");
const scanIdx = appRoutes.indexOf('path="/scan/:token"');
check("route publique /scan/:token", scanIdx > 0 && !appRoutes.slice(0, scanIdx).split("\n").slice(-3).join("").includes("allowedRoles"));

const scan = readFileSync("./src/pages/ScanPhoto.jsx", "utf8");
check("scan: capture native téléphone", scan.includes('capture="environment"'));
check("scan: usage unique vérifié", scan.includes('"used"') && scan.includes("expired"));

const comp = readFileSync("./src/pages/InPersonRegistration.jsx", "utf8");
check("finalisation: bouton QR", comp.includes("Photo par téléphone"));
check("finalisation: aperçu à confirmer", comp.includes("Accepter") && comp.includes("remoteAccepted"));
check("finalisation: photo distante à la soumission", comp.includes("remotePhoto ? remotePhoto"));
check("finalisation: liste sans saisie code", comp.includes("Dossiers à compléter") && !comp.includes("code-recherche"));
check("finalisation: Genre coché visible", comp.includes("border-primary bg-primary/10"));

const migRef = "./supabase/migrations/20261013_reference_id_unique.sql";
check("migration codes uniques existe", existsSync(migRef));
if (existsSync(migRef)) {
    const sql = readFileSync(migRef, "utf8");
    check("codes: contrainte UNIQUE", sql.includes("inscriptions_reference_id_unique"));
    check("codes: compteur recalé + anti-course", sql.includes("GREATEST") && sql.includes("EXIT WHEN NOT EXISTS"));
}

if (failures > 0) {
    console.log(`\n${failures} échec(s)`);
    process.exit(1);
}
console.log("\nTous les contrôles préinscription OK");
