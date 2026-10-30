# iFosse — document de transfert vers un compte personnel

**Date de rédaction : 24 octobre 2026 — fuseau Europe/Paris.**

Ce document permet de reprendre le dossier sans accès à la conversation ChatGPT d’origine, à ses mémoires, à ses outils connectés ou à son compte. Il rassemble l’historique utile, les décisions, les démarches opérateur, les preuves, l’état actuel et les pièces à récupérer. Il ne constitue pas une autorisation de déploiement ou de modification des services.

## 1. Périmètre, confidentialité et lecture des preuves

### 1.1 Objet du transfert

Le propriétaire va perdre l’accès au compte ChatGPT utilisé pour développer iFosse et souhaite poursuivre sur un compte personnel. Le nouvel assistant ne doit pas supposer qu’il pourra relire les anciens échanges ou retrouver les pièces jointes via leur ancien chemin.

La conversation concernait iFosse, application associative de gestion de séances de plongée en fosse pour APSAP, et non un produit de l’employeur du propriétaire. Le dépôt de référence est [stanislas-brossette/iFosse](https://github.com/stanislas-brossette/iFosse).

### 1.2 Informations volontairement exclues

Aucun secret, mot de passe, JWT, magic link réel, clé service-role, PAT Supabase, clé API/SMTP Brevo, réponse fournisseur privée, roster, date médicale réelle ou contenu de boîte mail n’est reproduit ici. Les adresses personnelles, noms des autres testeurs et identifiants d’organisation sans utilité technique ont été retirés.

**Passages à traiter avant tout transfert séparé :**

- Certaines métadonnées Git contiennent une adresse professionnelle d’auteur : elle n’est pas reproduite. Examiner les métadonnées avant de transmettre une archive complète avec `.git` ; un checkout de fichiers et un transfert privé de l’historique ne sont pas la même opération.
- Les captures de l’annuaire/profil montrent des identités, adresses email et parfois dates CACI. Les captures Gmail/WhatsApp et consoles fournisseurs montrent aussi des données personnelles et des noms de comptes. Elles doivent être anonymisées, ou rester hors du nouveau compte.
- Les dumps, exports réels, fichiers privés et variables d’environnement ne doivent pas accompagner cette passation. Les accès aux fournisseurs se rétablissent séparément par les mécanismes officiels.
- Aucun contenu métier confidentiel de l’employeur n’a été identifié comme nécessaire à cette passation. Cela ne certifie pas l’innocuité de tous les fichiers du disque, des archives ou de l’historique Git. Ne pas transférer ces ensembles sans revue.

Les noms des variables de configuration, les URLs publiques du projet et les refs Supabase ci-dessous sont des références techniques, pas des secrets donnant accès aux données.

### 1.3 Niveaux de certitude

- **Vérifié le 24/10** : constat direct sur les fichiers/Git, GitHub ou Netlify pendant cette rédaction.
- **Confirmé historiquement** : constat daté antérieur conservé dans la conversation ou une passation ; ce n’est pas nécessairement l’état actuel.
- **Rapporté par le propriétaire** : recette réelle effectuée par l’utilisateur, non observée indépendamment par l’assistant.
- **Déclaré dans une PR/revue** : résultat annoncé dans un document, à distinguer d’une exécution revue aujourd’hui.
- **Hypothèse / à vérifier** : piste sans preuve suffisante ou information devenue susceptible de dérive.

Les dates de livraison ci-dessous proviennent principalement des commits. Tous les messages anciens n’ont pas d’horodatage individuel ; les dates de fusion ne doivent pas être présentées comme la date exacte de chaque échange. Les identifiants de migrations indiquent leur ordre, pas nécessairement le jour de leur application hébergée.

## 2. Contexte initial, objectifs et manière de travailler

### 2.1 Objectif produit

Transformer un prototype HTML local en une petite application partagée fiable pour environ **50 adhérents**. La séance de fosse est l’objet central. Les organisateurs doivent pouvoir gérer inscriptions, sélection, covoiturage, paiements, CACI, palanquées, présences et historique. Les adhérents répondent et suivent leur propre situation.

Le fichier `frontend/iFosse_V0.html` est la référence visuelle/fonctionnelle, pas l’architecture cible. Ne pas réintroduire son stockage métier localStorage, ses personas fictives ou ses comportements de démonstration.

### 2.2 Contraintes structurantes

- Architecture simple et maintenable : React/TypeScript/Vite, Supabase/PostgreSQL/Auth/RLS/RPC, Netlify.
- Autorisations serveur obligatoires ; masquer un bouton n’est jamais une garantie suffisante.
- Authentification par lien magique, comptes connus, sans mot de passe ni inscription publique.
- Brouillons privés, publications explicites et immuables ; transactions pour les courses de capacité/places.
- Production séparée, jamais touchée au seul motif de préparer ou tester staging.
- Staging est désormais utilisé par de vraies personnes ; toute évolution doit préserver données, comptes et fonctionnement existant.
- Pas d’élargissement non demandé du MVP, de grand framework UI ou de refactorisation sans rapport avec la tâche.
- Interface française, responsive, accessible ; tests ordinateur et téléphone avec données fictives pour les captures.

### 2.3 Préférences de collaboration

Le propriétaire préfère que l’assistant réalise le travail demandé et progresse de façon autonome sur les choix techniques courants. Il ne veut pas une succession de demandes de confirmation inutiles. Pour chaque tâche : inspecter le dépôt et les spécifications, branche dédiée, PR ciblée, tests, auto-relecture de sécurité/régression, documentation utile.

Les autorisations de merge ont varié selon le chantier : certains lots étaient explicitement autorisés à être fusionnés après CI verte ; d’autres PR devaient être laissées en recette avant accord. **Les autorisations historiques de lots ne constituent pas une permission générale de fusionner de futures PR ou de déployer en production.**

Privilégier un nouveau chat par fonctionnalité, bug ou petit ensemble cohérent. Une compaction de contexte n’impose pas à elle seule d’abandonner le travail en cours. Conserver les décisions durables dans le dépôt.

## 3. Sources de vérité et règles métier

### 3.1 Lecture obligatoire

Lire `AGENTS.md`, puis :

1. `docs/specs.md` ;
2. `docs/decisions.md` ;
3. `docs/roadmap.md` ;
4. `docs/cahier_des_charges.md` ;
5. `docs/iFosse_V0_guide.md`.

En cas de conflit produit : décisions > spécifications > cahier des charges. Lire aussi `docs/architecture.md`, `docs/data-model.md` et les guides du sujet avant changement. Ne pas transformer un ancien état d’exécution en exigence actuelle.

### 3.2 Invariants à préserver

- Capacité typique : **20**, modifiable par admin. Les inscriptions ne sont pas plafonnées, la sélection finale l’est. Les encadrants consomment une place.
- Réponse Oui/Peut-être/Non et statut de sélection sont deux notions distinctes.
- L’admin travaille dans un brouillon privé puis publie explicitement. Une republication remplace la référence courante sans modifier l’ancien instantané.
- Un retrait invalide la participation effective selon les règles existantes sans effacer l’historique publié.
- Le paiement est visible au seul intéressé et aux administrateurs autorisés ; seul un administrateur le modifie.
- Les compteurs saisonniers se fondent sur la présence effective, pas sur la sélection. Saison du 1er septembre au 31 août.
- Le CACI est une information de profil privée ; un membre le consulte, un admin/président peut le modifier, y compris pour lui-même. Le récapitulatif opérationnel n’est pas une validation médicale ou réglementaire.
- Le covoiturage reste modifiable après réponse. Places limitées transactionnellement. Un conducteur qui se retire laisse les passagers inscrits et à réaffecter, pas désinscrits automatiquement.
- Pas de génération réglementaire de document palanquée exigée en V1.
- Pas de suppression générale des membres : désactivation avec historique conservé.

### 3.3 Rôles

| Rôle | Capacités principales |
| --- | --- |
| Membre | Ses données privées, réponses, situation publiée, opérations de transport autorisées ; pas d’annuaire global, pas d’écriture CACI, pas de gestion des droits |
| Admin | Opérations d’organisation, annuaire et CACI, sélection, paiements, préparation, présences/palanquées selon règles existantes |
| Président | Tout admin + création d’adhérents, désactivation/réactivation, attribution/retrait admin et transfert de présidence |

La révocation des droits se relit en base pour les opérations sensibles ; un JWT ancien ne doit pas maintenir un privilège supprimé. Le président n’est pas une persona de démonstration et le bootstrap ne se fait pas par auto-promotion opportuniste.

## 4. Chronologie consolidée

### Avant le 2 octobre 2026 — prototype et cadrage

Un prototype autonome V0 existait. Les règles ont été précisées et l’architecture gelée. L’objectif était de passer à un vrai système multi-utilisateur sans copier le JavaScript local du prototype. Les premiers échanges ont imposé capacité/sélection distinctes, confidentialité, rôles, audit et tests.

### 2 octobre — fondation et fonctionnalités partagées

Le propriétaire demande de traiter successivement les issues **#9 à #18**, avec branches/PR/tests, merges autorisés pour ce lot si vert et sans incertitude substantielle. Pour #9, ne pas faire confiance au patch préparé : vérifier/régénérer le scaffold et exécuter installation/build/tests réels.

Livraisons visibles dans Git :

| PR | Livraison |
| --- | --- |
| #19 | Fondation React/Supabase/CI |
| #20 | Magic link pour membres connus, identité et rôles |
| #21 | Profils privés et CACI administrateur |
| #22 | Séances et inscriptions partagées |
| #23 | Brouillon sélection privé et publications immuables |
| #24 | Covoiturage transactionnel |
| #25 | Paiements privés et readiness opérationnelle |

### 3 octobre — bilan, groupes, revue et durcissement

| PR | Livraison |
| --- | --- |
| #26 | Présences, bilan et historique saisonnier |
| #27 | Brouillons/publis palanquées |
| #28 | Exploitation, restauration locale peuplée, préparation pilote |
| #29 | Préserver les saisies lors des refresh Auth du même compte |
| #30 | Confirmer les retraits conséquents, minimiser projections participants |
| #31 | Distinguer readiness provisoire du covoiturage et défauts facultatifs |

Un rapport final de revue daté du 03/10 a été cité par le propriétaire. Les demandes de corrections ont été traitées par petites tranches. Les pièces originales de revue ne sont pas intégralement reproduites ici ; voir inventaire.

### 4 octobre — permissions, occupation, restyle et tests déterministes

Le propriétaire rapporte qu’un compte supposé membre modifie son CACI et voit l’annuaire. La consigne était de diagnostiquer avant d’ajouter des garde-fous JSX redondants.

**Diagnostic historique confirmé** : la source et les migrations locales étaient cohérentes ; le compte `membre@example.test` avait en fait été promu **admin**. Un audit à **09:26:35 Europe/Paris le 04/10** documentait cette promotion par le président. Le provisionnement initial l’avait créé membre mais une relance d’import préservait le rôle modifié.

Après remise déterministe à member : appels directs `set_member_caci` pour soi/autrui refusés en 42501 et SELECT privé limité à soi. Pas de fuite RLS démontrée dans ce cas. Les tests de bascule admin→member empêchent le maintien d’un écran privilégié périmé.

Un vrai bug distinct existait dans l’éditeur CACI : état initial non rafraîchi et écriture sans contrôle de concurrence. Correction : rafraîchir un champ intact, conserver la saisie volontaire, RPC à valeur attendue sous verrou, conflit nécessitant rechargement explicite.

| PR | Livraison |
| --- | --- |
| #35 | Diagnostic rôles et garde de concurrence CACI |
| #36 | Occupation des cartes issue de la dernière sélection publiée effective, projection groupée |
| #37 | Restyle React avec langage visuel V0, desktop/mobile, données fictives et captures |
| #39 | Sauvegarde CACI annuaire qui replie l’éditeur, « Ma voiture habituelle », résumé « Ma voiture » de séance |
| #40 | Test App indépendant des variables de l’environnement de build |

L’échec Netlify du test App venait d’une hypothèse `publicConfig === null`. Avec variables VITE valides, App rend AuthGate en chargement au lieu du fallback. Les cas de tests mockent explicitement config/client. Les tests du build n’ont pas été retirés et le runtime n’a pas été déformé pour les satisfaire.

### 5 octobre — données synthétiques de staging

**#42** livre le seed opérateur sécurisé. Le staging devait paraître actif sans utiliser de roster réel : 30 membres synthétiques, 7 séances et scénarios détaillés plus bas.

Premiers essais opérateur : message générique, puis clé non utilisable à cause d’une invite shell incorrecte (`read: -p: no coprocess`, syntaxe Bash utilisée sous zsh). Le workflow exigeait aussi une clé **JWT legacy service_role** de staging, pas une clé secrète opaque. Les erreurs ont été rendues plus exploitables sans exposer les secrets.

### 6 octobre — séparation des sites et gestion des adhérents

**#43** retire les valeurs `VITE_APP_ENV` codées en dur dans les contextes Netlify. Deux sites distincts : staging dont la branche principale est staging et environnement applicatif preview ; site production dont branche principale master et environnement production.

**#44** remplace le double affichage annuaire/droits par une seule « Gestion des adhérents » : recherche nom/email, filtres compacts, CACI, état actif/inactif, actions selon rôle. Création et cycle de vie président côté backend.

Lors de la recette, la désactivation affichait un refus générique et la création était indisponible. Les déploiements des migrations, de la fonction `create-member` et du hook Auth étaient des étapes indépendantes du frontend. La conversation a guidé leur installation ; on ne doit pas conclure que chaque erreur avait une seule cause prouvée à partir du message UI.

**#45** ajoute le tri Participants (initialement Inscription, Nom, Niveau, Sélection).

### 7 octobre — navigation, nouveau tri, auth preview et calendrier

- **#46** : identité de header cliquable vers Mon profil, logout séparé ; confirmation « Se déconnecter ? », Annuler/Escape préservent la session, confirmation seule déconnecte, focus clavier géré.
- **#47** : tri par défaut **Réponse** Oui→Peut-être→Non, puis nom et prénom ; retire Inscription des options, pas de timestamp secondaire automatique.
- **#55** : magic links demandés depuis une preview retournent sur cette même origine autorisée `/auth/confirm`, avec validation stricte et documentation Supabase.
- **#54** avait été fusionnée trop vite, puis revert/force-push par le propriétaire. **#56** réintroduit proprement le calendrier/statuts personnels. Une RPC hébergée ancienne ne renvoyait que `session_id, capacity, publication_version, confirmed_count`, d’où le message « calendrier nécessite une mise à jour du serveur ». Après alignement serveur, l’utilisateur confirme que cela fonctionne.
- Suppression du sélecteur de saison et boutons saison précédente/suivante jugés inutiles ; préservation de l’accès à l’historique par filtres de période. Éviter la date répétée sur chaque carte et un conseil « répondre Oui » quand la réponse est déjà Oui.
- **#57 / issue #49** : priorité au résumé personnel dans les séances et sections pertinentes.
- **#58 / issue #50** : cartes/mobile et navigation des onglets accessibles.

Le propriétaire a demandé successivement les issues #50–53 et autorisé leurs merges si tout était correct. Cette autorisation concernait ce lot.

### 8 octobre — comparaison, navigation persistante, bilan et présidence

- **#59 / #51** : comparaison organisateur compacte et aperçu de publication contrôlé.
- **#60 / #52** : navigation persistante et abandon de brouillons protégé.
- **#61 / #53** : formulaires, retours login, enregistrement explicite par lots des présences.
- **#63** : transfert de présidence, puis déplacement du bouton du haut Administration vers **bas de Mon profil président**, section dépliable. Migration `20261008110000_presidency_transfer.sql` ; propriétaire guidé pour staging puis indique que cela fonctionne.
- **#64** : tests de navigation déterministes. Un échec staging après mise à jour de branche a motivé la vérification de l’initialisation asynchrone ; ne pas supposer que le nom du contexte Netlify indique le mauvais environnement.

Début du chantier **#65** : notifications par email après opérations sensibles de compte. La première approche incluait le CACI ; décision ensuite révisée en faveur du canal interne pour les changements opérationnels. Ne pas rétablir l’ancien périmètre à partir du nom d’une migration historique.

### Entre le 8 et le 17 octobre — RPC hébergées et PWA

Publication de sélection bloquée par « action nécessite une mise à jour du serveur ». Un diagnostic de signature retournait NULL : indication d’un contrat RPC absent/incompatible à vérifier sur le bon projet, pas permission de contourner les règles.

L’audit complet a ensuite signalé `unexpected_anonymous_function` pour **`rls_auto_enable`** : une fonction d’event trigger avait été classée comme RPC anonyme. L’audit a été corrigé pour exclure les retours `trigger` et `event_trigger` et produire une table de résultats cohérente. Le propriétaire a finalement rapporté « OK partout ». Les chiffres historiques mémorisés étaient 40 RPC et 15 tables RLS ; ils ne représentent pas l’audit complet du schéma actuel.

**17/10 : #67** adapte les erreurs de conflit obsolète en HTTP 409 compatible, sans retry transactionnel inapproprié. **#66** livre PWA V1.

Difficultés de recette PWA : redirection email vers staging au lieu de preview, puis absence de bouton/install impossible Android, puis preview non relancée pour un commit (`157e63e` cité). Les réglages Auth ont été revérifiés et une version corrigée a été acceptée sur Android. Ne pas attribuer tous ces symptômes à un problème unique non prouvé. Le propriétaire n’avait pas d’iPhone.

Les messages de lancement des tests ont été complétés : c’est une phase de test, tout retour est utile, installation Android disponible et iPhone non recetté. Un texte WhatsApp/release note a été demandé/rédigé ; aucun envoi automatique autorisé par simple rédaction.

### 18 octobre — notifications internes et emails de compte

Le propriétaire remet en cause le coût/complexité de #65 : certains événements devraient être dans l’app. Décision : boîte privée interne pour sélection, covoiturage pertinent et CACI ; emails pour accès/compte/rôles.

**#68**, fusionnée le 18/10 : notifications internes derrière activation opérateur. Le propriétaire dispose d’un ordinateur, d’un Android, d’un compte organisateur et d’un membre ; il rapporte la réussite des tests 1–5, puis fusion/déploiement et activation interne.

**#65**, fusionnée le 18/10 après recette : création de compte, octroi/retrait admin, désactivation/réactivation. Captures d’emails reçus. Connexion magique après réactivation réussie. Modification CACI : notification interne, **aucun email**, résultat souhaité.

Démarches d’installation guidée : jeton personnel Supabase limité au staging, clé API transactionnelle Brevo, expéditeur vérifié, adresse test autorisée. Échecs initiaux « accès indisponible », HTTP 400 SQL et 42501 Vault readonly ; diagnostics et séparation dry-run/apply corrigés. Installation finale avec `--apply` réussie, puis vraies actions de compte pour tester les envois.

### 19 octobre — tous les adhérents réels, incident worker, passation

Le propriétaire demande les emails pour tous les adhérents enregistrés plutôt que son adresse de test seule. **#69** ajoute `--all-members`, mode `registered`, exclusions seed/réservés maintenues.

Un premier apply annonce succès mais aucun email sur nouvelle création et changement admin. Diagnostic : l’entrypoint Deno omettait `NOTIFICATION_RECIPIENT_MODE`. Il retombait en allowlist vide, retournait `503 NOTIFICATION_CONFIGURATION` avant claim/envoi. Correction de la projection de configuration, tests du vrai entrypoint, readiness GET authentifiée avant activation.

Le deploy preview échoue ensuite sur un test NotificationCenter : il vérifiait l’état avant l’acquittement asynchrone du marquage lu. Correction déterministe : vérifier que le compteur reste pendant l’attente, puis disparaît après ack. Commit `cb61629`.

Nouvelle installation `--all-members --apply` avec worker startup vérifié ; utilisateur : « C’est tout bon », puis « C’est déployé et semble bien fonctionner ». #69 fusionnée à `cb030cf`. CI #129 et Netlify staging verts vérifiés à l’époque.

Passation créée le 19/10, commit `2c0ef41` : `docs/handoffs/2026-10-19.md`, audits et pointeur racine. Le blocage `master already used by worktree` avait été résolu en détachant l’ancien worktree review ; ne pas supprimer les données pour libérer une branche.

### 19–20 octobre — évolutions retrouvées dans le dépôt après cette passation

Ces événements complètent l’ancienne conversation ; ils sont confirmés par commits/docs, certains détails d’essai par notes historiques locales.

- **#70**, fusionnée le 19/10 : bulles décoratives, décision D033. Évolution finale : délai initial 5 secondes, probabilité **5 %** par clic explicitement éligible, 3–5 bulles, aucune limite par visite ni délai entre visites, aucune écriture stockage, pas de clic intercepté ni de son. Respect reduced-motion. Les anciennes notes indiquant 1 %/cooldown trois jours sont périmées.
- **#71**, fusionnée le 20/10 : logo club fourni à la connexion/navigation et icônes simplifiées tour Eiffel–dauphin, décision D034. La variante nudibranche a été essayée puis non retenue. Sources conservées, exports déterministes sans génération au build.
- Le fond blanc du logo venait d’une règle CSS, pas d’un PNG opaque ; correction `3d76148`.
- Mise à jour de l’icône Android : désinstallation/réinstallation rapportée comme efficace ; mise à jour automatique immédiate non prouvée.
- Avertissement Android/Play Protect lié à un target SDK ancien du WebAPK : cause exacte non établie. Une piste navigateur/générateur WebAPK a été discutée, sans identification certaine du navigateur d’installation. Ne pas désactiver Play Protect ni présenter cette piste comme diagnostic confirmé.

### 24 octobre — nouvel état retrouvé pendant ce transfert

Une revue supplémentaire a créé les issues **#72–#81**. Le checkout est sur **`fix/72-protect-session-history`**, commit **`e7876d8d8f146359c3725db9918be53ca73a0243`**. Ce commit n’est pas un merge master malgré son message contenant « (#72) » : #72 est une issue, la PR correspondante est **#82**, ouverte.

La PR #82 annonce la protection contre suppression des séances avec historique (D035), tests et migration additive. La CI #138 est pourtant **rouge** : frontend vert, job database échoue à `npm run db:restore-check`, nettoyage incomplet. État détaillé et priorité de reprise plus bas. Aucune correction ou fusion effectuée dans cette demande documentaire.

## 5. Solutions retenues et incidents utiles à connaître

| Sujet | Cause / constat | Solution et résultat | Certitude |
| --- | --- | --- | --- |
| « Membre » avec annuaire/CACI éditable | Rôle réellement admin après promotion auditée | Setup déterministe, refus API/RLS vérifiés après retour member ; pas de garde redondante | Confirmé historiquement |
| CACI qui écrase valeur récente | État initial figé et écriture inconditionnelle | Refresh si intact, préserver saisie, expected-value sous verrou, conflit/reload | Code livré et tests historiques |
| Test App Netlify dépendant env | Config valide active AuthGate | Mocks explicites fallback/configuré ; runtime inchangé | #40 livrée |
| Site staging interprété production | `VITE_APP_ENV` imposé dans contexte Netlify principal | Variables explicites par site/contexte ; validation/pins conservés | #43 livrée |
| Preview magic link vers main | Redirect demandé/allowlist/template incohérents | Origine courante validée + callback exact, `.RedirectTo`, nouvel email | Propriétaire confirme fonctionnement |
| Message « serveur à mettre à jour » | Contrat RPC hébergé manquant/ancien | Diagnostiquer signature puis migration sur staging approprié | Plusieurs cas résolus ; ne pas généraliser une seule migration |
| Faux positif `rls_auto_enable` | Event trigger confondu avec RPC | Exclure trigger/event_trigger du diagnostic | Audit corrigé, utilisateur tout OK |
| Création/désactivation admin UI | Services backend nécessaires hors deploy frontend | Migration + create-member + hook Auth requis | Recette ultérieure positive ; diagnostic exact de chaque essai non entièrement disponible |
| Seed échoue | Environnement opérateur/format JWT/syntaxe shell | Variables exportées, legacy JWT staging, invite adaptée au shell | Workflow documenté ; aucun secret reproduit |
| Install notifications SQL 42501 | Vault déchiffré en contexte readonly | Catalogues en dry-run, valeurs privées à apply ; pas de grants élargis | Corrigé et installation acceptée |
| All-members sans email | Mode absent de l’entrypoint worker | Projection correcte, tests entrypoint, readiness avant activation | Diagnostic/correction et réception humaine |
| Netlify test cloche intermittent | Attend appel RPC, pas son ack | Promesse contrôlée et états avant/après vérifiés | cb61629, CI/Netlify historiques verts |
| Logo fond blanc | CSS `background: white` | Retrait CSS, test transparence, PNG conservé | #71 livrée |
| PR #82 rouge | Cleanup restore échoue avec nouvelle protection | Correctif non fait ici ; piste suppression RPC d’une fixture historique | Échec confirmé, cause précise à vérifier |

## 6. Architecture technique et configuration nécessaire

### 6.1 Dépôt et versions observées le 24/10

Versions de `package.json`, à relire avant mise à jour : React/React DOM 19.3.0, Supabase JS 2.117.2, TypeScript 6.0.3, Vite 8.3.2, Vitest 5.0.3, Playwright 1.63.0, Supabase CLI 2.119.0. Node **>=22.12**, `.nvmrc` version majeure 22. Node 18 ne convient pas aux outils de ce dépôt.

Principaux emplacements :

- `src/features/auth`, `profiles`, `sessions`, `selection`, `carpooling`, `attendance`, `palanquees`, `notifications`, `install` ;
- `src/lib/config.ts`, `navigation.ts`, `businessErrors.ts`, mécanismes refresh et saisies non enregistrées ;
- `supabase/migrations`, `supabase/tests`, `supabase/functions/create-member`, `supabase/functions/member-notifications`, `supabase/templates/magic-link.html` ;
- `scripts/`, `e2e/`, `.github/workflows/ci.yml`, `netlify.toml`.

### 6.2 Deux sites et deux projets distincts

| Élément | Staging / previews | Production |
| --- | --- | --- |
| Site | `https://ifosse-staging.netlify.app` | `https://ifosse.netlify.app` |
| Branche principale Netlify | `staging` | `master` |
| Environnement produit | `preview` | `production` |
| Projet Supabase | `ifosse-staging` | `ifosse-production` |
| Ref publique projet | `btpojwwwsxrepsehmxbm` | `qjrpxuatsnvrqxhzklzq` |

Le contexte Netlify nommé **production** signifie « déploiement principal du site ». Sur le site staging, il doit donc bien recevoir l’environnement produit **preview**. Ne pas réintroduire des constantes TOML de contexte pour déduire l’environnement produit.

**Matrice publique Netlify à conserver :**

| Variable | Site staging : primary + deploy-preview + branch-deploy | Site production : primary | Site production : previews/branches si activés |
| --- | --- | --- | --- |
| `VITE_APP_ENV` | `preview` | `production` | `preview` |
| `VITE_SUPABASE_PROJECT_ENV` | `preview` | `production` | `preview` |
| `VITE_SUPABASE_URL` | URL staging ci-dessous | URL production ci-dessous | URL staging |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique staging, valeur omise | Clé publique production, valeur omise | Clé publique staging, valeur omise |
| `VITE_PREVIEW_SUPABASE_URL` | `https://btpojwwwsxrepsehmxbm.supabase.co` | Même pin staging | Même pin staging |
| `VITE_PRODUCTION_SUPABASE_URL` | `https://qjrpxuatsnvrqxhzklzq.supabase.co` | Même pin production | Même pin production |

Les URLs sélectionnées sont les pins correspondants. Les six variables sont validées au build/runtime, doivent être explicitement fournies avec scope Builds approprié ; URL/environnement doivent correspondre, pins HTTPS distincts. Aucune clé privilégiée dans les builds. Ne pas faire hériter les previews d’une clé/URL production par défaut général.

Build Netlify conservé : `npm run typecheck && npm run lint && npm test && npm run build`, publication `dist`, fallback SPA, headers sécurité/cache. Les modifications de dépôt n’installent pas les migrations ni les fonctions Supabase automatiquement.

### 6.3 Liens magiques, callback et redirections

Auth reste passwordless pour comptes déjà provisionnés. Dans Supabase, public/anonymous signup désactivé mais fournisseur email actif. OTP configuré à **600 secondes**. SMTP Brevo pour Auth, tracking des liens désactivé. Rotation des refresh tokens conservée.

Frontend : `loginRedirectUrl` considère uniquement l’origine courante, jamais un paramètre de redirection arbitraire. En production, origine exacte `https://ifosse.netlify.app`. En preview : main staging, previews à identifiant numérique sur les suffixes iFosse autorisés et branches explicitement nommées. Pas de ports/credentials/HTTP hébergé.

**Configuration staging Supabase :**

- Site URL : `https://ifosse-staging.netlify.app`.
- Redirect URL indispensable : `https://ifosse-staging.netlify.app/auth/confirm`.
- Pattern previews staging : `https://deploy-preview-*--ifosse-staging.netlify.app/auth/confirm`.
- Si utilisée : `https://master--ifosse-staging.netlify.app/auth/confirm`.
- Si previews du second site configurées avec Supabase staging : `https://deploy-preview-*--ifosse.netlify.app/auth/confirm` et branche `https://staging--ifosse.netlify.app/auth/confirm`.

Pour une seule PR, une URL exacte est plus étroite. Ne pas autoriser tous les domaines netlify.app ni des chemins arbitraires. Les règles preview appartiennent à **Supabase staging**, pas à production. Production : Site URL production et callback exact production uniquement, sauf nouveau besoin explicitement revu.

Template email sûr à conserver, fichier de référence `supabase/templates/magic-link.html` :

```html
<!doctype html>
<html lang="fr">
<body>
  <h1>Connexion à iFosse</h1>
  <p>Ouvrez ce lien puis confirmez la connexion sur votre appareil.
     Il est valable dix minutes et ne peut être utilisé qu’une fois.</p>
  <p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=email">
    Se connecter à iFosse
  </a></p>
  <p>Si vous n’avez pas demandé ce lien, ignorez cet email.</p>
</body>
</html>
```

`.RedirectTo` inclut déjà `/auth/confirm`. Ne pas remplacer par `.SiteURL`, ne pas ajouter une deuxième fois le callback. Après changement fournisseur, demander **un nouveau lien** depuis la preview voulue : les anciens emails ne changent pas.

Le hash/token est retiré de l’URL visible et validé après confirmation explicite ; GET de scanner ordinaire ne consomme pas le lien. Scanner interactif avancé reste un sujet de recette fournisseur, pas une garantie absolue. En PWA isolée du navigateur, aide facultative de collage du lien même origine dans un champ masqué, puis même validation existante.

Local autorisé : localhost/127.0.0.1 HTTP, ports 5173/4173 et callback exact. Ces entrées locales ne doivent pas être copiées en production pour faciliter un test.

### 6.4 Gestion des adhérents et accès désactivé

- Une seule surface Administration, recherche nom/email et filtres utiles, pas de double annuaire.
- CACI save réussi : refresh ligne et fermeture éditeur. Erreur/validation/conflit : éditeur disponible avec reload explicite ; ne pas perdre la saisie.
- Président crée prénom/nom/email normalisé. Rôle initial toujours member, identité Auth confirmée conformément au provisionnement, sans password/invitation/mail de connexion généré. Bienvenue informatif séparé si activé.
- Fonction Edge `create-member` vérifie bearer via Auth puis rôle président courant via SQL. Le service-role reste serveur.
- Désactivation conserve Auth/profil/historique. RLS bloque utilisation avec JWT existant ; hook `public.member_access_token_hook` refuse émission de nouveaux jetons. Aucun retrait automatique de sélection/voiture.
- Dashboard observé : **Authentication → Auth Hooks → Add hook → Customize Access Token (JWT) Claims**, type PostgreSQL, schéma public, fonction member_access_token_hook. Les libellés peuvent changer ; vérifier le projet avant réglage.
- Réactivation restaure accès et login normal. Import/provisionnement/recovery opérateur restent disponibles.
- Transfert : successeur devient unique président, ancien président reste admin, deux changements audités atomiquement. Confirmation email du successeur et reconnaissance explicite, revalidation serveur sous verrou. Annuler ne modifie rien. Retour par nouveau transfert ou récupération opérateur.

### 6.5 Seed staging reproductible

Workflow opérateur, **staging uniquement**, jamais lancé automatiquement au build, par navigateur ou CI :

```sh
npm run staging:seed
npm run staging:seed -- --apply
```

Variables opérateur : `SUPABASE_URL` URL staging exacte, `SUPABASE_PROJECT_ENV=preview`, `SUPABASE_SERVICE_ROLE_KEY` JWT legacy staging privé. URL/ref codées et vérifiées positivement ; claim ref/rôle vérifié aussi SQL. Une valeur absente n’est pas preuve de non-production. Clés opaques non vérifiables refusées. Aucun secret à recopier dans le nouveau compte.

Le dry-run interroge staging sans écriture, vérifie RPC/collisions et affiche le plan. Le script ne charge pas `.env.local` et les VITE ne le configurent pas. Pour saisir une clé, utiliser le shell annoncé par le guide, ou une invite masquée adaptée ; l’ancienne commande Bash `read -p` avait échoué en zsh.

**Jeu initial :** 30 membres réservés, 7 séances, 210 réponses, CACI valide/proche/expiré/absent, paiements à payer/payé/gratuit. Domaines fictifs réservés `ifosse-seed.invalid`, marqueur Auth et registre privé `staging_seed_runs`. Identités créées via Auth Admin sans email/password puis opérations par RPC métier. Un seul admin synthétique ; présidence réelle inchangée.

| Séance initiale | Scénario |
| --- | --- |
| J−35 | Capacité 18, publication 16, bilan fermé, 15 plongées et 1 absence |
| J−14 | Capacité 20, publication 18, bilan fermé, 17 plongées et 1 absence |
| J−2 | Capacité 16, publication 14, bilan fermé, 13 plongées et 1 absence |
| J+7 | 20 places, 22 Oui, 20 publiés ; brouillon différent ; attente/non-retenus ; trois voitures 3/3, 3/4, 1/2 ; cinq groupes, 20 affectations |
| J+21 | 18 publiés puis retrait conducteur, 17 effectifs, passagers toujours inscrits à réaffecter |
| J+42 | Capacité 24, 25 Oui, 22 confirmés, republication v2 |
| J+70 | Capacité 12, 16 Oui, brouillon 12, aucune publication |

Ancrage date Paris calculé au premier apply et persisté. Rerun garde l’existant **sans écriture**, y compris modifications des testeurs. Pas de reset/truncate/force ni adoption d’identités non possédées. Données manquantes ou collisions incohérentes font bloquer pour inspection plutôt que recréer silencieusement. Le seed peut vieillir : relancer ne décale pas ses dates.

### 6.6 Notifications internes

Migration `20261018120000_in_app_notifications.sql`, décision D032. Cloche/inbox privée avec compteur, lecture conservée serveur, pagination de 20. Polling 15 secondes quand page visible et boîte fermée ; boîte ouverte rafraîchie à sa réouverture, pas de push/background.

Événements :

- Première sélection publiée : résultat pour personnes Oui/Peut-être ; republication seulement si résultat effectif change.
- Voiture retirée ou changement rendez-vous/départ : passagers concernés encore éligibles.
- CACI modifié par admin : seul intéressé, pas de date médicale dans le message.

Pas de notification de brouillon, d’action annulée/échouée, d’auto-notification ou de republication identique. Pas d’avis conducteur sur arrivée/départ des passagers dans cette tranche. Les liens restent internes, pas de HTML utilisateur/redirect arbitraire. La donnée courante fait foi, le message décrit un événement passé.

Activation SQL séparée `app_notification_settings.enabled`, **déjà effectuée sur staging et recettée**. Les migrations sont désactivées par défaut pour une nouvelle installation ; ce défaut n’est pas l’état actif du staging existant. Ne pas désactiver la boîte lors d’un travail sur email.

### 6.7 Emails sensibles et workflow opérateur

Décision D030 : création UI président, désactivation/réactivation, octroi/retrait admin, transfert aux deux intéressés. **Aucun email CACI, sélection, covoiturage ou paiement.** Bienvenue informatif, pas d’invitation ou magic link. Import/bootstrap/recovery/seed sans email.

Audit et notification créés dans la même transaction. Clé déduplication audit/type. Tables privées RLS sans accès navigateur. Worker `member-notifications` avec secret d’appel dédié, SQL claim sous verrou, lot maximum **10**, bail **2 minutes**, Cron unique **chaque minute**. Aucun destinataire arbitraire dans body de requête.

Brevo : clé d’idempotence par notification, fenêtre documentée **30 minutes**, aucune garantie absolue exactly-once. 429 certainement refusé : reprise 1/2/4/8 minutes, max cinq tentatives. Refus 4xx : failed ; timeouts/5xx/perte d’ack/indéterminé : uncertain, pas de renvoi automatique. Accepted n’est pas preuve de réception. Pas de webhook livraison/bounce dans cette tranche.

Pas de replay historique : avis disabled/exclus non rejoués ; en attente >7 jours exclus ; reçus terminaux purgés après 90 jours pendant worker, audit conservé, incertitudes pour revue. Suspendre bloque nouveaux claims mais lot déjà réclamé peut finir pendant le bail. Ne pas annoncer annulation instantanée d’un email déjà transmis.

Audience : allowlist par défaut pour nouvelle installation ; `registered` explicitement actif sur staging après #69. Vérification adhérent réel lié à Auth confirmé et même email, exclusion seed et domaines réservés même après changement d’adresse ; pas de copie vers une boîte commune. Un désactivé peut recevoir un avis d’accès sans retrouver ses droits.

**Ne pas réinstaller simplement en reprenant le dossier.** Si une tâche l’exige :

```sh
npm run staging:notifications:install -- --all-members
npm run staging:notifications:install -- --all-members --apply
```

Sans apply : prévalidation sans écriture/déploiement/email. Avec apply : installation/configuration/déploiement/activation staging, aucun email de test généré par la commande, mais traitement de futurs événements/attentes éligibles possible.

Trois saisies en mode club : jeton personnel Supabase, clé API transactionnelle Brevo, expéditeur vérifié. Mode allowlist ajoute liste exacte de testeurs. En mode all-members, ne pas laisser une ancienne `NOTIFICATION_STAGING_RECIPIENTS` contradictoire exportée.

Permissions du PAT selon guide : staging seulement, Project Settings Read, Database Read-write, Edge Functions Read-write et Edge Function Secrets Read-write ; autres None. Un token readonly SQL ne peut pas lire Vault. Révoquer le PAT temporaire après installation. La clé API Brevo nécessaire au worker reste dans les secrets serveur, pas celle SMTP d’Auth.

Variables serveur : `NOTIFICATION_ENABLED`, `NOTIFICATION_ENV=preview`, `NOTIFICATION_RECIPIENT_MODE=registered` pour mode club, `NOTIFICATION_STAGING_RECIPIENTS` vide dans ce mode, `NOTIFICATION_SENDER_EMAIL`, `BREVO_API_KEY`, `NOTIFICATION_DISPATCH_SECRET` ; credentials Supabase injectés côté serveur. Jamais dans Netlify/VITE.

Installateur garde cible staging fixe, vérifie projet avant écriture, SHA des migrations reconnues, historique transactionnel, Vault réutilisé, Cron connu unique, readiness authentifiée worker avant activation. En échec après début, ferme portes email ; ne remplace pas une tâche inconnue. Ce n’est pas un outil général de réparation SQL ou d’activation production.

Migrations notifications importantes, ordre historique à conserver :

1. `20261008150000_member_notifications.sql` ;
2. `20261008160000_caci_notifications.sql` — historique, **pas le comportement final email** ;
3. `20261018110000_account_email_scope.sql` — retire périmètre email CACI ;
4. `20261018120000_in_app_notifications.sql` — boîte interne indépendante ;
5. `20261018210000_registered_member_emails.sql` — mode club explicite.

Diagnostic readonly utile : `docs/audits/member-email-runtime-check.sql`, résultats agrégés sans adresses ni secrets. Ne pas copier Vault ou les réponses Brevo en chat. Ne pas réappliquer manuellement des migrations déjà historisées pour un simple diagnostic.

### 6.8 PWA et identité visuelle

PWA V1 facultative et en ligne, décision D031 : manifest/icônes, mode standalone, aucun store natif, service worker, push, synchronisation ou écriture hors ligne. Pas de rechargement forcé pendant saisie ; cache des documents/métadonnées revalidé.

Android : proposition install si navigateur émet l’événement attendu ; navigateur intégré et onglet Chrome ne sont pas équivalents. iPhone : pas nécessairement de bouton automatique natif ; parcours Safari → Partager → Sur l’écran d’accueil, instructions prévues. Vraie recette iPhone non obtenue.

Chaque origine est une installation distincte : preview, staging, production ne partagent pas forcément sessions/icônes. Le fait d’avoir ouvert un lien dans navigateur n’établit pas toujours la session du contexte installé ; aide de collage même origine prévue.

D034 : `public/branding/apsap-plongee-2025.png`, `assets/branding/ifosse-dolphin-source.png` et prompt, `scripts/generate-app-icons.mjs`, exports `public/icons/ifosse-dolphin-*`, Apple 180, Android 192/512, maskable. Pas de génération IA réseau au build. Vérifier droits d’usage du logo avant transfert public.

## 7. Vérifications et séparation local/hébergé

### 7.1 Commandes locales connues

Depuis la racine du dépôt, Node 22.12+ et Docker local :

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run db:start
# Uniquement si la base de développement locale peut être détruite :
npm run db:reset
npm run db:test
npm run db:notification-install-check
npm run db:types -- --check
npx playwright install --with-deps chromium
npm run test:e2e
npm run db:restore-check
```

Lire CI et guides pour prérequis E2E, notamment fonction `create-member` servie localement. **db:reset n’est pas une commande de diagnostic sur staging.** Le drill restore exige socket/contexte Docker local et stack `ifosse` ; aucune URL/clé distante admise.

Setup manuel fictif : `npm run local:setup`, puis `node scripts/with-local-env.mjs npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`. App localhost:5173, messages locaux capturés 127.0.0.1:54324, Studio 127.0.0.1:54323.

Comptes réservés du setup : `organisateur@example.test` intentionnellement **président** aujourd’hui ; `membre@example.test` **member**. Une demande initiale disait organisateur admin ou président si explicite ; le setup final a choisi président pour tester droits/cycle de vie. Un navigateur privé ou profil distinct évite confusion de rôles. Aucune adresse réelle n’est nécessaire aux captures.

### 7.2 Totaux historiques, pas une seule « dernière suite verte » universelle

| État | Résultat / preuve | Limite |
| --- | --- | --- |
| Notifications #65/#68/#69, 18–19/10 | 350 unitaires/46 fichiers, 803 assertions pgTAP/24 SQL, 45 E2E ; typecheck/lint/build, types, reset et restore local peuplé | Historique de cette tranche, pas nouvelle run 24/10 |
| CI #129 | Succès sur tête #69 `cb61629` | Distinct du SHA merge ; Netlify a publié merge ensuite |
| #70 bulles | 356 unitaires/47 fichiers + deux scénarios Chrome, typecheck/lint/build | Preuve locale revue, pas toute recette hébergée |
| #71 branding | 358 unitaires et six scénarios Chrome desktop/mobile, typecheck/lint/build | Icône déjà installée dépend OS/navigateur |
| PR #82 | Corps annonce 360 unitaires, 807 pgTAP, 51 E2E, types/build/lint/typecheck | Déclaration PR, contredite pour suite complète par CI rouge au restore |
| CI #138 du 24/10 | Frontend checks succès ; Database migrations and permissions échec au restore-check | État actuel bloquant pour fusion #82 |

Références : [CI #129](https://github.com/stanislas-brossette/iFosse/actions/runs/39217839554), [CI #138](https://github.com/stanislas-brossette/iFosse/actions/runs/40077733333).

Le drill historique vérifiait Auth, propriétaires/ACL/RLS, paiements, snapshots sélection/palanquées, trajets, audit et compteurs, sans modifier la source hors fixtures fictives. Sa réussite locale ne prouve pas une restauration des services hébergés. Avertissement de taille bundle Vite >500 ko connu, distinct d’un échec de tests.

Aucun test produit relancé pendant la rédaction du présent document. Contrôle documentaire seul après écriture. Ne pas transformer cette passation en attestation de suite verte actuelle.

### 7.3 Ce qui a été vérifié en vrai ou rapporté

- Login magique hébergé via Brevo fonctionne ; previews finalement reviennent à la bonne origine après configuration/template.
- Seed synthétique visible aux testeurs, comptes réels coexistants.
- Désactivation et réactivation rapportées fonctionnelles ; hook activé par capture antérieure. Pas de nouvelle revue complète Auth aujourd’hui.
- Transfert de présidence fonctionnel rapporté avant fusion de sa PR ; email spécifique de transfert non testé par transfert artificiel récent.
- Notifications internes #68 recette 1–5 positive ; emails de compte reçus et captures ; CACI interne sans email ; mode all-members ensuite déclaré fonctionnel.
- Android installation validée et icône mise à jour après réinstallation selon essais rapportés ; iPhone absent.
- Staging actuellement déployé : constat Netlify du 24/10 détaillé dans état ci-dessous.

Non prouvé : pilote complet du club terminé, recette iPhone, restauration hébergée de bout en bout, rollout de vrai roster, production prête, délivrabilité parfaite future ou exactement une seule livraison email dans tous les scénarios distribués.

## 8. État exact au terme du transfert — constat du 24/10

### 8.1 Git local et distant

| Élément | Valeur constatée |
| --- | --- |
| Branche courante locale | `fix/72-protect-session-history` |
| HEAD local / tête PR #82 | `e7876d8d8f146359c3725db9918be53ca73a0243` |
| master local et GitHub | `2d2c55eb1c68c5c98ecd3aa255016fb1f5b73d79`, merge #71 |
| staging GitHub / origin/staging local | `2d2c55eb1c68c5c98ecd3aa255016fb1f5b73d79` |
| staging local | `b994039ed13b6821e4c9c6e00b25aef02654fcf6`, commit « claude setup », un commit en avance sur origin/staging |
| Diff suivi non commité avant rédaction | Aucun |
| Dossiers non suivis préexistants | `Claude outputs/`, `output/`, `review-issues/` |
| Nouveau fichier de cette demande | `docs/handoffs/2026-10-24-transfert-compte-personnel.md`, laissé non commité |

Le commit local staging ajoute `.claude/fix-issue.md`, `.claude/settings.json`, `CLAUDE.md`. Ne pas pousser ce commit automatiquement ni écraser la branche pour la « synchroniser ». Examiner son contenu et ses autorisations avant partage. Ne pas confondre staging local en avance et service hébergé actuel.

L’ancienne passation du 19/10 est maintenant **historique** : master/staging à cb030cf et aucune PR ouverte étaient vrais alors, plus aujourd’hui. Les audits qui étaient non suivis y sont désormais suivis. Ce document ne remplace pas les décisions produit ni ne transforme D035 de branche en fonctionnalité déjà déployée.

### 8.2 PR #82 : chantier ouvert précis

[PR #82](https://github.com/stanislas-brossette/iFosse/pull/82), liée à [issue #72](https://github.com/stanislas-brossette/iFosse/issues/72), créée le 24/10 à 10:21 Paris, ouverte et non fusionnée, base master `2d2c55e`. Une seule PR ouverte constatée.

Objet : empêcher `delete_session` de supprimer une séance dès que bilan closed, publication de sélection existante, ou participation avec attendance différente de unknown. Séances créées par erreur sans historique encore supprimables/auditées. Migration additive `20261024100000_protect_session_history.sql`, même signature/grants, pas de nouveaux champs/types générés. UI masque delete si publié/fermé ; pour présence sur séance ouverte non publiée, refus serveur explicite.

30 fichiers modifiés : migration, décision D035/specs, RPC/UI/tests, nettoyages de fixtures E2E via helper privilégié. Aucun état « annulée » inventé : décision produit séparée.

**CI actuelle : #138, run 40077733333, rouge.** Job Frontend checks vert. Job Database migrations and permissions échoue à l’étape `Run npm run db:restore-check`, après les étapes DB/types/E2E précédentes. Message confirmé :

```text
Restore drill cleanup incomplete; inspect local fictitious fixtures/temporary databases before retrying.
```

La cause affichée est undefined ; le script remplace les erreurs de cleanup par un message global. **Piste forte à confirmer :** dans `scripts/check-restore.mjs`, cleanup final appelle encore `public.delete_session` sur la fixture qui a été publiée, a des présences et un bilan clos. La nouvelle RPC la refuse logiquement. Le correctif a adapté des fixtures E2E, pas ce cleanup de restore. Inspecter l’erreur SQL précise dans une base strictement locale, corriger le nettoyage des seules fixtures possédées par ce drill et améliorer diagnostic si utile, sans affaiblir la protection métier.

Ne pas supprimer arbitrairement des données, ni contourner les invariants dans l’application. Un nettoyage privilégié d’une fixture de test locale prouvée n’est pas un nouvel endpoint de suppression métier. Rejouer le drill et les contrôles justifiés, mettre à jour les preuves PR, attendre CI verte. **Ne pas merger #82 dans cet état.** Aucune migration hébergée de #82 n’a été effectuée ou vérifiée pendant ce transfert.

### 8.3 Déploiement staging actuel

Netlify interrogé le 24/10 : site `ifosse-staging`, déploiement courant **`6ad723f8d80abb255bfcb5f3`**, état **ready**, branche **staging**, commit **`2d2c55e…`** (#71), publié le **20/10/2026 à 10:19:56 Paris**.

URL : [ifosse-staging.netlify.app](https://ifosse-staging.netlify.app).

Cela prouve la version frontend publiée, pas le détail de toutes les migrations/services Auth/Brevo actuels. PR #82 n’est pas dans cette version. La production n’a pas été inspectée ou modifiée par cette demande.

### 8.4 Worktrees

- Checkout principal : branche fix/72… ci-dessus.
- Ancien worktree actif déclaré : `.codex/worktrees/preview-auth-redirects/ifosse`, branche `codex/preview-auth-redirects`, `1238613` ; état interne à revérifier avant usage.
- Entrées `/tmp/ifosse-inapp`, `/tmp/ifosse-notification-compat`, `/tmp/ifosse-notifications-review`, `/tmp/ifosse-registered-emails`, `/tmp/ifosse-rpc-conflict` désormais **prunable** dans la liste Git. Leurs fichiers ne sont pas garantis récupérables. Ne pas traiter `/tmp` comme sauvegarde durable.
- Les branches historiques/sauvegardes ne sont pas des travaux à merger automatiquement.

### 8.5 Issues ouvertes vérifiées

| Issue | Sujet | Interprétation à la reprise |
| --- | --- | --- |
| #9 | Fondation repository | Texte de blocage hébergement historiquement périmé ; vérifier critères avant clôture |
| #18 | Durcissement et vrai lancement | Gates de production/pilote/recovery/confidentialité encore à établir |
| #62 | Bienvenue nouvel adhérent | Livré et recetté par #65/#69 ; candidate clôture avec preuves, pas encore fermée |
| #72 | Protection historique des séances | PR #82 ouverte, CI rouge |
| #73 | Brouillon palanquée à conserver sur retrait/republication | Demande de revue, non présentée comme implémentée |
| #74 | Réduction polling, pause zones masquées, résumé séance | À traiter en gardant cohérence/refresh |
| #75 | Avertir aussi admin sur son propre CACI absent/expiré lors du Oui | À vérifier/implémenter via tâche dédiée |
| #76 | Engagements futurs des comptes désactivés visibles aux organisateurs | Préserver historique et éviter retrait silencieux |
| #77 | Import calendrier pour saison quelconque | Pas seulement saison codée en dur |
| #78 | CSP, comparaison secret temps constant, pins uniques | Durcissement à examiner, pas preuve d’exploitation |
| #79 | Petits correctifs frontend : publication, bannière profil, erreurs notification, base64url | Périmètre exact dans issue et fichiers review |
| #80 | Purge anciennes notifications internes, blocage date séance fermée | Pas à confondre avec purge déjà existante de reçus email |
| #81 | Formatage, découpage composants, helpers SQL | Maintenance, ne pas élargir les bugs ciblés sans accord |

Lire les descriptions complètes avant de décider de leur ordre. Création des issues #72–81 constatée le 24/10 ; cela ne donne pas mandat global de les coder/merger dans cette demande documentaire.

## 9. Actions restantes par priorité

### P0 — sécuriser le transfert de compte et préserver le travail

1. Télécharger ce Markdown dans un emplacement personnel durable autorisé ; ne pas compter sur l’ancien compte ou `/tmp`.
2. Conserver les sources nécessaires et les changements non suivis après revue confidentialité. Préserver la branche fix/72 et le commit local staging, sans reset ni push forcé.
3. Restaurer soi-même les accès légitimes GitHub/Netlify/Supabase/Brevo sur le nouveau compte/outillage. Les connecteurs, sessions, secrets et permissions ne migrent pas avec le Markdown. Ne jamais demander les secrets dans la conversation.
4. Renvoyer ce document au nouvel assistant avec l’objectif courant explicite. Ne pas déclencher des actions hébergées seulement pour reconstituer le contexte.

### P1 — reprendre le chantier de code en cours si autorisé

1. Relire issue #72 et PR #82, AGENTS et D035 sur la bonne branche.
2. Confirmer diagnostic du cleanup restore local, corriger seulement les fixtures du drill, ajouter preuve de cleanup robuste et rerun pertinent.
3. Vérifier CI exacte tête PR, auto-relecture sécurité/concurrence/historique, tests desktop/mobile pertinents, description de PR à jour. Ne pas supprimer les tests ni affaiblir `delete_session` pour verdir le drill.
4. Préparer la recette/migration staging de #82 séparément, seulement si autorisée et après CI verte. Production hors périmètre.

### P2 — fiabiliser le dossier et préparer la suite

1. Réconcilier les issues #9/#62 avec les preuves de livraison ; actualiser les textes obsolètes (`docs/execution-status.md`, certains README/issues) dans une tâche ciblée, sans recommencer le scaffold.
2. Prioriser #73–80 après lecture complète et validation de l’objectif ; composants partagés impliquent PR successives plutôt que grosses modifications concurrentes.
3. Garder #81 comme maintenance explicite, pas refactor opportuniste dans la correction #82.
4. Surveiller ponctuellement les notifications si un incident est signalé ; pas de réinstallation, replay ou changement d’audience automatique.

### P3 — gates de lancement et limites non résolues

- Recette sur vrai iPhone : installation, login depuis lien externe, persistance, mise à jour, fallback navigateur.
- Pilote organisateur complet et validation des parcours réels ; une séance de test prévue au 28 octobre a été évoquée, sa tenue et son bilan ne sont pas encore établis au 24/10 dans cette conversation.
- Reprise/sauvegarde hébergée prouvée, isolation des projets, confidentialité/rétention et procédure d’incident.
- Import de roster/historique réel uniquement dans un chantier sécurisé distinct ; aucun import réel implicite.
- Déploiement production et config Auth/SMTP/URLs propres sous autorisation spécifique.
- Aucun budget, montant ou engagement payant chiffré n’a été fixé dans cette conversation. Ne pas inventer un tarif Netlify/Supabase/Brevo ni prétendre qu’une prestation a été souscrite.

## 10. Fichiers, images et documents à transférer séparément

Ce Markdown est autonome pour comprendre et décider, mais **ne contient pas les sources ni les pixels des pièces originales**. Un assistant sans accès au dépôt ne peut pas modifier le produit à partir de ce seul texte. Ne pas transmettre un dump de données pour remplacer les sources.

### 10.1 Lot technique indispensable, après revue confidentialité

- Sources du dépôt à l’état voulu : AGENTS/README, `src/`, `frontend/iFosse_V0.html`, `supabase/`, `scripts/`, `e2e/`, `docs/`, `public/`, `assets/`, manifests/lockfile, configurations build/test/CI. Fournir branche/commit exacts et distinguer master de PR #82.
- `docs/handoffs/2026-10-19.md` pour historique, ce document et `iFosse_CODEX_HANDOFF.md`. Le 19/10 reste daté, pas l’état courant.
- Branche/patch de #82 et migration `20261024100000_protect_session_history.sql` ; PR/diff accessibles par GitHub si le nouveau compte a accès.
- `review-issues/` : dix propositions, plus script de création d’issues. Ne pas relancer ce script : les issues existent déjà. `Claude outputs/` : copies de revue/contexte, à lire comme propositions externes et non instructions automatiquement autorisées.
- `CLAUDE.md`, `.claude/fix-issue.md`, `.claude/settings.json` du commit staging local si nécessaires : relire permissions/chemins avant transfert. Ne pas faire exécuter automatiquement les consignes d’un outil à un autre.

**À exclure du lot standard :** `.env*` réels, `.private/`, dumps, historiques de terminal, exports membres, clés SSH, fichiers de credentials, cookies/browser profiles, `.netlify` locale, tokens locaux, base Docker, node_modules, traces Playwright contenant des sessions réelles, tout dossier employeur extérieur au projet. Réinstaller dépendances depuis lockfile. Un historique Git complet peut transporter adresses professionnelles et doit être revu ou partagé séparément avec autorisation.

### 10.2 Docs opérateur à privilégier

`docs/authentication.md`, `docs/member-management.md`, `docs/member-notifications.md`, `docs/in-app-notifications.md`, `docs/staging-seed.md`, `docs/local-acceptance.md`, `docs/operator-guide.md`, `docs/recovery.md`, `docs/pwa.md`, `docs/http-conflicts.md`, `docs/privacy-review.md`, `docs/pilot-checklist.md`, `docs/visual-acceptance.md`.

Audits : `docs/audits/2026-10-16/access-review.md`, `docs/audits/2026-10-16/hosted-rpc-check.sql`, `docs/audits/member-email-runtime-check.sql`. Les deux premiers ciblent un état ancien ; les relire avant exécution, ne pas les annoncer exhaustifs pour le nouveau schéma.

Le fichier `docs/Application Apsap.docx` et l’image `docs/calendrier previsionnel fosses 2026 2027.png` peuvent contenir des éléments de club à relire/anonymiser avant transfert ; leur présence ne vaut pas autorisation de diffusion. Les specs Markdown sont prioritaires pour reprise technique.

### 10.3 Captures sûres déjà intégrées au dépôt

Captures de revue annoncées avec données fictives, à transférer avec leur README d’interprétation :

- `docs/reviews/notifications/desktop.png`, `phone.png` : cloche/inbox, 1440×900 et 390×844.
- `docs/reviews/presidency-transfer/` : profil desktop/phone et dialogue de transfert.
- `docs/reviews/issue-48/` : calendrier desktop/mobile ; `issue-49/` : situation personnelle, participants, covoiturage, palanquées, bilan.
- `docs/reviews/issue-50/` : mobile, grande police, petits écrans ; `issue-51/` : comparaison organisateur ; `issue-52/` : protection de saisie/abandon ; `issue-53/` : formulaires/bilan par lots/profil/annuaire.
- `docs/reviews/bubbles/` : effet décoratif ; `docs/reviews/branding/` : login/navigation, desktop/phone.

Vérifier visuellement l’absence de données réelles avant toute diffusion plus large, même pour un fichier décrit comme fictif. Les captures de composants avec service simulé ne prouvent pas un parcours Supabase hébergé.

### 10.4 Images de marque et essais

- Logo club : `public/branding/apsap-plongee-2025.png`.
- Source retenue : `assets/branding/ifosse-dolphin-source.png` et `.prompt.txt`.
- Icônes intégrées : `public/icons/` et `public/manifest.webmanifest`.
- Essais non suivis : `output/imagegen/favicon-apsap-v1.png`, `.prompt.txt`, `favicon-apsap-nudibranche-v2.png`, `.prompt.txt`. La variante nudibranche n’est pas la version retenue.

### 10.5 Pièces de la conversation d’origine à récupérer manuellement si encore accessibles

Les anciens chemins de type `/tmp/codex-remote-attachments/...`, `/tmp/codex-clipboard-...` et `.codex/attachments/...` ne sont pas des URLs exportables ni des sauvegardes durables. Ils peuvent avoir disparu. Les données utiles sont résumées ci-dessus ; ces originaux sont facultatifs pour reprise technique après anonymisation.

| Original cité | Contenu / utilité | Traitement avant transfert |
| --- | --- | --- |
| `iFosse_final_review_2026-10-03.md` | Revue finale initiale | Retrouver dans Downloads/export, vérifier informations internes |
| `iFosse_followup_review_2026-10-03.md` | Revue CACI stale editor | Fichier évoqué mais absent lors de l’implémentation ; ne pas prétendre l’avoir lu |
| `codex-clipboard-26faffc9-62cf-4476-b347-08184ac77419.png` | Désactivation président refusée | Masquer identités/emails/CACI |
| `codex-clipboard-bd5e33d6-6065-4f95-9ddb-fe682faf3d68.png` | Dashboard Auth Hooks vide | Masquer compte/organisation, pas de secret |
| `codex-clipboard-08b464e7-a1cf-493d-bfc7-aa70821759d2.png` | Hook activé | Idem |
| `44227.jpg` | Création d’adhérent indisponible sur téléphone | Masquer formulaire email/noms |
| `codex-clipboard-f17f8d34-653f-4c41-a4c2-ae32569afdde.png` | Sélecteur de saison à supprimer | Image UX simple, vérifier cadrage |
| `codex-clipboard-260be67a-2b18-46dd-abf9-fbdeabd40154.png` | Déploiement staging échoué | Masquer informations de compte si présentes |
| `44944.jpg` | Publication nécessite mise à jour serveur | Masquer éventuelles données de séance/personnes |
| `codex-clipboard-1de3b271-3f4c-4fa1-aea1-0ccf011dee78.png` | Résultat audit rls_auto_enable | Revue avant copie, SQL générique seulement |
| `codex-clipboard-60a57fb8-a334-4153-96e3-643de6ccdf2b.png` | Redirect URLs Supabase | Masquer compte/organisation |
| `codex-clipboard-40b3e6e1-56e2-4c8c-b9fe-e75f2ab9373e.png` | Template magic link | Aucun vrai token, mais masquer compte |
| `45037.jpg`, `45038.jpg` | Absence bouton install et échec Chrome Android | Masquer profil/CACI en arrière-plan |
| `45042.jpg` | Échanges mail lancement de tests | Données personnelles/correspondance : ne pas transférer brut |
| `codex-clipboard-0b862a5e-8fd8-4f4c-8cbb-1a6185ab506c.png` | Graphe branches notifications | Revue des noms/metadata |
| `codex-clipboard-f6566aa3-58ef-4e10-a580-8f5a001b2289.png` | Permissions PAT Supabase | Ne jamais transférer une valeur de token |
| `codex-clipboard-50c504e3-c37a-4f1a-9b9f-96f3bec0869b.png` | Email bienvenue reçu | Anonymiser email/prénom |
| `codex-clipboard-78707753-241d-4e2d-ad98-1bb292c60a88.png` | Email octroi admin | Anonymiser |
| `codex-clipboard-772db2b5-8efb-4865-9188-c3b09e96f2ce.png` | Email retrait admin | Anonymiser |
| `codex-clipboard-16705d75-de27-4f04-ab63-564e3442e360.png` | Email désactivation | Anonymiser |
| `codex-clipboard-d6eefe62-9979-4540-8a45-8f5f1d340f15.png` | Email réactivation | Anonymiser |

Textes joints sous le nom récurrent `Pasted text.txt`, à identifier par leur sujet et non le seul nom :

- Journal build Netlify joint avec capture staging échoué : ancien répertoire d’attachement `4ddc56a5-ce4b-4659-8b9a-aff4c499c933`.
- Résultats d’audits SQL : anciens répertoires `187d68c3-a128-4a87-b5c6-959d2e619285` et `d6f54a85-ac47-4358-a73f-b8fcdc2aaf53`.
- Demande PWA V1 originale : ancien répertoire `24c5c6b5-77a7-4309-9195-0416eca5c915`.

Les logs Netlify recopiés dans les messages sont résumés dans ce document ; pas besoin d’exporter un journal contenant des valeurs privées. Un export intégral de conversation ou de sessions Codex exige la même revue de confidentialité ; ne pas l’envoyer aveuglément sur le compte personnel.

### 10.6 Liens dont l’accès doit être rétabli

- Dépôt et PR/Issues GitHub référencés, Actions et artefacts (rétention limitée ; certains screenshots CI étaient conservés sept jours).
- Netlify des deux sites, principalement staging pour recette ; aucune copie de credentials dans Markdown.
- Supabase staging/production avec permissions séparées, Auth URL/template/hooks, Edge Functions, secrets, Cron/Vault.
- Brevo pour expéditeur vérifié, API transactionnelle, SMTP Auth et diagnostics autorisés.

Ces accès ne sont pas implicitement transférés par un nouveau compte ChatGPT. Aucun connecteur de l’ancien compte n’est garanti dans le nouveau.

## 11. Instructions pour reprendre la conversation

Copier le texte suivant au nouvel assistant, avec ce fichier joint et l’accès autorisé aux sources. Cette section constitue le point de départ ; elle ne demande pas d’agir sur les services hébergés.

> Je reprends iFosse sur un nouveau compte personnel. Tu n’as pas accès à l’ancienne conversation : lis intégralement ce document de transfert daté du 24 octobre 2026 et traite ses états comme des photographies datées. Respecte les informations exclues pour confidentialité ; ne me demande aucun secret à coller dans le chat.
>
> Lis AGENTS.md, docs/decisions.md, docs/specs.md, docs/roadmap.md, docs/architecture.md, docs/data-model.md puis les guides pertinents. Vérifie l’état Git, les fichiers non commités, les worktrees, les PR et la CI avant toute modification. À la dernière vérification : branche locale fix/72-protect-session-history à e7876d8 ; master et staging distants à 2d2c55e (#71), staging local a un commit « claude setup » b994039 à préserver ; PR #82 seule ouverte, liée à issue #72, CI #138 rouge sur db:restore-check. Les PR #65, #66, #68, #69, #70 et #71 sont déjà fusionnées. Ne confonds pas #72 issue avec une PR fusionnée.
>
> Le staging a des utilisateurs actifs. Notifications internes et emails sensibles pour tous les adhérents réels éligibles y ont été activés et recettés ; aucun email CACI/opérationnel. PWA Android validée, iPhone non testé. Production est isolée et hors périmètre. Ne lance ni seed, reset, installation de notifications, envoi de test, migration hébergée ou nettoyage pour simplement reprendre le contexte. Préserve les dossiers non suivis et n’écrase aucune branche.
>
> Commence par confirmer ce que tu peux vérifier et les limites de tes accès. Si je confirme que l’objectif est de reprendre #82, inspecte les logs du run courant et scripts/check-restore.mjs : le cleanup utilise encore delete_session sur une fixture publiée/avec présences/bilan clos, désormais interdite par la nouvelle RPC. C’est une piste forte à confirmer. Corrige uniquement le nettoyage privilégié des fixtures locales dont le drill prouve la propriété, sans affaiblir la protection historique ni supprimer les tests. Ajoute les preuves de régression utiles, exécute les vérifications adaptées et assure-toi que toute la CI est verte sur la tête finale ; mets à jour la PR avec les faits, pas seulement les résultats déclarés dans son ancien texte.
>
> Pour toute autre tâche, demande-moi l’objectif précis plutôt que lancer automatiquement les issues #9–18 ou #72–81. Avance de façon autonome sur les choix techniques courants compatibles avec le périmètre, dans une branche/PR ciblée, avec auto-relecture sécurité/régression. Signale les contradictions produit importantes. Distingue toujours preuve locale, CI, configuration, déploiement et recette humaine. Ne fusionne pas de PR ni ne déploie en production sans mon accord applicable à ce nouveau chantier.
