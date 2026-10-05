# Jeu synthétique du staging hébergé

Ce workflow opérateur prépare **ifosse-staging** pour le pilote avec des personnes, niveaux, CACI et séances entièrement inventés. Il ne copie aucune donnée du club ou de production et ne remplace pas les comptes des organisateurs. **Production est explicitement non supportée.** Le seed n’est jamais lancé par Netlify, le navigateur, les migrations ou CI.

## Préparation et commandes

Après revue du PR, appliquer la migration `20261005010000_staging_seed.sql` séparément **sur staging**, selon la procédure habituelle de migrations. Elle installe deux RPC opérateur et un registre privé, sans créer de fixtures. Aucun déploiement/migration hébergé n’est effectué par la préparation du PR.

Dans un terminal opérateur privé, fournir ces variables (aucun préfixe `VITE_`) :

| Variable | Valeur/contrainte |
| --- | --- |
| `SUPABASE_URL` | Exactement `https://btpojwwwsxrepsehmxbm.supabase.co` |
| `SUPABASE_PROJECT_ENV` | Exactement `preview`, marqueur existant pour staging |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT **legacy service_role** du projet staging, fourni uniquement par l’environnement opérateur privé |

Les variables doivent être **exportées dans le terminal qui lance npm**; le script Node ne charge pas `.env.local` et les variables `VITE_*` ne configurent pas l’opérateur. Exemple Bash, sans clé dans l’historique :

```sh
export SUPABASE_URL=https://btpojwwwsxrepsehmxbm.supabase.co
export SUPABASE_PROJECT_ENV=preview
read -r -s -p "Staging legacy service-role JWT: " SUPABASE_SERVICE_ROLE_KEY
export SUPABASE_SERVICE_ROLE_KEY
```

Coller la clé uniquement dans cette invite masquée, jamais dans le chat. Après usage, `unset SUPABASE_SERVICE_ROLE_KEY`. Un échec affiche uniquement une catégorie sûre (configuration manquante, cible/clé refusée, RPC absent, collision ou propriété incohérente), jamais le message brut du fournisseur. Le preflight sans `--apply` reste sans écriture.

Ne pas enregistrer la clé dans le dépôt, des fixtures, la documentation, Netlify ou un frontend. Le format `sb_secret_…` est volontairement refusé : ce workflow exige le claim signé `ref` du JWT pour une vérification positive du projet côté RPC. Ne jamais utiliser une clé production.

```sh
npm run staging:seed
npm run staging:seed -- --apply
```

Le premier passage est une **prévalidation en lecture seule sur staging**, pas une validation offline. Il vérifie aussi l’installation des RPC et les collisions d’identité, affiche projet/URL/ref, action, date d’ancrage et volumes de référence (30 membres, 7 séances, 210 réponses, publications, voitures, passagers, palanquées, bilans), puis confirme qu’aucune écriture n’a été faite. Les détails du fournisseur, tokens et clés ne sont jamais affichés.

`--apply` crée les identités synthétiques manquantes via Auth Admin `createUser`, sans email, invitation ou password. Il appelle ensuite un seul RPC transactionnel pour les profils et séances. Les profils utilisent `provision_member`; niveaux/habitudes, CACI, réponses, paiement, sélection, publication, voitures, passagers, désistement, palanquées et bilan réutilisent les RPC métier avec leurs contraintes et triggers habituels. Une promotion opérateur concerne uniquement le nouveau profil synthétique nº 1 (admin), auditée; la présidence reste intacte.

## Protections et répétition

- L’URL/ref staging est **fixée dans le code**, sans option de remplacement; le marqueur explicite `preview` est obligatoire. Une URL production, même déclarée preview, une variable absente, une clé du mauvais projet ou un format non vérifiable bloque avant toute écriture.
- Le preflight et l’apply exigent aussi côté PostgreSQL `role=service_role` et le `ref` staging dans le JWT vérifié par la passerelle. Aucun appel anon/authenticated, même président, ne peut utiliser ces RPC. Le registre ne possède aucun accès navigateur.
- Les emails réservés sont `plongeur-01@ifosse-seed.invalid` à `plongeur-30@ifosse-seed.invalid`. Auth porte le marqueur opérateur `app_metadata.ifosse_staging_seed=ifosse-staging-v1`. Les noms portent « (fictif) » et les titres de séances « [FICTIF] ».
- Un email déjà utilisé par une identité non marquée **ou un profil existant** bloque : il n’est jamais adopté, renommé ou promu. Aucun profil/compte réel n’est inclus dans les opérations métier du seed.
- Le registre privé `staging_seed_runs` conserve la version, l’ancrage et les UUID exacts des 30 Auth/profils et 7 séances. Un verrou transactionnel sérialise les applies, puis la possession des identités est revérifiée.
- Un rerun conserve tout **sans écriture**, y compris corrections des testeurs, réponses ajoutées, rôles, paiements et changements de dates. Les volumes affichés sont ceux du scénario initial, pas une estimation du contenu modifié.
- En cas d’échec Auth, les seules identités créées jusque-là restent marquées, sans profils partiels. Relancer reprend ces identités. En cas d’échec métier, la transaction entière est annulée et la prochaine tentative reprend. Deux opérateurs peuvent avoir un conflit de création Auth; relancer après que le premier ait terminé.
- Il n’existe **aucune suppression, truncate, reset ou mise à jour forcée**. Si des profils/identités/séances référencés ont été supprimés, le workflow bloque pour inspection; il ne recrée pas silencieusement le travail des testeurs. Un nouveau scénario/version nécessite une évolution revue, pas une option `--force`.

## Scénarios visibles

Les dates sont calculées une fois par rapport au jour Paris du premier apply; l’ancrage persiste. L’état est reproductible pour cet ancrage et ne glisse pas à chaque relance.

| Séance fictive | Scénario initial |
| --- | --- |
| Reprise, J−35 | Capacité 18, publication 16, bilan clôturé, 15 plongeurs / 1 absent |
| Progression, J−14 | Capacité 20, publication 18, bilan clôturé, 17 plongeurs / 1 absent |
| Bilan récent, J−2 | Capacité 16, publication 14, bilan clôturé, 13 plongeurs / 1 absent |
| 20 places, 22 volontaires, J+7 | 20 confirmés publiés; brouillon échange nº 20/nº 21; attente/non retenu; 3 voitures (3/3, 3/4, 1/2 passagers); 5 palanquées publiées, 20 affectations |
| Désistement, J+21 | Publication 18 puis retrait du conducteur nº 18; 17 confirmations effectives; ses passagers nº 19/20 restent Oui et cherchent un trajet |
| Republication, J+42 | Capacité 24, 25 Oui, 22 confirmés; publication v2 échange nº 22/nº 23 |
| Sans publication, J+70 | Capacité 12, 16 Oui, brouillon privé 12; aucune publication |

Toutes les séances ont des Oui/Peut-être/Non, des paiements À régler/Payé/Gratuit. Le CACI alterne valide (J+365), proche (J+30), expiré (J−30) et absent. L’encadrant synthétique E3 est un confirmé qui consomme une place, sans prétendre à une validation réglementaire. Les présences validées alimentent les compteurs de saison; près du 1er septembre, les séances plus anciennes peuvent naturellement appartenir à la saison précédente.

Connecter ensuite **le compte habituel du testeur** sur le Netlify branch deploy staging. Un organisateur admin/président peut parcourir Gestion, les paiements et l’annuaire CACI. Un membre ordinaire voit uniquement les projections autorisées, ses propres paiements/CACI et son propre compteur : son compte n’est pas inscrit artificiellement aux séances et ses données ne sont pas modifiées. Il peut répondre à une séance future pour tester son parcours réel. Aucun faux utilisateur n’a besoin de boîte email et le seed n’offre pas de mécanisme de connexion aux identités synthétiques; l’authentification magic-link et signup fermé restent inchangés.

Le jeu initial finira par devenir historique. Relancer ne change pas les dates pour préserver les essais. Aucun changement n’est apporté à l’UI, RLS, règles métier ou architecture Auth. La validation hébergée après apply reste une étape du pilote, distincte de la préparation technique et de toute mise en production.
