// Test ciblé des règles finance (node test-finance-rules.js)
// Couvre : blocage président après validation, annulation partielle,
// "ajouter un paiement" (jamais de régression workflow), reliquat non dû.
import {
    canAddPayment,
    canCancelFinanceValidation,
    getAbandonedAmount,
    getRemainingDue,
    getRequiredAmount,
    isFinanceApproved,
    isFinanceValidationPending,
    isPresidentBlockedForPayment,
} from "./src/lib/finance.js";

let failures = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "✅" : "❌"} ${name}`);
    if (!ok) {
        failures++;
        console.log(`   attendu: ${JSON.stringify(expected)} | reçu: ${JSON.stringify(actual)}`);
    }
}

const president = (overrides) => ({
    created_by: "president",
    workflow_status: "pending_finance",
    statut_paiement: "partiel",
    montant_total_paye: 3000,
    montant_requis: 4000,
    montant_non_du: 0,
    ...overrides,
});
const guichet = (overrides) => ({
    created_by: "secretariat",
    type_inscription: "presentielle",
    statut_workflow: "valide",
    statut: "valide",
    statut_paiement: "partiel",
    montant_total_paye: 3000,
    montant_requis: 4000,
    ...overrides,
});

// 1. Dossier président en attente finance : encaissements ouverts, pas d'annulation
{
    const i = president({});
    check("pending_finance: en attente validation", isFinanceValidationPending(i), true);
    check("pending_finance: pas bloqué", isPresidentBlockedForPayment(i), false);
    check("pending_finance: ajout paiement OK", canAddPayment(i), true);
    check("pending_finance: annulation impossible", canCancelFinanceValidation(i), false);
    check("pending_finance: reste dû 1000", getRemainingDue(i), 1000);
}

// 2. Après validation finance (partiel 3000/4000) : bloqué, annulable, reste non dû
{
    const i = president({ workflow_status: "pending_secretariat", statut_paiement: "valide_financier", montant_non_du: 1000 });
    check("validé partiel: approuvé finance", isFinanceApproved(i), true);
    check("validé partiel: président bloqué", isPresidentBlockedForPayment(i), true);
    check("validé partiel: ajout paiement refusé", canAddPayment(i), false);
    check("validé partiel: annulation possible", canCancelFinanceValidation(i), true);
    check("validé partiel: reste dû 0", getRemainingDue(i), 0);
    check("validé partiel: abandonné 1000", getAbandonedAmount(i), 1000);
}

// 3. Validation complète (4000) : pas d'annulation possible
{
    const i = president({ workflow_status: "pending_secretariat", statut_paiement: "valide_financier", montant_total_paye: 4000, montant_non_du: 0 });
    check("validé complet: annulation impossible", canCancelFinanceValidation(i), false);
    check("validé complet: ajout paiement refusé (soldé)", canAddPayment(i), false);
}

// 4. Dossier terminé avec reliquat : le président peut compléter SANS régression
{
    const i = president({ workflow_status: "completed", statut: "valide", montant_non_du: 1000 });
    check("completed: pas bloqué", isPresidentBlockedForPayment(i), false);
    check("completed: ajout paiement OK", canAddPayment(i), true);
    check("completed: annulation impossible", canCancelFinanceValidation(i), false);
}

// 5. Guichet : jamais bloqué, jamais annulable, reste toujours dû
{
    const i = guichet({});
    check("guichet: pas bloqué", isPresidentBlockedForPayment(i), false);
    check("guichet: ajout paiement OK", canAddPayment(i), true);
    check("guichet: annulation impossible", canCancelFinanceValidation(i), false);
    check("guichet: reste dû 1000", getRemainingDue(i), 1000);
}

// 6. Rejeté : aucun ajout
{
    const i = president({ workflow_status: "rejected", statut_paiement: "refuse" });
    check("rejeté: ajout paiement refusé", canAddPayment(i), false);
}

// 7. Montant requis personnalisé
{
    const i = president({ montant_requis: 5000, montant_total_paye: 3000 });
    check("requis custom: 5000", getRequiredAmount(i), 5000);
    check("requis custom: reste dû 2000", getRemainingDue(i), 2000);
}

if (failures > 0) {
    console.error(`\n❌ ${failures} échec(s)`);
    process.exit(1);
}
console.log("\n✅ Toutes les règles finance sont vérifiées");
