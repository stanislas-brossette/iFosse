# Guide court d’exploitation iFosse

## Préparer les environnements

Créer/configurer deux projets Supabase EU distincts : production privée pour le club, staging avec données fictives pour previews et essais. Appliquer les migrations revues séparément au bon projet; le build Netlify ne migre pas la base.

Lier le dépôt à deux sites Netlify : `ifosse-staging.netlify.app` avec branche principale `staging`, et `ifosse.netlify.app` avec branche principale `master`. Le contexte Netlify `production` du premier reçoit `VITE_APP_ENV=preview` / `VITE_SUPABASE_PROJECT_ENV=preview` et le projet Supabase `ifosse-staging`; celui du second reçoit les deux marqueurs `production` et le projet `ifosse-production`. TOML ne fixe aucun marqueur d’environnement iFosse.

Configurer les six variables publiques avec scope Builds pour chaque site/contexte selon la [matrice exacte du README](../README.md#deployment-environments); les deploy-preview/branch-deploy activés utilisent toujours les marqueurs preview et le projet staging, sur les deux sites. Éviter tout héritage de valeurs production dans les previews. Les réglages du dashboard restent une étape opérateur séparée. Les URL fixées `VITE_PREVIEW_SUPABASE_URL` et `VITE_PRODUCTION_SUPABASE_URL` doivent être différentes; `VITE_SUPABASE_URL` doit correspondre au contexte. Seules les six variables publiques décrites dans le README sont autorisées. Aucun secret/service-role ne reçoit un préfixe `VITE_` ou une place dans le build frontend.

Suivre [l’authentification](authentication.md) pour désactiver signup public/anonymous, garder le fournisseur email actif, fixer `/auth/confirm`, installer le template, SMTP et expiry. N’autoriser les URL de preview que sur staging. Tester réception, scanner d’email, lien expiré/réutilisé, autre navigateur et déconnexion avec les organisateurs. Vérifier [la reprise](recovery.md) et signer [la revue de confidentialité](privacy-review.md).

## Importer sans démo ni invitations

L’opérateur conserve le roster réel hors dépôt et utilise le schéma JSON strict `{ email, first_name, last_name }`. Les permissions et la présidence sont gérées séparément. Aucun roster réel n’a été fourni ici.

```sh
npm run members:import -- /CHEMIN_PRIVE/roster.json
npm run members:import -- /CHEMIN_PRIVE/roster.json --apply
```

Le premier passage est une validation offline; le second utilise `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans un environnement opérateur privé. Il ne crée ni password ni invitation. Un échec de liaison se reprend avec le même fichier; ne pas recréer les identités au hasard. Provisionner puis faire vérifier la connexion du président selon le guide d’authentification.

L’import n’initialise ni niveaux ni CACI. Avant le pilote, chaque membre renseigne son niveau actuel/préparé dans **Mon profil**, puis les organisateurs vérifient l’annuaire et renseignent la date CACI dans **Administration**. Consigner les données encore manquantes plutôt que les considérer valides. L’interface actuelle laisse les champs ordinaires à leur propriétaire et permet aux admins la maintenance du CACI; email/Auth restent coordonnés par l’opérateur. Cette portée plus étroite que l’éditeur V0 doit être validée avec les organisateurs, sans prétendre à une parité complète des écrans.

Le calendrier [2026–2027](../data/calendar-2026-2027.json) reprend les 11 dates de l’image source. Les fins du 4 novembre et du 9 décembre sont estimées; l’adresse reste vide. Les trois flags de vacances sont repris explicitement de la référence V0, sans calcul automatique. Faire confirmer lieu, horaires estimés, adresse et flags par les organisateurs avant usage réel. Les inscriptions/compteurs/sélections fictifs de la V0 et les séances inventées des 9/23 septembre sont exclus.

```sh
npm run calendar:import -- data/calendar-2026-2027.json
npm run calendar:import -- data/calendar-2026-2027.json --apply --target-url https://PROJET.supabase.co
```

L’URL explicite doit correspondre à `SUPABASE_URL`. Un seul RPC transactionnel importe le fichier : source stable par date, fingerprint et audit. Réessayer le même fichier ne duplique rien et n’écrase pas les corrections ultérieures d’un organisateur. Une source modifiée ou une séance créée manuellement à la même date/heure bloque l’import pour revue. Ne pas supprimer une séance utilisée pour contourner ce contrôle; retrouver l’origine, conserver les données, puis corriger via l’interface ou une opération d’association de source revue par l’opérateur.

## Faire une fosse depuis un téléphone

Utiliser la navigation **Séances / Mon profil / Administration** : barre latérale sur ordinateur, barre fixe en bas sur téléphone. L’identité et le rôle courant figurent en haut. L’annuaire et les droits ne sont pas montrés aux membres ordinaires. Un changement de vue conserve le travail de séance; une modification enregistrée en base se retrouve sur un autre appareil.

Les cartes indiquent les confirmés de la dernière sélection publiée et la capacité, avec une barre d’occupation. « Sélection non publiée » signifie qu’aucune publication n’existe; un brouillon ne change jamais ce chiffre. Un désistement libère immédiatement une confirmation effective.

1. **Séances → Nouvelle séance** : date, horaires Paris, lieu, capacité (20 par défaut), inscriptions et vacances explicites. Dire Oui reste possible au-delà de la capacité.
2. Les membres répondent **Oui / Peut-être / Non**. Le CACI manquant/expiré au jour de la séance produit un avertissement à confirmer. Quitter un Oui confirmé ou retirer une voiture occupée via la réponse demande une confirmation des conséquences; annuler conserve la réponse et les places. Cela vaut aussi pour une correction administrateur. Administration permet de renseigner le CACI; Mon profil permet à chacun de consulter le sien.
3. **Gestion** : rechercher un nom dans la sélection, puis travailler la sélection, utiliser les compteurs et le checklist CACI/transport/paiement, puis **Publier la sélection → Confirmer**. Le récapitulatif précise sa base : brouillon privé ou sélection publiée, pour le membre et son conducteur. « Brouillon prêt à publier » ne signifie pas encore confirmation publiée. La correction de réponse d’un adhérent reste accessible dans « Corriger une réponse », sous la sélection. Les actions de publication restent visibles pendant le défilement. Les encadrants comptent dans la capacité.
4. **Covoiturage → Proposer une voiture** : formulaire à la demande, places passagers hors conducteur, rendez-vous et inscriptions. Un conducteur en attente peut proposer une voiture; ses trajets restent provisoires jusqu’à confirmation publiée. Après retrait/exclusion d’une voiture, ses passagers restent inscrits mais doivent reprendre un trajet. Sans habitudes déjà enregistrées, une nouvelle offre propose explicitement de mémoriser places/rendez-vous : « Garder une offre ponctuelle » conserve seulement l’offre de séance. Une voiture empruntée n’écrase pas automatiquement les habitudes existantes; aucune offre future n’est créée par le profil.
5. **Gestion** : indiquer À régler/Payé/Gratuit. Le membre voit seulement son paiement. Le récapitulatif est opérationnel, sans validation médicale/réglementaire.
6. **Palanquées** : affecter uniquement les confirmés publiés; drapeau Encadrant informatif. Publier explicitement. Si la sélection change, vérifier puis republier; abandonner un brouillon périmé. Les profils non classés restent dans le total.
7. Après l’heure de fin Paris, **Bilan** : renseigner les présences réelles, y compris les remplacements avec « Afficher tous les adhérents », puis clôturer après vérification. Tous les confirmés doivent avoir une présence renseignée; le nombre de plongeurs respecte la capacité. Seuls les A plongé d’un bilan clôturé comptent de septembre à août.
8. Pour corriger : **Rouvrir → Confirmer**, modifier puis clôturer de nouveau. La réouverture retire temporairement la séance du compteur et conserve les présences; elle ne rouvre pas les inscriptions. Les paiements restent corrigeables même après clôture.

## Incidents courants

Un lien expiré/réutilisé se remplace par une nouvelle demande. Pour un email inconnu, vérifier le roster et le lien Auth/profil avec l’opérateur, sans révéler l’existence d’autres comptes. La correction d’email doit être coordonnée avec Supabase Auth puis le profil lié; ne pas modifier uniquement la colonne email. Ne pas demander un service-role dans le chat ou à un organisateur de le copier dans le navigateur.

Pour un appareil perdu, révoquer les sessions côté Auth et, si le blocage club doit être immédiat, bannir le compte concerné; un simple logout sur un autre téléphone ne révoque pas le jeton d’accès perdu. Pour retirer les droits admin, le président utilise le transfert/gestion de droits; les RPC relisent les rôles immédiatement. La récupération de présidence suit la procédure opérateur auditable du guide d’authentification, pas une auto-promotion.

Après une erreur de sélection, abandonner un brouillon ou préparer/publier une nouvelle version; ne pas éditer un ancien snapshot. Pour un conflit de capacité/voiture, actualiser et vérifier les effectifs avant une nouvelle tentative. Éviter de dupliquer des séances pour masquer un conflit.

Les événements importants sont dans `audit_events`, lisibles par admin/opérateur et non modifiables via le navigateur. Inspecter acteur, cible, séance, type, date et payload minimal. Publications, CACI, paiements, présences, bilan, rôles et import sont audités. Pour une perte de données, appliquer le [runbook de reprise](recovery.md), sans supprimer les protections pour faire passer la restauration.

## Voiture habituelle et modifications rapides

Dans **Mon profil > Ma voiture habituelle**, cocher « J’ai habituellement une voiture disponible » puis renseigner les places passagers habituelles (hors conducteur) et le rendez-vous habituel. **Enregistrer mon profil** conserve ces préférences. Elles préremplissent uniquement une proposition future; elles ne créent aucune offre. Départ et note restent propres à chaque séance.

Dans **Covoiturage**, une offre existante apparaît en résumé **Ma voiture** avec places libres, rendez-vous/départ et passagers. **Modifier ma voiture** ouvre les valeurs actuelles; enregistrer avec succès referme le formulaire. Un refus conserve la saisie; annuler revient au résumé. **Retirer ma voiture** conserve la confirmation lorsqu’elle transporte des passagers, qui restent inscrits à la fosse. Une nouvelle offre se crée toujours avec **Proposer une voiture**.

Dans l’annuaire, enregistrer un CACI avec succès actualise immédiatement son statut/date et referme l’éditeur. Un conflit ou refus le laisse ouvert avec la saisie et les options de reprise existantes. L’éditeur de son propre profil reste ouvert après sauvegarde.

## Peupler uniquement le staging avec des données inventées

Le [workflow synthétique staging](staging-seed.md) fournit `npm run staging:seed` (prévalidation/plan en lecture seule), puis `npm run staging:seed -- --apply`. Il est fixé au projet **ifosse-staging**, vérifie positivement URL, environnement et JWT service-role du projet, et refuse production. Appliquer d’abord sa migration sur staging. Les 30 identités réservées `.invalid` et sept séances utilisent les RPC métier, sans emails/passwords. Le registre privé permet de relancer sans doublons ni écrasement des essais; aucun reset/delete n’est proposé. Les comptes réels des testeurs et leurs droits sont préservés.

## Gestion des adhérents

[Guide complet](member-management.md) : annuaire unique avec recherche nom/email, filtres et CACI pour admin; création, droits et désactivation/réactivation uniquement pour président. La suspension conserve l’historique. Déployer la fonction et activer le hook Auth sur staging avant utilisation; aucun déploiement production n’est inclus. Les scripts opérateur restent le chemin bootstrap/récupération.

Netlify preview magic-link setup: use the exact staging Site URL and narrow `/auth/confirm` redirect entries in [Hosted Auth configuration](authentication.md#staging-and-netlify-deploy-preview-redirects). Ensure the hosted email template uses `.RedirectTo`, and keep preview redirect rules out of production Supabase.

## Lire le calendrier personnel

Le calendrier démarre sur **À venir** (aujourd’hui inclus, date de Paris).
**Passées** donne aussi accès aux séances dont le bilan est encore ouvert ;
**Toutes** affiche toute la saison choisie. Les commandes de saisons adjacentes
permettent de retrouver les anciens bilans. **Prochaine séance** met en évidence
la première séance future non clôturée, sans créer une seconde carte.

Chaque carte distingue **Ma réponse / Ma sélection / Mon trajet / Mon paiement**.
La sélection et l’occupation viennent exclusivement de la publication effective.
Un trajet passager ou conducteur reste **Provisoire** tant que le conducteur
n’est pas confirmé. **Organiser mon trajet** ouvre directement Covoiturage sans
réserver de place. Le paiement est « Non concerné » sans réponse ou avec Non.
Une sélection pleine n’empêche pas de répondre Oui si les inscriptions restent
ouvertes. Le rappel disparaît lorsque votre réponse est déjà Oui. En cas d’échec d’actualisation, lire l’avertissement : les données
précédentes restent affichées et **Réessayer** relance leur chargement.

Recette locale avec identités fictives : observer les cartes sur deux appareils,
modifier un brouillon (aucun changement côté adhérent), publier puis republier,
retirer une réponse confirmée, rejoindre la voiture d’un conducteur non confirmé
puis le confirmer par publication. Vérifier également aujourd’hui, une séance
passée non clôturée, une saison vide et un bilan ancien ; couper le réseau doit
conserver les statuts reçus et afficher l’avertissement. La suite Playwright
`calendar-personal.spec.ts` couvre ces actions et `visual-acceptance.spec.ts`
vérifie les captures 1440×900 et 390×844 avec 50 identités inventées et 20 confirmés.
La migration du calendrier doit être appliquée sur staging avant le nouvel écran ;
aucun déploiement hébergé n’est effectué par cette PR.

### Restaurer / mettre en service le calendrier de la PR #54

Le frontend et la base sont déployés séparément. Un merge Netlify ne lance pas
les migrations Supabase ; un revert/force-push Git ne les annule pas non plus.
Le calendrier exige les champs personnels de `get_session_card_summaries`.
Une base ancienne est signalée explicitement, sans inventer de statuts personnels.

Pour la recette **staging uniquement**, ouvrir le projet **ifosse-staging**
(référence `btpojwwwsxrepsehmxbm`) et vérifier en lecture seule dans SQL Editor :

```sql
select pg_get_function_result('public.get_session_card_summaries(integer)'::regprocedure);
```

Le résultat doit inclure, en plus des quatre champs d’occupation,
`my_rsvp`, `my_selection_state`, `my_transport_mode`,
`my_transport_provisional` et `my_payment_status`.
S’ils manquent, appliquer au projet staging les migrations revues manquantes dans
l’ordre, jusqu’à `supabase/migrations/20261007010000_calendar_personal_status.sql`,
avec le workflow opérateur de migration. Ne pas faire de reset ni de seed pour
corriger le schéma : cette migration conserve les adhérents, séances et historiques.
Si ces champs sont déjà présents, ne pas annuler la migration lors d’un revert UI.

Après migration, tester le deploy preview avec un nouveau lien de connexion,
un compte adhérent et un compte admin ; vérifier statuts personnels, Covoiturage,
filtres/saisons et publication. Fusionner le frontend après cette recette.
Les réglages Auth de la PR #55 restent requis et sont conservés. Aucun changement
production n’est autorisé par cette procédure de recette staging.
