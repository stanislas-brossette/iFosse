# Boîte de notifications — recette locale

Données entièrement fictives, aucun fragment Auth, token, email réel ou trace.
Captures après connexion explicite : [ordinateur 1440×900](desktop.png),
[téléphone 390×844](phone.png). Focus visible, fermeture Escape avec retour à la
cloche, pas de débordement horizontal, lecture conservée après rechargement.
Le profil non enregistré reste conservé après navigation depuis un message.

Validation : 237 tests unitaires, 713 assertions SQL, types/lint/build, migration
sur base réinitialisée, restauration peuplée. Le scénario Playwright dédié complète
les parcours métier existants et la recette à 50 adhérents/20 participants.
Les tests de boîte couvrent aussi RPC absent, échec de lecture, pagination, payload
invalide, réponse en retard après démontage et absence d’actions arbitraires.

Activation volontaire séparée : voir [guide opérateur](../../in-app-notifications.md).
Pas d’activation hébergée, email ou push dans cette recette.
