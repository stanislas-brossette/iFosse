# Identité APSAP Plongée — revue visuelle

[D034](../../decisions.md#d034--identité-apsap-plongée-et-icônes-dauphin)
consigne le choix du propriétaire : logo du club à la connexion et dans la
navigation ; emblème simplifié tour Eiffel–dauphin pour navigateur et installation.

## Sources et exports

- `public/branding/apsap-plongee-2025.png` : copie inchangée du PNG fourni par le propriétaire, 1240 × 1336. Aucun recadrage, étirement, remplacement de couleurs ou génération du logo du club.
- `assets/branding/ifosse-dolphin-source.png` : PNG transparent approuvé dans la conversation, conservé avec son prompt ImageGen. La variante nudibranche n’est pas intégrée.
- `scripts/generate-app-icons.mjs` : export local via le canvas de Chrome, sans réseau ni modèle génératif. Réduction de la marge transparente, redimensionnement et fond blanc opaque pour le contraste.
- `public/icons/ifosse-dolphin-*` : navigateur 16/32, Android 192/512, maskable 512, Apple 180. Le maskable tient dans un carré central de côté 55 %, lui-même inclus dans le [cercle sûr de rayon 40 %](https://web.dev/articles/maskable-icon).

Les nouvelles URL évitent de réutiliser les anciennes URL d’icônes. Les anciens
fichiers restent disponibles pour les références d’un manifest déjà en cache.
L’identité du manifest, sa portée, le nom iFosse et les règles de cache existantes
restent inchangés. L’icône déjà installée peut mettre du temps à changer : aucun
rafraîchissement immédiat du lanceur n’est promis.

## Captures locales

- [Connexion sur ordinateur](login-desktop.png), [sur téléphone](login-phone.png).
- [Navigation sur ordinateur](navigation-desktop.png), [sur téléphone](navigation-phone.png).

Le vrai App/AuthGate et les composants métier sont utilisés avec un service
fictif à la frontière Supabase (Camille Exemple, aucune séance). Aucun compte,
token, email ou donnée hébergée n’est créé. Le logo de navigation mobile est
placé dans la barre basse, en préservant la place du profil et de la déconnexion.

## Validation et limites

Typecheck, lint, 358 tests unitaires et build passent. Six scénarios Chrome locaux
passent : connexion/navigation à 1440, 390 et 320 px, décodage et dimensions des
six icônes/absence de transparence/zone de sécurité maskable, et les deux
régressions existantes des bulles. Navigation vers Mon profil fonctionnelle,
pas d’erreur JavaScript ni de débordement horizontal sur les trois formats.
Les captures ci-dessus ont été inspectées visuellement.

La CI et la preview de cette PR se vérifient séparément. Ces contrôles locaux ne
prouvent pas la mise à jour d’une icône déjà installée sur Android ou iPhone.
Aucun seed, reset, installation de dépendances ou changement hébergé effectué.
