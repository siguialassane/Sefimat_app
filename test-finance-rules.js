// Test ciblé des règles finance (node test-finance-rules.js)
// Couvre : blocage président après validation, annulation partielle,
// "ajouter un paiement" (jamais de régression workflow), reliquat non dû.
import {
    canAbandonRemainder,
    canAddPayment,
    canCancelFinanceValidation,
    canUnrejectFinance,
    getPostReceptionDossierUpdate,
    getAbandonedAmount,
    getFinanceCollectedAmount,
    getMaxAcceptablePayment,
    getPendingAmount,
    getRemainingDue,
    getVersementStatusMeta,
    isVersementPending,
    isVersementRefused,
    isVersementValidated,
    getRequiredAmount,
    isFinanceApproved,
    isFinanceValidationPending,
    isFullyPaid,
    REQUIRED_PAYMENT_AMOUNT,
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
    montant_requis: 5000,
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
    montant_requis: 5000,
    ...overrides,
});

// 1. Dossier président en attente finance : encaissements ouverts, pas d'annulation
{
    const i = president({});
    check("pending_finance: en attente validation", isFinanceValidationPending(i), true);
    check("pending_finance: ajout paiement OK", canAddPayment(i), true);
    check("pending_finance: annulation impossible", canCancelFinanceValidation(i), false);
    check("pending_finance: reste dû 2000", getRemainingDue(i), 2000);
}

// 2. Après validation finance (partiel 3000/5000 + abandon 2000) : 2a = le
// président CONTINUE d'encaisser (complément possible), annulation possible.
{
    const i = president({ workflow_status: "pending_secretariat", statut_paiement: "valide_financier", montant_non_du: 2000 });
    check("validé partiel: approuvé finance", isFinanceApproved(i), true);
    check("2a: ajout paiement OK (complément)", canAddPayment(i), true);
    check("validé partiel: annulation possible", canCancelFinanceValidation(i), true);
    check("validé partiel: reste dû 0", getRemainingDue(i), 0);
    check("validé partiel: abandonné 2000", getAbandonedAmount(i), 2000);
}

// 3. Validation complète (5000) : pas d'annulation possible
{
    const i = president({ workflow_status: "pending_secretariat", statut_paiement: "valide_financier", montant_total_paye: 5000, montant_non_du: 0 });
    check("validé complet: annulation impossible", canCancelFinanceValidation(i), false);
    check("validé complet: ajout paiement refusé (soldé)", canAddPayment(i), false);
}

// 4. Dossier terminé avec reliquat : le président peut compléter SANS régression
{
    const i = president({ workflow_status: "completed", statut: "valide", montant_non_du: 1000 });
    check("completed: ajout paiement OK", canAddPayment(i), true);
    check("completed: annulation impossible", canCancelFinanceValidation(i), false);
}

// 5. Guichet : jamais bloqué, jamais annulable, reste toujours dû
{
    const i = guichet({});
    check("guichet: ajout paiement OK", canAddPayment(i), true);
    check("guichet: annulation impossible", canCancelFinanceValidation(i), false);
    check("guichet: reste dû 2000", getRemainingDue(i), 2000);
}

// 6. Rejeté : aucun ajout, mais réouverture possible
{
    const i = president({ workflow_status: "rejected", statut_paiement: "refuse" });
    check("rejeté: ajout paiement refusé", canAddPayment(i), false);
    check("rejeté: réouverture possible", canUnrejectFinance(i), true);
    check("rejeté: pas soldé", isFullyPaid(i), false);
    const ok = president({ workflow_status: "pending_finance", statut_paiement: "partiel" });
    check("non rejeté: réouverture impossible", canUnrejectFinance(ok), false);
}

// 7. Soldé = encaissé ET rien de dû (le non-dû n'est pas une dette)
{
    check("soldé: 5000/5000", isFullyPaid(president({ montant_total_paye: 5000, montant_non_du: 0 })), true);
    check("soldé: partiel validé 3000+2000 non dus", isFullyPaid(president({ workflow_status: "pending_secretariat", statut_paiement: "valide_financier", montant_non_du: 2000 })), true);
    check("soldé: partiel en attente non", isFullyPaid(president({})), false);
    check("soldé: 0 payé non", isFullyPaid(president({ montant_total_paye: 0 })), false);
    check("soldé: guichet partiel non", isFullyPaid(guichet({})), false);
    check("soldé: guichet complet oui", isFullyPaid(guichet({ montant_total_paye: 5000, statut_paiement: "soldé" })), true);
}

// 8. Montant requis personnalisé
{
    const i = president({ montant_requis: 6000, montant_total_paye: 3000 });
    check("requis custom: 6000", getRequiredAmount(i), 6000);
    check("requis custom: reste dû 3000", getRemainingDue(i), 3000);
}

// 9. Cohérence président/finance : "reste dû" unique, "plafond accepté" distinct.
// Le reste dû ne dépend jamais du statut de validation ; le plafond d'encaissement
// reste requis - déclaré (le reliquat abandonné se réduit si l'argent arrive).
{
    const pending = president({ montant_total_paye: 3000, montant_non_du: 0 });
    const validated = president({ workflow_status: "pending_secretariat", statut_paiement: "valide_financier", montant_total_paye: 3000, montant_non_du: 0 });
    check("cohérence: reste dû pending = 2000", getRemainingDue(pending), 2000);
    check("cohérence: reste dû validé identique", getRemainingDue(validated), 2000);
    check("cohérence: plafond pending = 2000", getMaxAcceptablePayment(pending), 2000);

    const abandoned = president({ workflow_status: "completed", statut: "valide", montant_total_paye: 3000, montant_non_du: 1000 });
    check("cohérence: reste dû abandonné = 1000", getRemainingDue(abandoned), 1000);
    check("cohérence: plafond abandonné = 2000 (complément possible)", getMaxAcceptablePayment(abandoned), 2000);
    check("cohérence: ajout paiement OK sur abandonné", canAddPayment(abandoned), true);

    check("cohérence: plafond soldé = 0", getMaxAcceptablePayment(president({ montant_total_paye: 5000, montant_non_du: 0 })), 0);
    check("cohérence: plafond requis custom = 3000", getMaxAcceptablePayment(president({ montant_requis: 6000, montant_total_paye: 3000 })), 3000);
    check("cohérence: plafond nul sans dossier", getMaxAcceptablePayment(null), 0);
    check("cohérence: plafond guichet partiel = 2000", getMaxAcceptablePayment(guichet({})), 2000);
}

// 10. Modèle caisse : DEDANS (versements cochés) vs DEHORS (en attente),
// indépendants du workflow du dossier.
{
    const pending = president({ montant_total_paye: 3000, montant_valide: 1500, montant_non_du: 0 });
    check("caisse: dedans = montant_valide", getFinanceCollectedAmount(pending), 1500);
    check("caisse: dehors = déclaré - validé", getPendingAmount(pending), 1500);
    check("caisse: reste dû indépendant de la réception", getRemainingDue(pending), 2000);

    const toutDehors = president({ montant_total_paye: 3000, montant_valide: 0, montant_non_du: 0 });
    check("caisse: dedans 0 si rien coché", getFinanceCollectedAmount(toutDehors), 0);
    check("caisse: dehors = tout le déclaré", getPendingAmount(toutDehors), 3000);

    check("caisse: dedans nul sans dossier", getFinanceCollectedAmount(null), 0);
    check("caisse: dehors nul sans dossier", getPendingAmount(null), 0);
    check("caisse: dehors plancher à 0", getPendingAmount(president({ montant_total_paye: 1000, montant_valide: 2000 })), 0);

    check("versement attente détecté", isVersementPending({ statut: "attente" }), true);
    check("versement NULL = attente (prudent)", isVersementPending({}), true);
    check("versement reçu détecté", isVersementValidated({ statut: "validé" }), true);
    check("versement refusé détecté", isVersementRefused({ statut: "refuse" }), true);
    check("versement reçu n'est pas en attente", isVersementPending({ statut: "validé" }), false);
    check("versement libellé Reçu", getVersementStatusMeta({ statut: "validé" }).label, "Reçu");
    check("versement libellé En attente", getVersementStatusMeta({ statut: "attente" }).label, "En attente");
    check("versement libellé Refusé", getVersementStatusMeta({ statut: "refuse" }).label, "Refusé");
}

// 11. Abandon séparé (2a) + auto-transition caisse (scénario 1).
{
    const attente = president({});
    check("abandon: possible sur dossier en attente", canAbandonRemainder(attente), true);
    const validePartiel = president({ workflow_status: "pending_secretariat", statut_paiement: "valide_financier" });
    check("abandon: possible sur dossier validé partiel", canAbandonRemainder(validePartiel), true);
    check("abandon: impossible si rien à abandonner", canAbandonRemainder(president({ montant_total_paye: 5000 })), false);
    check("abandon: impossible sur dossier refusé", canAbandonRemainder(president({ workflow_status: "rejected", statut_paiement: "refuse" })), false);

    // Réception qui solde un dossier président en attente -> auto-validation secrétariat.
    const aSolder = president({ montant_total_paye: 4000, montant_valide: 3500 });
    const auto = getPostReceptionDossierUpdate(aSolder, 1500, "fin1", "2026-10-02T10:00:00Z");
    check("auto: transition déclenchée", auto !== null, true);
    check("auto: part au secrétariat", auto.update.workflow_status, "pending_secretariat");
    check("auto: statut soldé", auto.update.statut_paiement, "soldé");
    check("auto: trace acteur", auto.update.valide_par_financier, "fin1");
    check("auto: flag autoAdvanced", auto.autoAdvanced, true);

    // Réception partielle -> rien.
    check("auto: partiel sans effet", getPostReceptionDossierUpdate(president({ montant_valide: 1000 }), 1500, "fin1", "x"), null);
    // Dossier déjà validé partiel qui se solde -> marquage soldé seul.
    const dejaValide = president({ workflow_status: "pending_secretariat", statut_paiement: "valide_financier", montant_total_paye: 4000, montant_valide: 4500 });
    const marque = getPostReceptionDossierUpdate(dejaValide, 500, "fin1", "x");
    check("auto: dossier en route marqué soldé", marque.update.statut_paiement, "soldé");
    check("auto: pas de re-validation", marque.autoAdvanced, false);
    check("auto: workflow inchangé", marque.update.workflow_status, undefined);
    // Guichet -> marquage soldé seul (pas de workflow président).
    const g = guichet({ montant_total_paye: 5000, montant_valide: 4000 });
    const marqueGuichet = getPostReceptionDossierUpdate(g, 1000, "fin1", "x");
    check("auto: guichet marqué soldé", marqueGuichet.update.statut_paiement, "soldé");
    check("auto: guichet sans avance workflow", marqueGuichet.autoAdvanced, false);
    // Dossier refusé ou déjà soldé en route -> rien.
    check("auto: refusé sans effet", getPostReceptionDossierUpdate(president({ workflow_status: "rejected", statut_paiement: "refuse", montant_valide: 0 }), 4000, "fin1", "x"), null);
    check("auto: déjà soldé en route sans effet", getPostReceptionDossierUpdate(president({ workflow_status: "pending_secretariat", statut_paiement: "soldé", montant_valide: 4000 }), 0, "fin1", "x"), null);
    // Dossier président "soldé déclaré" mais pending_finance -> avance quand même.
    const soldeDeclare = president({ statut_paiement: "soldé", montant_total_paye: 5000, montant_valide: 0 });
    const autoSolde = getPostReceptionDossierUpdate(soldeDeclare, 5000, "fin1", "x");
    check("auto: soldé déclaré avance au secrétariat", autoSolde?.autoAdvanced, true);
}

if (failures > 0) {
    console.error(`\n❌ ${failures} échec(s)`);
    process.exit(1);
}
console.log("\n✅ Toutes les règles finance sont vérifiées");

// 12. Prix de participation : 5000 FCFA partout par défaut.
{
    check("requis par défaut = 5000", REQUIRED_PAYMENT_AMOUNT, 5000);
    check("requis par défaut appliqué", getRequiredAmount({}), 5000);
}
