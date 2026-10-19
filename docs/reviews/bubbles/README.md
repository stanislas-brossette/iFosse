# Bulles discrètes — revue visuelle

Décision produit : [D033](../../decisions.md#d033--bulles-décoratives-rares).

Le composant réel et la feuille de style de l’application sont montés dans une
page de consultation fictive, sans Auth ni base de données. Le test navigateur
force uniquement son horloge et son hasard ; aucun bouton de démonstration ou
paramètre de déclenchement forcé n’est ajouté au produit.

- [Ordinateur, 1440 × 900](desktop.png)
- [Téléphone, 390 × 844](phone.png)

L’animation est figée à 350 ms pour les captures. Les cinq bulles du scénario ont
des tailles, dérives et vitesses différentes. Le test vérifie aussi l’absence de
débordement, le passage des clics, le nettoyage après 1,4 seconde, la limite de
visite et le respect de la réduction des animations.

Validation locale : typecheck, lint, 356 tests unitaires sur 47 fichiers, build,
et deux scénarios navigateur Chrome. Les six tests unitaires du composant
couvrent également délai initial/probabilité, persistance et délai de trois jours,
exclusion des formulaires/dialogues/erreurs, clavier, stockage refusé, changement
de préférence d’animation et nettoyage au démontage.

Ces captures valident le composant décoratif en isolation, pas une recette
hébergée du parcours connecté ni une validation sur téléphone physique. Aucun
seed, reset, installation de dépendances ou changement hébergé effectué en local.
