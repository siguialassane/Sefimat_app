# Connexion BD Supabase

Ce projet utilise Supabase via les variables du fichier `.env`.

## Regle simple

Toujours partir du `.env`, pas de l'outil MCP si son projet actif ne correspond pas.

Projet attendu:

- `VITE_SUPABASE_URL=https://ajtdfnplpbzansdkduvg.supabase.co`
- `VITE_SUPABASE_ANON_KEY=...`

## Probleme deja rencontre

1. Le MCP Supabase peut etre connecte a un autre projet.
2. Le terminal ne charge pas automatiquement les variables du `.env`.
3. L'endpoint `/rest/v1/` ne liste pas les tables avec une cle `anon`.

## Methode a utiliser demain

Depuis la racine du projet:

```bash
set -a
source .env
set +a
```

Verifier les variables:

```bash
printf '%s\n' "$VITE_SUPABASE_URL"
test -n "$VITE_SUPABASE_ANON_KEY" && echo "ANON KEY OK"
```

## Test de connexion qui marche

Tester une table connue avec l'API REST:

```bash
curl -s \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  "$VITE_SUPABASE_URL/rest/v1/chefs_quartier?select=id"
```

Si tu recois du JSON, la connexion a la bonne base fonctionne.

## Compter une table connue

```bash
curl -s -D - \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Prefer: count=exact" \
  "$VITE_SUPABASE_URL/rest/v1/chefs_quartier?select=id" \
  -o /dev/null | grep -i content-range
```

Exemple deja verifie:

- `chefs_quartier = 13`

## Pour compter une autre table

Remplacer `chefs_quartier` par un nom connu:

- `admin_users`
- `inscriptions`
- `paiements`
- `dortoirs`
- `classes`
- `notes_examens`
- `config_capacite_classes`

Exemple:

```bash
curl -s -D - \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Prefer: count=exact" \
  "$VITE_SUPABASE_URL/rest/v1/inscriptions?select=id" \
  -o /dev/null | grep -i content-range
```

## Limite importante

Avec la cle `anon`, tu peux interroger une table si tu connais deja son nom, mais tu ne peux pas lister automatiquement toutes les tables de la base via `/rest/v1/`.

Si demain il faut enumerer toutes les tables reelles de la base, il faudra soit:

1. une cle `service_role`
2. une connexion SQL directe
3. un MCP Supabase correctement rattache au bon projet

## Lancer l'application

Depuis la racine du projet:

```bash
npm run dev -- --host 0.0.0.0
```

Vite affichera ensuite l'URL locale a ouvrir dans le navigateur.