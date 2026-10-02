# iFosse - relais de développement autonome

## Consigne à transmettre à Codex

Prends en charge les issues #9 à #18 du dépôt
`stanislas-brossette/iFosse`, dans cet ordre, en respectant l'architecture acceptée.
Le propriétaire autorise l'implémentation, les PR et les merges sans validation
intermédiaire, à condition que les tests et critères d'acceptation soient satisfaits.
Respecte les protections GitHub existantes : ne les désactive pas.

Commence par lire le fichier AGENTS.md et les documents : architecture.md,
data-model.md, mvp-backlog.md, specs.md, decisions.md et roadmap.md dans docs/.
Relis les vraies issues et les PR ouvertes : ne suppose pas qu'elles sont encore
toutes ouvertes, inchangées, ou que les dépendances ont été correctement reliées.

Un patch additif `ifosse_foundation.patch` a été préparé pour #9 dans ChatGPT.
Il ne correspond à aucune PR déjà ouverte. Il n'a ni lockfile ni types de base
inventés : ces fichiers doivent être générés dans un environnement connecté.
Consulte docs/execution-status.md et les résultats de vérification.
Vérifie d'abord l'état courant du dépôt. Si le patch est fourni, examine-le,
puis `git apply --check` avant application ; ne remplace pas des fichiers nouveaux
qui auraient été ajoutés entre-temps.
Sans le patch, réalise directement #9 à partir des docs du dépôt.

Pour chaque issue : branche issue d'un master à jour, implémentation ciblée,
tests réels, auto-relecture du diff, PR, vérification de la CI et des critères,
merge sans forcer, puis fermeture de l'issue seulement si elle est terminée.
Ne confonds pas « configuration ajoutée » et « service déployé/testé ».

N'attends pas une validation pour les arbitrages techniques réversibles : fais le
choix le plus simple compatible avec le besoin et documente-le. Une limite externe
(credentials, compte fournisseur, autorisation manquante) doit être consignée ;
continue les parties indépendantes, sans simuler que la tâche bloquée est achevée.
Ne souscris pas à un service payant, n'envoie pas d'invitations à de vraies personnes
et ne charge pas de vraies données de santé/adhérents dans un environnement public.
Ne demande jamais de secrets à coller dans une conversation.

L'authentification cible : email + lien magique, comptes d'adhérents connus,
pas d'inscription publique, session renouvelable conservée après fermeture du
navigateur. La déconnexion, la révocation et les limites du fournisseur restent
applicables. Pas d'identité fictive en production ni de service-role dans le navigateur.

## Ordre du backlog

| Issue | Sujet |
| --- | --- |
| #9 | Fondation React / Supabase local / CI / preview |
| #10 | Lien magique, identité et rôles |
| #11 | Profils et CACI |
| #12 | Fosses et inscriptions |
| #13 | Brouillon et publication de sélection |
| #14 | Covoiturage transactionnel |
| #15 | Paiements et préparation de la fosse |
| #16 | Présences, bilan, compteurs |
| #17 | Palanquées |
| #18 | Sauvegarde/restauration, exploitation et pilote réel |

## Points à résoudre dans les PR concernées

Ces points sont des observations de conception pour l'implémentation, pas des
modifications déjà appliquées au produit.

- **Confidentialité des colonnes :** ne pas rendre une ligne complète de profil
  lisible aux participants si elle contient email, CACI ou droits privés. Même
  précaution pour session_participations qui mélange RSVP public et paiement privé.
  Définir des projections/droits de colonnes ou tables séparées et tester via
  requêtes directes, pas seulement avec l'interface.
- **Invariants de covoiturage :** formaliser l'unicité (session_id, member_id), la
  cohérence session/voiture et une seule source de vérité pour l'affectation.
- **Désistements :** un historique de publication immuable ne doit pas laisser un
  désisté apparaître comme participant actuel. Distinguer historique publié et
  participation effective actuelle, sans effacer l'historique.
- **Président :** provisionnement initial explicite/audité ; ne pas reproduire
  l'auto-promotion de la V0 lorsqu'aucun président n'est trouvé. Définir la
  reprise administrative et le transfert de présidence sans blocage permanent.
- **Révocations :** relire le rôle/adhésion en base pour les actions sensibles ;
  tester qu'un ancien admin ne conserve pas ses droits via un JWT encore valide.
- **Liens magiques :** tester lien expiré, réutilisé, navigateur différent,
  redirection, scans d'emails et cas compte inconnu. Ne pas supposer que le SMTP
  de développement fonctionne pour tous les adhérents en production.
- **Résumé de niveaux :** le récap de la V0 omet certaines catégories. Aucun
  participant ne doit disparaître silencieusement du total ; traiter les valeurs
  non classées et conserver le caractère indicatif, non réglementaire.

## Preuves attendues

Pour chaque PR : commandes exécutées, résultats, captures si interface modifiée,
migrations et impacts, limites restantes. Ne pas fermer #18 sans restauration
réellement testée et validation du pilote avec les organisateurs. Si l'environnement
n'a pas d'accès d'écriture, rendre un patch et un état exact, sans inventer de PR.
