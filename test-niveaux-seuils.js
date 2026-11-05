import assert from "node:assert/strict";
import { choisirClasseDisponible, determinerNiveau, getSeuilsMap, plageNiveau, validerSeuils } from "./src/lib/niveaux.js";

for (const [note, niveau] of [
    [0, "niveau_1"], [7, "niveau_1"], [7.5, "niveau_2"],
    [8, "niveau_2"], [12, "niveau_2"], [12.5, "niveau_superieur"],
    [13, "niveau_superieur"], [20, "niveau_superieur"], [-1, null], [21, null],
]) assert.equal(determinerNiveau(note), niveau, "Note " + note);

assert.deepEqual(getSeuilsMap([]), { niveau_1: 7, niveau_2: 12 });
assert.equal(determinerNiveau(6, [{ niveau: "niveau_1", note_max: 5 }]), "niveau_2");
assert.deepEqual(plageNiveau("niveau_superieur", []), { min: 12, max: 20 });
assert.equal(validerSeuils(7, 12), null);
assert.ok(validerSeuils(12, 7));
assert.ok(validerSeuils(7, 20));
assert.ok(validerSeuils("x", 12));
const classes = [{ id: "a", capacite: 1 }, { id: "b", capacite: 2 }];
assert.equal(choisirClasseDisponible(classes, { a: 1 }, {}).id, "b");
assert.equal(choisirClasseDisponible(classes, { a: 1, b: 2 }, {}), null);
console.log("Règles des trois niveaux vérifiées.");
