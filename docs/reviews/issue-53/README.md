# Formulaires, connexion et présences en lot — #53

Recette locale avec données exclusivement fictives : 50 adhérents, 22 volontaires/20 confirmés, draft différent de la publication, absents/n’a pas plongé/déjà plongé/remplacement, bilan ouvert puis clôturé. Annulation/Escape/focus, conflit réel suivi d’une nouvelle confirmation, aucune écriture partielle et compteurs inchangés avant clôture sont contrôlés.

La recette générale conserve 50 profils, 35 réponses, plusieurs voitures et quatre palanquées. Ordinateur 1440×900, téléphone 390×844, contrôles ≥44px, pas de débordement horizontal. Les saisies de niveau libre et les filtres remis à zéro sans perte du CACI sont couverts ; les dates restent ISO dans les inputs.

- [Récapitulatif du lot — ordinateur](batch-desktop.png)
- [Conflit et reconfirmation — téléphone](batch-phone.png)
- [Messagerie — ordinateur](inbox-desktop.png)
- [Messagerie — téléphone](inbox-phone.png)
- [Annuaire de 50 adhérents — ordinateur](directory-desktop.png)
- [Annuaire — téléphone](directory-phone.png)
- [Profil — téléphone](profile-phone.png)

Captures prises après suppression du fragment Auth ; aucun token, secret, identité réelle, état de stockage, trace ou vidéo. La migration `20261008070000_attendance_batch.sql` est validée uniquement sur la base locale isolée. Son application hébergée reste une opération staging à réaliser avant la recette du lot ; aucune modification de production n’a été effectuée.
