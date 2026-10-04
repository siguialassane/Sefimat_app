// Test ciblé des exports secrétariat (node test-exports-labels.js)
// Verrouille : libellés CSV (le "Excel" produisait un .csv), pas d'historique
// factice avec boutons morts, noms de fichiers .csv côté finance.
import { readFileSync } from "node:fs";

let failures = 0;
function check(name, ok, detail = "") {
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " | " + detail : ""}`);
    if (!ok) failures++;
}

const exportsPage = readFileSync("./src/pages/Exports.jsx", "utf8");
check("Exports: bouton 'Télécharger CSV'", exportsPage.includes("Télécharger CSV"));
check("Exports: bouton 'CSV Filtré'", exportsPage.includes("CSV Filtré"));
check("Exports: aucun libellé Excel restant", !/[Ee]xcel/.test(exportsPage));
check("Exports: pas d'historique factice", !/Historique des exports|20241012|rapport_abobo/.test(exportsPage));
check("Exports: format csv câblé", exportsPage.includes('handleExport("csv"'));
check("Exports: fichiers .csv", exportsPage.includes("export_complet") && exportsPage.includes(".csv"));

const paymentList = readFileSync("./src/pages/finance/PaymentList.jsx", "utf8");
check("Versements: export .csv", paymentList.includes("versements_") && paymentList.includes(".csv"));

const paymentSummary = readFileSync("./src/pages/finance/PaymentSummary.jsx", "utf8");
check("Synthèse: export .csv", paymentSummary.includes("recapitulatif_paiements_") && paymentSummary.includes(".csv"));

if (failures > 0) {
    console.log(`\n${failures} échec(s)`);
    process.exit(1);
}
console.log("\nTous les contrôles exports OK");
