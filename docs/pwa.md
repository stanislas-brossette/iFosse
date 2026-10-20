# Installer iFosse sur son téléphone — PWA V1

L’installation est facultative : le site reste utilisable normalement dans le navigateur. Elle ajoute une icône et une fenêtre autonome, sans Play Store/App Store, compte supplémentaire, mot de passe ou application native. Une connexion Internet reste nécessaire pour consulter/actualiser les données et enregistrer les actions.

## Android / Chrome

Ouvrir l’adresse habituelle du club dans Chrome. Lorsque le navigateur autorise l’installation, **Mon profil → iFosse sur mon téléphone → Installer iFosse** ouvre sa demande native. Le menu Chrome peut aussi proposer **Installer l’application**. Confirmer, puis ouvrir l’icône iFosse. L’apparition du bouton dépend du navigateur, de l’engagement et de ses critères ; elle n’est pas immédiate ni garantie dans tous les navigateurs intégrés aux messageries.

Une annulation ne déclenche pas de nouveau dialogue automatique. Le contrôle ne réutilise pas un événement d’installation déjà consommé. Après `appinstalled` ou dans une fenêtre autonome, les suggestions disparaissent. Aucun état d’installation n’est enregistré dans Supabase ni dans les données d’authentification.

## iPhone / iPad

Ouvrir le site dans **Safari**, puis **Partager → Sur l’écran d’accueil**. Si Safari propose **Ouvrir comme app web**, laisser cette option active. Ouvrir ensuite l’icône. Mon profil affiche ces instructions sur Safari iOS/iPadOS, sans faux bouton d’installation native, et les masque en mode autonome.

### Connexion dans l’application installée

Le stockage de la fenêtre installée peut être distinct de celui du navigateur. Une connexion Safari préexistante n’est donc pas une garantie de connexion dans iFosse installé. Demander le lien depuis le contexte dans lequel on souhaite se connecter.

Si le lien reçu ouvre Safari au lieu de la fenêtre iFosse :

1. Revenir à l’application installée, sur l’écran **Consultez votre messagerie**.
2. Déplier **Le lien ouvre mon navigateur au lieu d’iFosse**.
3. Dans l’email original, copier l’adresse du bouton **Se connecter à iFosse**, sans la confirmer ailleurs ; revenir dans iFosse et la coller dans le champ masqué.
4. Choisir **Vérifier mon lien**, puis **Se connecter**. La confirmation actuelle est conservée, jamais automatique.

Le lien doit être celui de cette même adresse iFosse, avec le chemin `/auth/confirm` et le fragment token/type habituel. Liens d’une autre origine/environnement, paramètres de requête, identifiants URL, tokens invalides/dupliqués et types autres qu’email sont refusés. Aucun redirect fourni par l’utilisateur n’est suivi. Le champ est vidé après validation ; le lien n’est pas enregistré ni ajouté à l’URL. Aucune lecture automatique du presse-papiers, aucun échange de sessions entre contextes.

Un lien expiré ou déjà confirmé ailleurs exige une nouvelle demande. Les liens réécrits par un outil de suivi d’emails ne sont pas déballés automatiquement : conserver le template et la désactivation du suivi documentés dans [Authentification](authentication.md). Ne jamais partager/capturer un lien de connexion.

## Architecture et mises à jour

- Manifest statique `/manifest.webmanifest` : `id=/`, `start_url=/seances`, `scope=/`, `display=standalone`, libellés français et couleurs actuelles. Toutes les ressources sont relatives à l’origine courante ; callback inclus dans le scope. Une installation staging reste staging, une installation de preview reste sur cette preview.
- Icônes tour Eiffel–dauphin approuvées par le propriétaire : PNG 16/32 pour le navigateur, 192/512 pour Android, maskable 512 et Apple 180, sur fond blanc opaque pour conserver le contraste. Source dans `assets/branding/ifosse-dolphin-source.png`. L’emblème complet du maskable tient dans le cercle central de rayon 40 % ; voir [la zone de sécurité](https://web.dev/articles/maskable-icon). Les nouvelles URL `ifosse-dolphin-*` sont référencées par HTML/manifest ; les anciens fichiers restent disponibles pour les manifests déjà en cache. Régénération mainteneur : `node scripts/generate-app-icons.mjs` avec le Chromium Playwright installé (ou `GOOGLE_CHROME_PATH` vers Chrome local).
- **Aucun service worker enregistré** : aucun precache, Cache Storage applicatif, interception Auth/API, background sync, push ni écriture hors ligne. Les critères Chrome actuels permettent ce premier périmètre ; vérifier le comportement des appareils réellement ciblés. Aucun plugin PWA ni dépendance de production supplémentaire.
- Netlify conserve le build, la réécriture SPA, les protections et les assets hashés immuables. Les documents d’entrée, routes actuelles, manifest et icônes non hashées sont explicitement revalidés (`max-age=0, must-revalidate`). Les règles sont communes aux sites/contexts, sans changement des variables `VITE_*`.
- Un déploiement est reçu lors d’une nouvelle navigation réseau/recharge ; une fenêtre déjà ouverte peut continuer sa version jusqu’à sa prochaine ouverture/recharge. Aucun rechargement automatique pendant une saisie, aucun effacement de session ou de données. Le navigateur/OS peut mettre plus longtemps à rafraîchir un nom/une icône d’installation ; la V1 ne promet pas une mise à jour instantanée de ces métadonnées.
- Hors réseau, pas de nouvelle consultation ou écriture garantie, pas de page métier hors ligne mise en cache ni de file d’attente. Des données déjà rendues en mémoire peuvent rester à l’écran comme dans le site actuel ; elles ne constituent pas une synchronisation hors ligne.

## Déploiement et recette

Ce changement frontend ne nécessite **aucune migration SQL, nouveau secret, nouvelle fonction Edge ou entrée de redirect Supabase**. Les prérequis Auth existants restent obligatoires. Les comptes, permissions et données sont conservés. Cette PR ne déploie pas en production.

Valider une Deploy Preview avec le projet Supabase staging existant. Pour les installations quotidiennes des testeurs, utiliser ensuite l’adresse staging principale stable : une preview est une installation distincte qui ne se transforme pas en production quand la PR est fusionnée. Le passage futur à l’adresse production nécessite son installation/connexion séparée ; les données ne sont pas transférées par la PWA.

### Preview protégée par Netlify

La connexion Netlify qui autorise l’ouverture d’une preview est distincte de la connexion adhérent Supabase. Le lien HTML du manifest utilise `crossorigin="use-credentials"` pour transmettre la session du navigateur, même sur la même origine. Sans cet attribut, un manifest protégé peut répondre HTTP 401 et le bouton d’installation reste absent. Un test navigateur couvre ce refus en l’absence du cookie.

Cela ne garantit pas la génération d’une application Android : les ressources nécessaires peuvent aussi être récupérées sans la session Netlify du navigateur par les services d’installation. Si manifest/icônes restent protégés et que Chrome refuse l’installation, effectuer la recette sur une adresse staging où ces ressources sont publiquement accessibles, après décision explicite de l’opérateur sur la protection du site. Ne pas contourner cette protection avec un secret dans le manifest ni modifier les règles de production. La PR ne désactive aucune protection Netlify ; une installation réelle ne peut pas être déclarée validée sur la seule base des tests locaux.

### Téléphones réels — critères de recette encore obligatoires

Les tests Chromium qui émulent un user-agent Safari ou un mode standalone ne prouvent ni l’installation OS ni le comportement de Mail/Safari sur iOS.

- **Android Chrome** : sur staging, installer via le menu et/ou le bouton quand disponible ; vérifier icône, mode autonome, connexion, navigation séances/profil, absence de nouvelle suggestion, fermeture/réouverture et session persistante. Annuler une installation puis réessayer via le menu.
- **iPhone/iPad Safari** : ajouter à l’accueil, ouvrir l’icône, se connecter depuis ce contexte. Tester l’ouverture de l’email et, si Safari s’ouvre séparément, le collage du lien dans la fenêtre installée. Vérifier confirmation explicite, retour à la séance, session après réouverture et déconnexion confirmée. Vérifier qu’une connexion dans le navigateur séparé n’est pas supposée se propager à l’app.
- **Preview** : vérifier manifest/icônes publics et callback sur la même origine, sans retour involontaire au staging principal. Un lien production doit être refusé par le champ d’une preview et inversement.
- **Version A → B** : installer A sur une adresse staging stable, laisser une saisie non enregistrée ouverte et déployer B. Vérifier absence de recharge forcée ; enregistrer/annuler puis recharger volontairement et contrôler B sans réinstallation et sans perte du compte. Vérifier les en-têtes réels Netlify sur HTML/manifest et un asset hashé.
- **Réseau coupé** : constater qu’aucune action n’est présentée comme synchronisée avec succès et qu’aucune modification n’est rejouée en arrière-plan ; revenir en ligne et actualiser.
- Inspecter les zones sûres, le clavier, les champs et la navigation basse sur les téléphones ciblés ; 390×844 en simulation ne remplace pas un appareil avec encoche/barre système.

Références : [critères d’installation Chrome](https://web.dev/articles/install-criteria), [stockage et cookies des apps à l’accueil sur WebKit](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/), [en-têtes Netlify](https://docs.netlify.com/manage/routing/headers/).
