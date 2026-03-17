# SEFIMAP — Instructions pour l'agent IA

## Vue d'ensemble
Application de gestion des inscriptions du **Séminaire de Formation Islamique** (Côte d'Ivoire). React 19 + Vite 7 + Tailwind CSS 4 + Supabase (DB/Storage) + Vercel.

## Architecture

### Routing & Rôles (4 espaces)
| Préfixe route | Layout | Rôle | Accès |
|---|---|---|---|
| `/inscription` | — | public | Formulaire d'inscription public |
| `/admin/*` | `AdminLayout` | `secretaire` | Dashboard, gestion inscriptions, badges, dortoirs, exports |
| `/finance/*` | `FinanceLayout` | `financier` | Validation paiements, suivi financier |
| `/scientifique/*` | `ScientifiqueLayout` | `scientifique` | Notes, classes, bulletins, tests d'entrée |
| `/president/:lienUnique/*` | `PresidentLayout` | president | Inscriptions & suivi paiements (accès par lien unique, sans login) |

### Provider hierarchy (`App.jsx`)
```
ThemeProvider → AuthProvider → DataProvider → BrowserRouter → Routes
```

### Données centralisées
`DataContext` charge **toutes** les tables en parallèle au démarrage et expose des helpers d'update optimiste (`addInscriptionLocal`, `updateInscriptionLocal`, `addPaiementLocal`, etc.). Auto-refresh toutes les 3 min.

## Code Style

- **Pas de default exports** — named exports uniquement (sauf exception rare)
- **Barrel exports** (`index.js`) dans chaque dossier : `@/contexts`, `@/pages`, `@/pages/finance`, `@/pages/president`, `@/pages/scientifique`, `@/components/layout`, `@/hooks`
- **Path alias** : `@/` → `./src/` (configuré dans `vite.config.js`)
- **Fichiers** : PascalCase `.jsx` pour composants/pages, camelCase `.js` pour utilitaires/hooks
- **CSS** : Tailwind avec tokens custom (`text-main`, `surface-light`, `primary`, etc.) + dark mode via classe. Utilitaire `cn()` = `clsx` + `tailwind-merge`
- **Icônes** : `lucide-react` exclusivement (+ un SVG custom `Mosque`)
- **Formulaires** : `react-hook-form` + `zod` via `@hookform/resolvers`
- **UI** : composants shadcn-like dans `src/components/ui/` (Button, Card, Input, Badge, etc.)
- **Langue UI** : Français. Commentaires en français.

## Base de données Supabase

### Tables principales
| Table | Description |
|---|---|
| `inscriptions` | Inscriptions des participants (nom, prénom, âge, sexe, niveau, photo, dortoir, paiement, workflow) |
| `paiements` | Paiements individuels (inscription_id, montant, mode, statut) |
| `chefs_quartier` | Présidents de section (nom, zone, école, `lien_unique` pour URL) |
| `dortoirs` | Dortoirs avec capacité |
| `classes` | Classes par niveau de formation |
| `notes_examens` | Notes (entrée, cahiers, conduite, sortie → moyenne auto-calculée par trigger) |
| `config_capacite_classes` | Capacité par défaut par niveau |
| `admin_users` | Mapping rôles admin |

### Enums (DB)
- `sexe`: `masculin`, `feminin`
- `niveau_etude`: `primaire`, `college`, `lycee`, `universite`, `autre`
- `niveau_formation`: `debutant`, `intermediaire`, `avance`
- `statut_inscription`: `en_attente`, `validee`, `rejetee`
- `type_inscription`: `en_ligne`, `presentielle`
- `statut_workflow`: `en_attente_finance`, `en_attente_secretariat`, `validee`, `rejetee`

### Vues SQL
- `vue_statistiques_dortoirs` — taux remplissage dortoirs
- `vue_statistiques_globales` — compteurs globaux inscriptions
- `vue_statistiques_niveaux_formation` — répartition par niveau

### Triggers importants
1. **`trigger_update_inscription_montant`** (sur `paiements`) — recalcule `montant_total_paye` et `statut_paiement`, auto-transition workflow `pending_finance` → `pending_secretariat` si montant ≥ 4000 FCFA
2. **`trigger_calculate_moyenne`** (sur `notes_examens`) — calcule la moyenne des 4 notes
3. **`trigger_set_president_workflow`** (sur `inscriptions` INSERT) — initialise `workflow_status = 'pending_finance'` pour `created_by = 'president'`

### Montant requis : **4000 FCFA**

### Workflow inscription président
```
Inscription (president) → pending_finance → [finance valide paiement] → pending_secretariat → [secrétariat valide + dortoir] → completed
```

### Convention colonnes DB
- Noms en `snake_case` — les variables JS gardent le même snake_case depuis les réponses Supabase
- UUIDs partout (`uuid_generate_v4()`)
- Timestamps avec timezone (`TIMESTAMPTZ DEFAULT NOW()`)

## Auth & Sécurité
- **Auth locale** (PAS Supabase Auth) — utilisateurs hardcodés dans `src/config/users.config.js`
- Session via `localStorage` ou `sessionStorage` (clé `sefimap_auth_user`)
- Supabase Auth désactivé (`persistSession: false`)
- Accès président par **lien unique** `/president/:lienUnique` validé contre `chefs_quartier.lien_unique`
- `ProtectedRoute` vérifie `useAuth().user`, redirige vers `/login` si null
- Supabase opère avec la clé `anon` — les RLS policies référencent `auth.role() = 'authenticated'`

## Build & Dev

```bash
bun install          # Installer les dépendances
bun run dev          # Serveur dev sur http://localhost:5155
bun run build        # Build de production
bun run lint         # ESLint
bun run preview      # Aperçu du build
```

**Variables d'environnement requises** (fichier `.env`) :
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_STORAGE=session   # optionnel: none|session|local
```

## Conventions de développement

- Toujours ajouter les nouveaux composants/pages aux barrel exports (`index.js`) du dossier concerné
- Utiliser `supabase.from('table').select/insert/update/upsert/delete` pour les opérations DB
- Photos uploadées dans le bucket Supabase Storage `photos-participants` via `src/lib/storage.js`
- Les layouts ont chacun une couleur d'accent : Admin=vert, Finance=emerald, Scientifique=bleu, Président=amber
- Composants multi-étapes : state `currentStep` + transition CSS `translateX`
- Pas de framework de test configuré
- Déploiement sur Vercel avec SPA fallback (`vercel.json`)

## Connexion MCP Supabase
L'agent est connecté à la BD Supabase du projet via le serveur MCP `supabase-sefi`. Utiliser les outils `mcp_supabase-sefi_*` pour requêter/modifier la base directement.
