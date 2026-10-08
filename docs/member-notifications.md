# Notifications de compte par email

Première tranche demandée par le propriétaire : création depuis l’interface Président, désactivation/réactivation, attribution/retrait admin, transfert de présidence (un email à chacun des deux intéressés). Une modification effective du CACI par admin/président prépare également un avis au seul adhérent concerné, y compris pour son propre CACI. Pas de paiement, séance ou autre modification personnelle dans cette tranche. Pas de newsletter ni de préférences transversales.

Le bienvenue explique comment demander le magic link habituel ; il n’est ni une invitation Auth, ni un lien de connexion, ni une création de mot de passe. Le signup reste fermé. Les changements conservent leurs autorisations SQL actuelles. Les imports, bootstrap/récupération opérateur et seed ne déclenchent aucun email. Un changement CACI réussi utilise son audit existant : valeurs identiques (y compris absent → absent), refus, conflit ou rollback ne créent pas de nouvel avis. Le texte demande de consulter Mon profil ; aucune date de validité ni document ne quitte la base. Le statut email reste visible après fermeture de l’éditeur de l’annuaire ; une sauvegarde sans changement ne reprend pas un ancien reçu.

## Architecture et garanties

Le nouvel audit d’une opération réussie crée sa notification dans **la même transaction**. Aucun réseau dans SQL, aucun envoi depuis React ou `create-member`. Une transaction annulée ne laisse pas d’email ; les no-op et le rejeu d’une création n’en créent pas deux. La contrainte `(audit_id,kind)` déduplique chaque événement ; une nouvelle modification légitime est un nouvel événement.

`member_notifications` conserve une adresse et un prénom figés, le type, la date et un reçu minimal. Aucune date CACI, document médical, token ou réponse fournisseur brute. La date dans le texte précise l’événement concerné ; les droits actuels restent ceux de l’application. Une adresse modifiée/non liée depuis l’événement n’est pas utilisée et n’est pas remplacée automatiquement par une nouvelle.

Tables sous RLS, aucun SELECT/INSERT/UPDATE navigateur. Seul le service interne peut réclamer/accuser les tâches. Un admin actif peut lire uniquement un statut borné de **sa propre opération**, sans corps, adresse ou secret. Après transfert, l’ancien président devenu admin conserve son reçu. L’interface n’annonce jamais une livraison en boîte : `accepted` signifie accepté par Brevo.

Le worker `member-notifications` nécessite un secret d’appel interne distinct du service-role, valide l’environnement et l’URL Supabase explicitement fixés, puis réclame au maximum 10 tâches avec `FOR UPDATE SKIP LOCKED`, un jeton de bail unique et un bail de deux minutes. La configuration SQL doit correspondre au même environnement/projet. Il ne lit pas de destinataires, sujets ou redirects dans le corps de la requête.

Le UUID de la notification sert de clé d’idempotence Brevo. Brevo documente une fenêtre de 30 minutes ; cela **ne permet pas de promettre une livraison exactement une fois à travers une panne distribuée**. Les HTTP 429 explicitement refusés sont repris avec délai 1/2/4/8 minutes, au maximum cinq tentatives. Les refus 4xx restent `failed`. Les timeouts, 5xx, réponses indéterminées, perte de reçu DB et baux expirés restent `uncertain`, sans renvoi automatique. La modification métier reste enregistrée. Les opérations d’envoi/acceptation ne sont jamais confondues avec l’accès Auth.

Les comptes réservés `.invalid`, `.test`, `.example`, `.localhost`, `example.com/net/org`, et les identités/registre du seed sont exclus, même avec une adresse ultérieurement modifiée. La configuration staging exige une liste d’emails **exacts**, sans wildcard, dans SQL et dans le worker. Aucune redirection des emails exclus vers une boîte commune.

Pas de rattrapage historique : configuration désactivée au départ, reçus `disabled` jamais rejoués. Les messages en attente datant de plus de sept jours sont exclus ; les reçus terminaux sont retirés après 90 jours lors d’une exécution du worker, sans supprimer l’audit métier. Les incertitudes restent disponibles pour revue opérateur. Désactiver l’envoi bloque les nouveaux claims et suspend les tâches encore en attente ; un lot déjà réclamé peut terminer ses envois (au maximum deux minutes de bail). réactiver peut reprendre celles-ci si elles restent éligibles. Les nouveaux événements intervenus pendant la désactivation ne sont pas rejoués.

## Activer en staging uniquement

Cette PR ne modifie aucun projet hébergé. Appliquer `20261008150000_member_notifications.sql` sur **ifosse-staging** (`btpojwwwsxrepsehmxbm`). Appliquer ensuite `20261008160000_caci_notifications.sql` pour l’avis CACI. Ces migrations n’activent rien et ne migrent aucun ancien audit en email.

Configurer **les secrets de la Supabase Edge Function**, jamais Netlify, `VITE_*`, le dépôt ou une fixture :

| Variable | Staging |
|---|---|
| `NOTIFICATION_ENABLED` | `true` après recette de configuration |
| `NOTIFICATION_ENV` | `preview` |
| `BREVO_API_KEY` | Clé API transactionnelle privée du compte Brevo ; ce n’est pas le mot de passe SMTP Supabase Auth |
| `NOTIFICATION_SENDER_EMAIL` | Expéditeur réel vérifié dans Brevo |
| `NOTIFICATION_STAGING_RECIPIENTS` | Emails exacts des testeurs volontaires, séparés par virgules |
| `NOTIFICATION_DISPATCH_SECRET` | Secret aléatoire dédié d’au moins 32 caractères ; même valeur privée dans Vault pour le cron |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont les variables serveur fournies par Supabase au worker. Le service-role ne doit pas être exposé dans le navigateur. Ne modifier aucun paramètre SMTP/template/magic link existant pour ces notifications.

Déployer uniquement la nouvelle fonction :

```bash
npx supabase functions deploy member-notifications --project-ref btpojwwwsxrepsehmxbm
```

Dans le terminal opérateur, fournir `SUPABASE_URL=https://btpojwwwsxrepsehmxbm.supabase.co`, `SUPABASE_PROJECT_ENV=preview`, le JWT legacy service-role privé de ce projet et **la même** `NOTIFICATION_STAGING_RECIPIENTS`. Puis :

```bash
npm run staging:notifications            # prévalidation, aucune écriture
npm run staging:notifications -- --apply # active les futurs événements autorisés
npm run staging:notifications -- --disable
```

Le CLI est fixé à staging et refuse production, un marqueur absent ou un JWT sans ref staging. La passerelle vérifie ensuite le JWT et la RPC SQL vérifie sa ref/son rôle. Les clés opaques ne sont pas acceptées par cette commande opérateur ; le worker utilise les credentials serveur Supabase. Le dry-run ne révèle ni clés ni adresses. La configuration n’envoie aucun email par elle-même.

Dans Vault du **projet staging**, enregistrer le secret d’appel avec le nom `ifosse_notification_dispatch_secret`. Avec `pg_cron` et `pg_net` activés, programmer le SQL suivant dans le dashboard Cron, chaque minute. Il ne contient aucune valeur de secret :

```sql
select net.http_post(
  url := 'https://btpojwwwsxrepsehmxbm.supabase.co/functions/v1/member-notifications',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'ifosse_notification_dispatch_secret'
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
)
where exists (
  select 1 from public.member_notification_settings
  where singleton and enabled and environment = 'preview'
    and project_ref = 'btpojwwwsxrepsehmxbm'
);
```

Ne pas planifier une seconde tâche identique. Protéger Vault et les journaux `pg_net` côté opérateur ; aucun secret d’appel ne doit être collé dans un ticket ou partagé avec le frontend. Un appel interne authentifié manuel traite le même lot ; son corps est ignoré, aucun email arbitraire ne peut être fourni.

## Recette hébergée et exploitation

1. Utiliser uniquement des comptes de test autorisés possédant de vraies boîtes, jamais les profils du seed.
2. Ajouter un compte depuis le Président : succès métier puis statut en attente, bienvenue reçu avec **l’URL staging principale**, sans magic link. Le compte demande ensuite son propre lien comme avant.
3. Vérifier désactivation/réactivation et droits admin ; vérifier aussi qu’un compte hors liste ne reçoit rien. Ne pas transférer la présidence au seed ; utiliser deux testeurs capables de se connecter pour ce scénario.
4. Contrôler dans SQL Editor les états/codes agrégés et les reçus privés si nécessaire :

```sql
select status, last_code, count(*) from public.member_notifications
 group by status, last_code order by status;
```

5. `accepted` n’est pas une preuve de réception. Vérifier les logs transactionnels Brevo pour délivrabilité/bounces ; aucun webhook de livraison/bounce n’est ajouté dans cette tranche.
6. Pour `failed`/`uncertain`, vérifier les logs fournisseur pour le **UUID de notification** et l’éventuel `provider_message_id`. Corriger configuration/clé/expéditeur. **Seulement après preuve de non-acceptation**, un opérateur peut appeler `retry_member_notification(p_id,p_verified_not_accepted,p_reason)` avec l’ID précis, `true` et un motif de 10–500 caractères sans secret. Cela est audité ; aucun rejeu des messages acceptés, exclus, désactivés ou trop anciens. Si l’acceptation ne peut pas être déterminée, ne pas relancer.

Avant une restauration hébergée, fixer le secret serveur `NOTIFICATION_ENABLED=false` et suspendre Cron : le drapeau DB peut être réactivé par la sauvegarde. Une ancienne sauvegarde peut aussi remettre en attente un message déjà accepté. Après restauration, mettre les lignes `pending`/`processing` en `uncertain` avant reprise ; vérifier chaque UUID auprès de Brevo et utiliser uniquement le rejeu audité ci-dessus après preuve de non-acceptation. Ne jamais reprendre automatiquement une file restaurée. Voir [la procédure de récupération](recovery.md).

Production est une activation distincte non réalisée ici : URL/projet, credentials, expéditeur, environnement, configuration DB et ordonnanceur doivent tous être explicitement revus. Le CLI staging refuse toute activation production. Aucun secret ni liste de testeurs staging ne doit être partagé avec production.

Références : [Brevo transactionnel](https://developers.brevo.com/reference/send-transac-email), [idempotence et limite de 30 minutes](https://developers.brevo.com/docs/heterogenous-versions-batch-emails), [ordonnancement Supabase/Vault](https://supabase.com/docs/guides/functions/schedule-functions).
