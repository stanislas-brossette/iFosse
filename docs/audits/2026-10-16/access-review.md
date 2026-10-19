# Audit des accès et de compatibilité serveur — 16 octobre 2026

## Périmètre et résultat

Audit en lecture du code et validations sur un projet Supabase local jetable, avec uniquement des comptes fictifs. `master` distant récupéré et vérifié : `f01b189d3b5690edc60b7a09de7fb01681c916f2`. La branche de travail `codex/member-email-notifications` est plus avancée ; ses nouveautés de notifications ne sont pas comprises dans le contrat serveur de master. Aucun projet hébergé ni compte réel modifié. Aucun déploiement ni fusion.

Aucun autre défaut de permissions reproduit sur cette version avec toutes ses migrations appliquées. Cela ne prouve pas que le projet hébergé dispose des mêmes fonctions, politiques, migrations, fonctions Edge ou paramètres Auth. Le retour `NULL` transmis par l’utilisateur confirme au moins une des deux fonctions de publication absente sur la base interrogée ; il ne permet pas de déduire l’état des autres fonctions.

## Matrice de droits vérifiée

| Fonction | Adhérent actif | Admin actif | Président actif |
|---|---|---|---|
| Consulter séances, publications, palanquées et covoiturage | Oui, projections limitées au contexte autorisé | Oui | Oui |
| Modifier son profil courant, sa réponse, son covoiturage | Oui | Oui | Oui |
| Lire son CACI / paiement | Oui | Oui | Oui |
| Modifier un CACI / paiement | Non | Oui | Oui |
| Annuaire privé global | Non | Oui | Oui |
| Créer/modifier séances et corriger les réponses | Non | Oui | Oui |
| Brouillon / comparaison / publication de sélection | Non | Oui | Oui |
| Préparer et publier les palanquées | Non | Oui | Oui |
| Présences, lot de présences, clôture/réouverture du bilan | Non | Oui | Oui |
| Créer un adhérent, suspendre/réactiver un accès | Non | Non | Oui |
| Attribuer/retirer admin et transférer la présidence | Non | Non | Oui, avec protections existantes |
| Bootstrap/récupération/import privilégié | Non | Non | Opérateur serveur distinct |

Les trois rôles produit partagent le rôle PostgreSQL `authenticated`. L’autorisation d’exécuter une RPC à ce niveau ne suffit donc pas à autoriser l’opération : les fonctions vérifient le rôle courant en base et les politiques RLS restreignent les lignes. La présidence inclut `is_admin()`. Les rôles ne sont pas dérivés d’un champ modifiable du JWT. Un compte suspendu perd immédiatement l’accès RLS/RPC même avec un ancien jeton ; l’interdiction d’émettre de nouveaux jetons nécessite également le hook Auth hébergé.

## Vérifications exécutées

- Lecture de `AGENTS.md`, décisions/spécifications, architecture, migrations, politiques, fonctions serveur et gardes/navigation frontend.
- Inventaire par AST TypeScript de tous les appels RPC frontend et de la fonction Edge de création, y compris les noms choisis conditionnellement : **40 contrats nom/paramètres** sur master.
- Comparaison avec le catalogue PostgreSQL réel : noms des paramètres obligatoires/facultatifs, types exacts des arguments et du résultat, EXECUTE pour `authenticated`, absence d’EXECUTE pour `anon` sur ces RPC.
- Toutes les tables métier publiques sous RLS ; aucune fonction publique directement appelable (hors trigger/event_trigger) accessible anonymement ; aucun EXECUTE navigateur sur provision/bootstrap/récupération/import/seed opérateur.
- Suite SQL existante : **656 assertions**. Contrat RPC/RLS supplémentaire : **41 assertions**. Matrice métier supplémentaire : **81 assertions**, dont les mêmes actions réussies sous Admin et Président, et les refus Membre/Inactif. Total : **778 assertions / 21 fichiers**, toutes réussies et transactions annulées.
- Tests existants : création Président et refus Admin/Membre, identité Auth appartenant à l’opération, rôle initial membre, annuaire/CACI/paiement privés, brouillons/publications, transfert atomique et unicité de la présidence, suspension/réactivation, conservation historique, bans et jetons périmés.
- Master : **192 tests unitaires / 35 fichiers**, typecheck, lint, build et vérification des types DB générés réussis. Le build conserve son avertissement existant de taille de bundle (>500 kB).
- Branche de travail notifications : **269 tests unitaires / 40 fichiers**, typecheck, lint et build également réussis. Ce chiffre correspond à une autre version ; il ne remplace pas les résultats de master.
- Aucun nouveau passage Playwright/recette hébergée pendant cet audit. La matrice supplémentaire appelle directement les API SQL ; elle ne se contente pas de vérifier la présence des boutons.

Les deux tests supplémentaires et les journaux sont dans `/tmp/ifosse-access-audit` et `/tmp/ifosse-access-*.log` pour cette session ; ils n’ont pas été ajoutés à la suite permanente ni présentés comme une nouvelle CI verte.

## Vérifier le serveur hébergé utilisé par le site

Ouvrir `hosted-rpc-check.sql` de ce dossier et exécuter son contenu dans **SQL Editor du projet Supabase réellement utilisé par le site**. Le script utilise une transaction `READ ONLY`, ne fait aucun appel aux fonctions applicatives, ne lit aucune fiche personnelle ni secret et ne modifie ni compte ni permission.

Le résultat unique contient 40 lignes `1_RPC` (toutes `OK` attendues) et les tables sous `2_RLS` (toutes `OK` attendues). Les anomalies d’exposition anonyme apparaissent sous `3_ANONYMOUS` ; aucune ligne de cette catégorie n’est attendue. Les autres statuts distinguent fonction absente/arguments incompatibles, types d’arguments anciens, type de retour ancien, EXECUTE authentifié manquant ou exposition anonyme inattendue. Les colonnes `details` donnent les signatures attendues/présentes sans donnée personnelle. Les fonctions de type `trigger` et `event_trigger` sont exclues du contrôle anonyme, car elles ne sont pas des RPC directement appelables. Le filtre porte sur le type de retour, jamais sur le seul nom : une fonction ordinaire nommée `rls_auto_enable` reste contrôlée. L’outil vérifie les contrats et droits, pas le corps complet des fonctions/politiques ni le cache PostgREST.

### Migrations récentes à contrôler notamment

- `20261007010000_calendar_personal_status.sql` : projection calendrier personnel. Une ancienne version peut exister avec les mêmes arguments mais seulement quatre colonnes ; le script signale aussi ce cas.
- `20261007210000_selection_comparison.sql` : récapitulatif et publication protégée (`get_selection_publish_preview`, `publish_selection_checked`) — correspond au symptôme rapporté.
- `20261008070000_attendance_batch.sql` : aperçu et validation en lot des présences.
- `20261008110000_presidency_transfer.sql` : transfert avec vérification du successeur affiché.
- `20261006010000_member_lifecycle.sql` : création finalisée et suspension/réactivation ; dépend aussi du déploiement Edge et du hook Auth.

Ne pas rejouer aveuglément toutes les migrations : certaines ne sont pas idempotentes et l’historique hébergé peut différer après une application manuelle. Identifier la fonction/version réellement absente, vérifier ses prérequis puis appliquer les migrations concernées dans l’ordre. Si les fonctions sont présentes et que seule l’API ne les voit pas, un rechargement du cache PostgREST est une étape distincte.

### Vérifications hébergées hors portée du SQL de diagnostic

- Fonction Edge `create-member` déployée, contrôle JWT par le handler et configuration passerelle conformes à `docs/member-management.md`.
- Hook `public.member_access_token_hook` réellement activé dans Auth, et public signup toujours désactivé.
- Site Netlify raccordé au projet attendu ; séparation staging/production, redirects et magic link.
- Vérification avec les comptes réels de test pour chaque rôle, sans modifier arbitrairement leurs rôles ou leurs profils.
- Si la preview PR65 est utilisée : ses migrations et l’activation des notifications sont des dépendances supplémentaires, hors contrat master et hors validation hébergée de cet audit.

## Correction du diagnostic après résultat hébergé

Le premier diagnostic signalait `rls_auto_enable` : le filtre excluait `trigger` mais oubliait `event_trigger`. Supabase documente précisément une fonction `rls_auto_enable()` retournant `event_trigger` pour activer la RLS à la création de tables. Ce nom seul ne prouve pas un défaut de permissions. Le filtre est corrigé et les trois requêtes de résultats sont réunies en un tableau unique, car le SQL Editor affichait seulement le dernier résultat. Cela ne permettait pas de conclure sur les 40 RPC précédentes. Référence : https://supabase.com/docs/guides/database/postgres/event-triggers .
