# Gestion des adhérents

## Utilisation

**Administration → Gestion des adhérents** contient un seul annuaire. Rechercher par nom/email et combiner les filtres rôle, CACI et accès. Les comptes actifs sont affichés par défaut; le filtre Inactifs conserve l’accès à leur fiche pour les organisateurs. Les admins peuvent consulter les informations et modifier le CACI, mais aucune action sur les comptes/droits ne leur est proposée ni autorisée côté serveur. Une sauvegarde CACI réussie actualise la fiche et referme l’éditeur; un refus/conflit conserve la saisie.

Le **président** dispose de **Ajouter un adhérent** (prénom, nom, email), puis de **Gérer les droits et l’accès** dans chaque fiche autre que celle du président. Les changements de rôle et d’accès demandent confirmation. Une création démarre toujours avec le rôle Adhérent, sans mot de passe, invitation ni email automatique. La personne peut ensuite utiliser le formulaire habituel pour recevoir un magic link. L’email est normalisé comme dans l’import opérateur. Une adresse déjà provisionnée n’est jamais adoptée/modifiée par cette création.

**Désactiver** suspend l’accès à l’application et l’émission de nouveaux jetons Auth (magic link/refresh). Le compte Auth et le profil sont conservés. Les sessions déjà ouvertes perdent immédiatement l’accès serveur; l’interface réactualise le profil sur focus et toutes les cinq secondes lorsqu’elle est visible. L’identité historique reste consultable dans les séances, sélections, paiements, présences, palanquées et compteurs. Aucune sélection ni voiture n’est retirée automatiquement : l’organisateur doit traiter séparément les changements opérationnels d’une séance future.

**Réactiver** dans le filtre Inactifs restitue l’accès avec le même profil et rôle; un nouveau lien peut être demandé. Un ban Auth effectué séparément par un opérateur reste en vigueur : la réactivation UI ne contourne pas cette protection. Le président ne peut pas se désactiver/démouvoir; transférer explicitement la présidence ou utiliser la récupération opérateur reste nécessaire. Un profil suspendu ne peut pas recevoir la présidence.

La suppression définitive n’est pas proposée, même pour les comptes de test : prouver l’absence de tout historique et traiter la suppression Auth nécessite une procédure séparée. Aucun historique ni compte seed/testeur existant n’est supprimé par cette fonctionnalité. Les scripts `members:import` et `president:manage` restent disponibles pour bootstrap/récupération.

## Mécanisme et sécurité

- `members.disabled_at` nullable est l’unique état de suspension; les profils existants migrent actifs. `set_member_active` vérifie le président courant sous le même verrou transactionnel que la gestion des rôles et écrit un audit. Aucun autre enregistrement métier n’est modifié.
- `current_member_id` ignore les profils suspendus; les RLS/RPC existants refusent ainsi immédiatement un ancien JWT. Le hook `member_access_token_hook` refuse toute nouvelle émission/renouvellement pour ces profils, en conservant les claims originaux des comptes actifs. Seul `supabase_auth_admin` peut l’exécuter via Auth; aucun droit de lecture directe sur les profils n’est ajouté à ce rôle.
- L’Edge Function `create-member` vérifie le bearer avec `Auth.getUser`, puis `is_president` avec le JWT appelant. Elle crée l’identité via Auth Admin (secret serveur injecté par Supabase), sans password/invite. Le navigateur ne reçoit aucune clé privilégiée; aucune nouvelle variable `VITE_*` n’est nécessaire.
- `create_member_from_identity` revérifie le président courant dans la transaction et accepte uniquement une identité marquée par Auth Admin pour cet acteur et cette requête. Elle réutilise `provision_member`, crée un membre ordinaire et audite l’acteur. Des métadonnées utilisateur/JWT forgées ne suffisent pas.
- Auth et SQL sont deux transactions. Le formulaire conserve un identifiant de requête et peut reprendre sa propre création après un échec réseau/liaison, sans recréer ni écraser le profil. Un résultat de succès perdu peut être rejoué. Un email appartenant à une autre requête/identité est refusé. Une révocation de présidence intermédiaire laisse une identité non liée sans accès aux données; elle ne donne pas de rôle.

Si la création reste incomplète, **conserver le formulaire et réessayer**. Si le formulaire a été fermé/perdu, l’opérateur vérifie dans Auth l’identité et son marqueur `ifosse_creation_actor`/`ifosse_creation_request`, puis peut relier le profil avec l’import existant, après validation humaine. Ne pas supprimer/adopter automatiquement une identité pour masquer un doublon. L’import opérateur n’efface jamais `disabled_at` ni les modifications de rôle.

## Déploiement staging obligatoire avant utilisation

Cette PR prépare le code; elle ne configure aucun projet hébergé et ne touche pas production. TOML configure seulement la stack locale. Sur **ifosse-staging** :

1. Appliquer les migrations revues, notamment `20261006010000_member_lifecycle.sql`.
2. Déployer la fonction depuis ce dépôt avec la CLI authentifiée opérateur :

   ```sh
   npx supabase functions deploy create-member --project-ref btpojwwwsxrepsehmxbm
   ```

   `verify_jwt=false` dans TOML désactive uniquement le contrôle passerelle legacy; la fonction exige et vérifie elle-même le bearer auprès d’Auth et le rôle courant en SQL. Les secrets Supabase standards (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) sont injectés dans l’Edge Runtime par Supabase. Ne les ajouter ni à Netlify ni au frontend; ne jamais copier une valeur service-role dans un document.
3. Dans **Authentication → Hooks → Custom Access Token**, activer le hook PostgreSQL **public.member_access_token_hook**. Ne pas remplacer les règles signup/SMTP/magic link existantes. Le hook doit être actif **avant de livrer la désactivation aux testeurs**; sans lui, RLS bloque l’application mais Auth pourrait encore émettre un jeton. Configuration officielle : [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks).
4. Déployer le frontend staging; contrôler avec un compte fictif nouvellement créé : login magique, désactivation avec session déjà ouverte, nouveau magic link et refresh refusés, historique conservé, réactivation/login. Vérifier aussi les refus Admin/Membre et le bootstrap/récupération.

Production reste une étape séparée explicitement non exécutée par ce travail.

## Validation locale

Utiliser une stack locale **isolée** pour les tests président : le test refuse de remplacer un président existant. Pour une stack de développement vide :

```sh
npm run db:start
npm run db:reset
npx supabase --network-id ifosse-local functions serve create-member
# Autre terminal, même dépôt :
npm run test:e2e
```

Le hook local est déclaré dans `supabase/config.toml`; redémarrer la stack après modification de ce fichier. Les tests utilisent uniquement des comptes fictifs `example.test`, Mailpit et des endpoints locaux. Le CI démarre la fonction avant le navigateur et vérifie les vrais refus Auth, pas seulement un mock de la connexion. Ne pas réinitialiser une stack contenant des essais à conserver; démarrer un projet local distinct pour ces tests.
