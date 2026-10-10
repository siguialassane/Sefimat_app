// Règle pépinière : un dossier marqué est_pepiniere (case manuelle du
// secrétaire) garde son badge mais est exclu de TOUTE la cellule
// scientifique : test d'entrée, notes, classes, bulletins, statistiques.
// Source unique : toutes les pages scientifiques utilisent ces helpers.

export function isExcluScientifique(inscription) {
    return inscription?.est_pepiniere === true;
}

// Filtre une liste de notes_examens (jointure inscription incluse).
export function sansPepiniereNotes(notes) {
    return (notes || []).filter(n => !isExcluScientifique(n?.inscription));
}
