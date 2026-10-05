export const REQUIRED_PAYMENT_AMOUNT = 5000;

// Modèle caisse : DEHORS = versements déclarés non réceptionnés (statut
// 'attente'), DEDANS = versements cochés reçus (statut 'validé', cumulés dans
// montant_valide). Le reste dû (getRemainingDue) est indépendant de la
// réception : un dossier validé partiel reste dû jusqu'au bout (scénario 2a).

export function getRequiredAmount(inscription) {
    return inscription?.montant_requis || REQUIRED_PAYMENT_AMOUNT;
}

export function isPresidentRegistration(inscription) {
    return inscription?.created_by === "president";
}

export function isFinanceValidationPending(inscription) {
    return isPresidentRegistration(inscription) && inscription?.workflow_status === "pending_finance";
}

export function isFinanceRejected(inscription) {
    return inscription?.statut_paiement === "refuse" || inscription?.workflow_status === "rejected";
}

export function isFinanceApproved(inscription) {
    if (!inscription) return false;

    if (isPresidentRegistration(inscription)) {
        return (
            inscription?.statut_paiement === "valide_financier" ||
            inscription?.workflow_status === "pending_secretariat" ||
            inscription?.workflow_status === "completed"
        );
    }

    return inscription?.statut_paiement === "valide_financier" || inscription?.statut_paiement === "soldé";
}

export function isFullyPaid(inscription) {
    // Soldé = de l'argent encaissé ET plus rien de dû (le reliquat abandonné
    // par la finance n'est pas une dette : requis - payé - non_du = 0).
    return (inscription?.montant_total_paye || 0) > 0 && getRemainingDue(inscription) === 0;
}

export function getFinanceCollectedAmount(inscription) {
    // Argent DEDANS : somme des versements cochés reçus (colonne maintenue
    // par le trigger, indépendante du workflow du dossier).
    if (!inscription) return 0;
    return inscription?.montant_valide || 0;
}

export function getPendingAmount(inscription) {
    // Argent DEHORS : déclaré mais pas encore réceptionné en caisse.
    if (!inscription) return 0;
    return Math.max(0, (inscription?.montant_total_paye || 0) - getFinanceCollectedAmount(inscription));
}

export function shouldCountInFinanceTotals(inscription) {
    if (!inscription) return false;
    if (!isPresidentRegistration(inscription)) return true;
    return isFinanceApproved(inscription);
}

export function getFinanceStatusKey(inscription) {
    if (isFinanceRejected(inscription)) {
        return "refuse";
    }

    if (
        (isFinanceValidationPending(inscription) || inscription?.statut_paiement === "en_attente_validation") &&
        (inscription?.montant_total_paye || 0) > 0
    ) {
        return "en_attente_validation";
    }

    if (isFinanceApproved(inscription)) {
        return "valide_financier";
    }

    if (isFullyPaid(inscription)) {
        return "solde";
    }

    if (inscription?.statut_paiement === "partiel") {
        return "partiel";
    }

    return "non_payé";
}

export function getFinanceStatusMeta(inscription) {
    switch (getFinanceStatusKey(inscription)) {
        case "refuse":
            return { label: "Refusé", variant: "destructive" };
        case "en_attente_validation":
            return { label: "En attente validation", variant: "warning" };
        case "valide_financier":
            return { label: "Validé finance", variant: "success" };
        case "solde":
            return { label: "Soldé", variant: "success" };
        case "partiel":
            return { label: "Partiel", variant: "warning" };
        default:
            return { label: "Non payé", variant: "secondary" };
    }
}

export function getFinanceBadgeClasses(variant) {
    // Pastilles adaptatives : teintées en mode clair, translucides en mode sombre.
    switch (variant) {
        case "success":
            return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300";
        case "warning":
            return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
        case "destructive":
            return "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300";
        default:
            return "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300";
    }
}
export function getAbandonedAmount(inscription) {
    return inscription?.montant_non_du || 0;
}

export function getRemainingDue(inscription) {
    return Math.max(
        0,
        getRequiredAmount(inscription) -
            (inscription?.montant_total_paye || 0) -
            getAbandonedAmount(inscription)
    );
}

// Plafond d'encaissement : requis - déclaré, SANS déduire le reliquat abandonné.
// Le non-dû n'est pas une dette (voir getRemainingDue) mais reste encaissable :
// tout complément réduit le reliquat au lieu de créer un trop-perçu.
// Utilisé par les dialogs de paiement (montant max) et canAddPayment.
export function getMaxAcceptablePayment(inscription) {
    if (!inscription) return 0;
    return Math.max(0, getRequiredAmount(inscription) - (inscription?.montant_total_paye || 0));
}

// --- Versements (caisse) : 'attente' (dehors) -> 'validé' (dedans) | 'refuse' (annulé, motif).
export function isVersementValidated(paiement) {
    return paiement?.statut === "validé";
}

export function isVersementRefused(paiement) {
    return paiement?.statut === "refuse";
}

export function isVersementPending(paiement) {
    return !isVersementValidated(paiement) && !isVersementRefused(paiement);
}

export function getVersementStatusMeta(paiement) {
    if (isVersementRefused(paiement)) {
        return { label: "Refusé", variant: "destructive" };
    }
    if (isVersementValidated(paiement)) {
        return { label: "Reçu", variant: "success" };
    }
    return { label: "En attente", variant: "warning" };
}

export function canCancelFinanceValidation(inscription) {
    if (!isPresidentRegistration(inscription)) return false;
    if (inscription?.workflow_status !== "pending_secretariat") return false;
    return (inscription?.montant_total_paye || 0) < getRequiredAmount(inscription);
}

export function canUnrejectFinance(inscription) {
    if (!inscription) return false;
    if (!isFinanceRejected(inscription)) return false;
    if (isFinanceValidationPending(inscription) || isFinanceApproved(inscription)) return false;
    return true;
}

export function canAddPayment(inscription) {
    if (!inscription) return false;
    if (isFinanceRejected(inscription)) return false;
    // Scénario 2a : le président continue d'encaisser même après validation
    // du dossier (plus de blocage à pending_secretariat).
    return getMaxAcceptablePayment(inscription) > 0;
}

// Abandon du reliquat : geste finance irréversible et SÉPARÉ de la validation
// (scénario 2a : valider n'abandonne plus). Disponible sur dossier en attente
// comme validé, tant qu'il reste une dette.
export function canAbandonRemainder(inscription) {
    if (!inscription) return false;
    if (isFinanceRejected(inscription)) return false;
    return getRemainingDue(inscription) > 0;
}

// Scénario 1 : transition automatique après réception en caisse.
// Quand le montant REÇU (dedans) couvre le requis, la dette est éteinte :
// - dossier président pas encore validé -> auto-validation vers le secrétariat
//   (le clic "Valider le dossier" devient inutile) ;
// - dossier déjà en route (ou hors workflow président) -> simple marquage "soldé".
// Retourne null si rien à faire (partiel, dossier refusé, déjà soldé).
export function getPostReceptionDossierUpdate(inscription, montantRecu, acteurId, dateIso) {
    if (!inscription || isFinanceRejected(inscription)) return null;
    const nouveauValide = (inscription.montant_valide || 0) + (montantRecu || 0);
    if (nouveauValide < getRequiredAmount(inscription)) return null;
    // Note : un dossier président peut déjà afficher "soldé" (déclaré) tout en
    // étant pending_finance : l'avance vers le secrétariat reste due.
    const update = { statut_paiement: "soldé" };
    let autoAdvanced = false;
    if (isPresidentRegistration(inscription) && !isFinanceApproved(inscription)) {
        update.workflow_status = "pending_secretariat";
        update.valide_par_financier = acteurId || null;
        update.date_validation_financier = dateIso || null;
        autoAdvanced = true;
    } else if (inscription.statut_paiement === "soldé") {
        return null; // déjà soldé et déjà en route (ou hors workflow) : rien à faire
    }
    return { update, autoAdvanced };
}

export function getOriginLabel(inscription) {
    return isPresidentRegistration(inscription) ? "Président" : "Guichet";
}
