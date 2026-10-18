# Notifications internes — déploiement progressif

Une cloche dans l’en-tête ouvre la boîte privée de l’adhérent, sur le web et dans
la PWA. Le compteur représente les messages non lus ; la lecture est conservée
côté serveur. Aucun push, email, service worker ou cache navigateur de messages.

## Événements couverts

- Première publication : résultat de chaque adhérent ayant répondu Oui ou Peut-être.
- Republication : uniquement un résultat effectif différent pour ces adhérents.
  Une place historique invalidée par une nouvelle réponse reste en attente.
- Voiture retirée : les passagers encore inscrits Oui sont avertis ; inscription
  et réaffectation du transport suivent exactement les règles existantes.
- Rendez-vous ou départ modifié : les passagers sont avertis. Une note, un
  changement de capacité ou une sauvegarde identique ne produit pas de message.
- CACI changé par un administrateur : avis au seul adhérent concerné, sans date
  médicale dans le message. Une modification par soi-même ne produit pas d’avis.

Pas d’avis au déclencheur, aux comptes inactifs, pour un brouillon ou une action
annulée/échouée. Les arrivées/départs des passagers côté conducteur sont différés.
Les messages décrivent un événement passé : la séance/le profil fait foi pour
l’état courant. Les liens utilisent la navigation et la protection des saisies
existantes. Pas de contenu HTML ni de redirection fournie par un utilisateur.

## Installation et activation

Cette PR ne déploie rien dans un projet hébergé. La migration additive
`20261018120000_in_app_notifications.sql` crée une configuration **désactivée**.
Ne pas l’activer en production dans le cadre de cette recette.

1. Vérifier explicitement que le SQL Editor est celui de **ifosse-staging**
   (`btpojwwwsxrepsehmxbm`), appliquer la migration avec le processus opérateur
   habituel et déployer la preview frontend.
2. Avant activation, vérifier que les parcours existants fonctionnent et que la
   cloche est absente. Un frontend déployé avant la migration masque aussi la
   fonctionnalité ; il ne bloque pas les pages existantes.
3. Pour la recette staging seulement, exécuter :

   ```sql
   update public.app_notification_settings set enabled=true where singleton;
   ```

4. Avec deux comptes distincts, tester publication, republication identique puis
   modifiée, modification CACI et modification/retrait de voiture. Vérifier le
   compteur, la lecture après rechargement, Escape et un formulaire non enregistré
   sur ordinateur et téléphone. Une page déjà ouverte détecte l’activation sous
   environ 15 secondes (ou au retour sur la fenêtre). Si le frontend a détecté un
   RPC absent avant migration, recharger une fois après celle-ci.
5. Retour arrière immédiat :

   ```sql
   update public.app_notification_settings set enabled=false where singleton;
   ```

   Les nouveaux messages cessent ; l’interface les masque au prochain rafraîchissement.
   Les messages et lectures restent conservés pour une réactivation. Aucun rattrapage
   des événements antérieurs à l’activation n’est effectué. Aucun secret supplémentaire,
   Cron, Edge Function, Brevo ou permission Auth n’est nécessaire.

## Sécurité et limites

Les RPC identifient le destinataire depuis la session Auth active ; aucune identité
cible n’est acceptée par le RPC de lecture. RLS : chaque membre, admin ou président
ne lit que sa propre boîte. Les écritures d’événements et la configuration sont
réservées au serveur/opérateur. Les RPC métier existantes ne sont pas remplacées.
Les triggers observent les audits réussis et les changements transactionnels de
voiture ; un rollback métier annule aussi les messages.

Une panne propre au stockage des notifications est isolée dans une sous-transaction :
l’action métier reste prioritaire. Un avertissement SQLSTATE sans donnée personnelle
est journalisé ; le message peut manquer, sans relance automatique. Cela ne capture
pas et ne masque pas une erreur de validation de l’action métier elle-même.

Lecture par pages de 20, polling léger toutes les 15 secondes seulement quand la
page est visible et la boîte fermée. La boîte ouverte se rafraîchit à sa réouverture ;
pas de temps réel ni de notification système en arrière-plan. Les messages liés à une
séance supprimée disparaissent avec celle-ci. Pas de suppression automatique d’autres
messages ni de préférence individuelle dans cette première tranche.

Les emails sensibles de compte restent un chantier séparé (PR #65) : création,
accès, rôle et transfert de présidence. Le CACI relève de cette boîte interne.
