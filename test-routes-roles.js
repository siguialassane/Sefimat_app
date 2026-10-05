// Test ciblé du verrouillage des routes par rôle (node test-routes-roles.js)
// Chaque cellule n'est accessible qu'à son rôle ; le lien public président
// (/president/:lienUnique) reste ouvert ; le dashboard président connecté
// (/admin/President) est réservé au rôle president.
import { readFileSync } from "node:fs";

let failures = 0;
function check(name, ok, detail = "") {
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " | " + detail : ""}`);
    if (!ok) failures++;
}

const app = readFileSync("./src/pages/../App.jsx", "utf8");
const conf = readFileSync("./src/config/users.config.js", "utf8");

check("admin -> secretaire", app.includes('path="/admin"') && app.includes('allowedRoles={["secretaire"]}'));
check("finance -> financier", app.includes('path="/finance"') && app.includes('allowedRoles={["financier"]}'));
check("scientifique -> scientifique", app.includes('path="/scientifique"') && app.includes('allowedRoles={["scientifique"]}'));
check("manager -> manager", app.includes('allowedRoles={["manager"]}'));
const presRoutes = (app.match(/allowedRoles=\{\["president"\]\}/g) || []).length;
check("/admin/President* -> president (3 routes)", presRoutes === 3, `${presRoutes} trouvées`);
check("lien public sans ProtectedRoute", /path="\/president\/:lienUnique" element=\{<PresidentLayout/.test(app));
check("aucun ProtectedRoute sans rôle", !/<ProtectedRoute>\s*<(Admin|Finance|Scientifique|Manager)Layout/.test(app));
check("redirect president -> /admin/President", conf.includes("president: '/admin/President'"));

if (failures > 0) {
    console.log(`\n${failures} échec(s)`);
    process.exit(1);
}
console.log("\nTous les contrôles routes/rôles OK");
