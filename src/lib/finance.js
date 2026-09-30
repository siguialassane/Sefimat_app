export const REQUIRED_PAYMENT_AMOUNT = 4000;

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
    if (!inscription) return 0;
    if (isPresidentRegistration(inscription) && !isFinanceApproved(inscription)) {
        return 0;
    }
    return inscription?.montant_total_paye || 0;
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
    switch (variant) {
        case "success":
            return "bg-emerald-500 text-white";
        case "warning":
            return "bg-amber-500 text-white";
        case "destructive":
            return "bg-red-500 text-white";
        default:
            return "bg-gray-500 text-white";
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

export function isPresidentBlockedForPayment(inscription) {
    return (
        isPresidentRegistration(inscription) &&
        inscription?.workflow_status === "pending_secretariat"
    );
}

export function canCancelFinanceValidation(inscription) {
    if (!isPresidentRegistration(inscription)) return false;
    if (inscription?.workflow_status !== "pending_secretariat") return false;
    return (inscription?.montant_total_paye || 0) < getRequiredAmount(inscription);
}

export function canAddPayment(inscription) {
    if (!inscription) return false;
    if (isFinanceRejected(inscription)) return false;
    if (isPresidentBlockedForPayment(inscription)) return false;
    return (inscription?.montant_total_paye || 0) < getRequiredAmount(inscription);
}

export function getOriginLabel(inscription) {
    return isPresidentRegistration(inscription) ? "Président" : "Guichet";
}
