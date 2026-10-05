// Périmètre "environnement secrétaire" : un dossier créé par un président de
// section n'est visible du secrétariat qu'après validation finance
// (workflow pending_secretariat ou completed). Tous les autres dossiers
// (présentiel / préinscriptions finance, argent encaissé direct) sont visibles.
// Source unique : liste secrétaire, exports, stats et dashboard utilisent ceci.

export const SECRETARIAT_WORKFLOW_OK = ['pending_secretariat', 'completed'];

export function isInSecretariatScope(row) {
    if (!row) return false;
    if (row.created_by === 'president') {
        return row.workflow_status === 'pending_secretariat' || row.workflow_status === 'completed';
    }
    return true;
}

// Filtre PostgREST équivalent pour les requêtes serveur (exports, compteurs).
export const SECRETARIAT_SCOPE_OR = 'created_by.neq.president,workflow_status.in.(pending_secretariat,completed)';

export function applySecretariatScope(query) {
    return query.or(SECRETARIAT_SCOPE_OR);
}
