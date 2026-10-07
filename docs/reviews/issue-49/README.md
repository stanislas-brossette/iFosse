# Recette — issue #49 : situation personnelle

Le résumé personnel utilise la sélection **publiée effective**, jamais le brouillon.
Il est détaillé dans Ma participation et compact dans Participants, Covoiturage,
Palanquées et Bilan. Gestion conserve sa présentation organisateur.

## Vérification manuelle sur la preview

Avec deux comptes fictifs (organisateur et adhérent), vérifier :

1. Réponse Oui avant publication : réponse enregistrée, sélection non publiée,
   aucune confirmation de place. Sans réponse/Peut-être/Non restent distincts.
2. Publier l’adhérent comme confirmé, puis modifier le brouillon : le résumé
   adhérent conserve la confirmation jusqu’à la nouvelle publication.
3. Republier en attente/non retenu : le résumé change via l’actualisation partagée.
4. Depuis Ma participation, organiser un trajet manquant. Le bouton ouvre
   Covoiturage sans réservation et place le focus sur l’onglet.
5. Réserver une voiture : conducteur, rendez-vous, départ et passagers apparaissent
   avant les alternatives ; la voiture réservée n’est pas dupliquée. Un conducteur
   non confirmé produit un avertissement provisoire. Rendez-vous/départ absents
   sont explicites. Retirer la voiture déplace les passagers vers trajet à trouver.
6. Dans Palanquées, le groupe publié de l’adhérent apparaît en premier avec ses
   membres visibles. Une modification privée ne le change pas ; la republication
   le met à jour. Sans groupe/publication ou après retrait : explication explicite.
7. Annuler un retrait de réponse ou de voiture occupée : aucun changement.
   Après désistement puis nouveau Oui : pas de confirmation restaurée sans
   nouvelle publication. Annuler l’avertissement CACI conserve la réponse.
8. Paiement/CACI personnels restent privés ; aucun préambule de sélection complet
   n’est répété dans les autres onglets. Les totaux publiés restent dans Participants.
9. Clavier : onglets, boutons, focus visible. Téléphone : défilement possible,
   aucune action cachée définitivement par la navigation basse.

## Captures sûres

Les captures proviennent de `e2e/visual-acceptance.spec.ts`, avec 50 profils
fictifs, 35 réponses Oui/Peut-être, 20 confirmés, 3 voitures et 4 palanquées.
Un brouillon de sélection diffère de la publication. Aucun compte réel, secret,
URL de connexion, trace ou état de stockage Auth n’est exporté.

- [Participation ordinateur](desktop-personal-participation.png)
- [Trajet ordinateur](desktop-personal-transport.png)
- [Palanquée ordinateur](desktop-personal-palanquee.png)
- [Participation téléphone](phone-session-detail.png)
- [Participants téléphone](phone-participants.png)
- [Trajet téléphone](phone-carpooling.png)
- [Palanquée téléphone](phone-palanquees.png)
- [Bilan téléphone](phone-bilan.png)

Résolutions : 1440 × 900 et 390 × 844. Les captures longues montrent également
le contenu après défilement. Les tests contrôlent les cibles tactiles ≥ 44 px,
le focus des onglets et l’absence de débordement horizontal.

## Limites et déploiement

Aucune migration/RPC/RLS, modification Auth ou donnée hébergée n’est introduite.
La projection personnelle du calendrier livrée par #48/#56 doit déjà être
installée sur staging. Les changements externes sont reçus par le polling visible
existant (5 secondes) ou au retour du focus. Un échec conserve les derniers statuts
valides et signale l’actualisation impossible.

Les en-têtes/onglets mobiles seront compactés dans #50 ; le routage persistant
relève de #52. Les captures et tests locaux ne remplacent pas la recette hébergée
ni le pilote organisateur. La PR reste à valider avant fusion ; production inchangée.
