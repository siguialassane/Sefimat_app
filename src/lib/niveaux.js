// Règles note d'entrée -> niveau, pilotées par la table config_seuils_niveaux.
// note_max = borne haute INCLUSIVE de chaque niveau (croissantes).
// Tout ce qui dépasse le max du niveau 3 va au niveau supérieur.

export const NIVEAUX = ['niveau_1', 'niveau_2', 'niveau_3', 'niveau_superieur'];

export const NIVEAU_LABELS = {
    niveau_1: 'Niveau 1',
    niveau_2: 'Niveau 2',
    niveau_3: 'Niveau 3',
    niveau_superieur: 'Niveau Supérieur',
};

export const DEFAULT_SEUILS = { niveau_1: 5, niveau_2: 10, niveau_3: 14 };

export const NOTE_MIN = 0;
export const NOTE_MAX = 20;

// Lignes brutes { niveau, note_max } -> { niveau_1: x, niveau_2: y, niveau_3: z }
export function getSeuilsMap(configRows) {
    const map = { ...DEFAULT_SEUILS };
    for (const row of configRows || []) {
        const v = parseFloat(row?.note_max);
        if (row?.niveau in map && !isNaN(v)) {
            map[row.niveau] = v;
        }
    }
    return map;
}

export function determinerNiveau(note, configRows) {
    const seuils = getSeuilsMap(configRows);
    const n = parseFloat(note);
    if (isNaN(n)) return null;
    if (n <= seuils.niveau_1) return 'niveau_1';
    if (n <= seuils.niveau_2) return 'niveau_2';
    if (n <= seuils.niveau_3) return 'niveau_3';
    return 'niveau_superieur';
}

// Plage d'affichage d'un niveau, ex: { min: 5, max: 10 } -> "Note 5 à 10"
export function plageNiveau(niveau, configRows) {
    const seuils = getSeuilsMap(configRows);
    if (niveau === 'niveau_1') return { min: NOTE_MIN, max: seuils.niveau_1 };
    if (niveau === 'niveau_2') return { min: seuils.niveau_1, max: seuils.niveau_2 };
    if (niveau === 'niveau_3') return { min: seuils.niveau_2, max: seuils.niveau_3 };
    return { min: seuils.niveau_3, max: NOTE_MAX };
}

// Choisit la première classe (triées par numero croissant) ayant encore de la
// place. effectifs = { classeId: nb }, extra = réservations en cours d'un lot
// (ex: enregistrement groupé, pour ne pas entasser tout le lot dans la 1re
// classe avant le re-rendu React). Retourne la classe ou null (à créer).
export function choisirClasseDisponible(classesTriees, effectifs, extra) {
    const plus = extra || {};
    for (const classe of classesTriees || []) {
        const pris = (effectifs?.[classe.id] || 0) + (plus[classe.id] || 0);
        if (pris < classe.capacite) {
            return classe;
        }
    }
    return null;
}

// Validation d'un triplet de seuils saisis : 0 < s1 < s2 < s3 < 20
export function validerSeuils(s1, s2, s3) {
    const vals = [s1, s2, s3].map(v => parseFloat(v));
    if (vals.some(v => isNaN(v))) return "Les trois seuils doivent être des nombres.";
    const [a, b, c] = vals;
    if (a <= NOTE_MIN || c >= NOTE_MAX) return "Les seuils doivent être entre 0 et 20 (exclus).";
    if (!(a < b && b < c)) return "Les seuils doivent être strictement croissants (Niveau 1 < Niveau 2 < Niveau 3).";
    return null;
}
