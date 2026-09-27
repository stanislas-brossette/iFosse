# iFosse V0

**Les fosses, simplement.** Prototype fonctionnel de gestion des fosses du club APSAP, construit à partir du cahier des charges fourni et de nos échanges du 26 septembre 2026.

## Démarrer sans installation

Ouvrir **`iFosse_V0.html`** dans un navigateur sur ordinateur. Ce fichier autonome est fourni à la racine de l'archive, et séparément dans la conversation. Il contient toute l'application : aucun serveur, compte ou téléchargement de bibliothèque n'est nécessaire.

Les essais sont enregistrés dans le stockage local du navigateur lorsque celui-ci l'autorise. Garder le même fichier au même emplacement et utiliser le même navigateur. Une alerte s'affiche si ce stockage n'est pas disponible. Utiliser l'export JSON pour sauvegarder ou transférer les essais ; effacer les données du navigateur peut supprimer la sauvegarde locale.

**Ce n'est pas encore une application multi-utilisateur pour le club.** Chaque appareil a sa propre copie des données. Il n'y a ni vraie connexion, ni base partagée, ni envoi d'emails, ni paiement en ligne. Ne pas y saisir de données personnelles réelles ou de documents médicaux. Les droits sont simulés pour valider les parcours, pas sécurisés par un serveur.

## Les profils de démonstration

Le profil initial est **Camille Bernard**, administrateur fictif. Cliquer sur son nom en haut à droite pour passer à **Alex Martin**, adhérent fictif, ou à l'un des 48 autres profils. On peut ainsi comparer la vue administrateur et la vue adhérent sur les mêmes données locales.

Les noms, niveaux, inscriptions, covoiturages, paiements et présences sont inventés. Ils ne représentent pas les personnes réelles du club.

## Un premier essai en cinq minutes

1. Ouvrir la fosse du **28 octobre**, puis l'onglet **Gestion**. La sélection publiée contient 18 personnes. Passer **Alice Legrand** et **Maxime Garnier** sur « Confirmé » : le brouillon passe à 20, mais la publication reste à 18.
2. Changer de profil pour Alice : elle reste en attente. Revenir sur Camille, puis **Publier la sélection**. Alice est maintenant confirmée. Essayer d'ajouter Clara Faure : il faut d'abord **Modifier** la séance pour porter sa capacité à 21.
3. Dans **Covoiturage**, retirer la voiture de Camille. Ses passagers restent inscrits à la fosse, mais cherchent désormais un trajet. Changer de profil pour l'un d'eux et rejoindre une autre voiture.
4. Depuis **Les séances > Terminées**, ouvrir l'exemple fictif du 9 septembre. Dans **Gestion > Présences & bilan**, rouvrir le bilan, modifier une présence et le clôturer. Observer le compteur de saison.
5. Dans **À propos de la V0**, exporter une sauvegarde JSON. On peut l'importer ultérieurement ou réinitialiser la démonstration.

## Fonctions disponibles

- Calendrier de saison, création et modification des séances, horaires, lieu, consignes, capacité et ouverture des inscriptions.
- Réponses oui / peut-être / non sans limitation du nombre de oui ; liste consultable par tous.
- Sélection manuelle en brouillon, contrôle de capacité, publication explicite et republication. Les encadrants occupent une place.
- Covoiturage par séance, places passagers hors conducteur, inscription et changement de voiture, protection contre le surbooking et gestion des retraits.
- Paiement à régler / payé / gratuit : visible par l'adhérent concerné et les admins, modifiable uniquement par les admins dans l'interface.
- Présence réelle, bilan à clôturer, compteur de fosses de septembre à août, réouverture pour correction.
- Palanquées simples organisées manuellement et publiées, sans contrôle de qualification ou de conformité.
- Annuaire, profil individuel, recherche, tri des inscrits par nombre de fosses.
- Export agenda `.ics` avec horaires de Paris, export CSV administrateur et sauvegarde/restauration JSON.

## Ce qui vient du calendrier fourni

Les **11 dates d'octobre 2026 à mai 2027** ont été reprises. Les heures de fin sont tronquées dans l'image pour deux séances :

| Séance | Début visible | Fin provisoire dans la V0 |
|---|---|---|
| 4 novembre 2026 | 22h00 | 23h00, à confirmer |
| 9 décembre 2026 | 20h00 | 21h00, à confirmer |

Ces hypothèses sont signalées dans l'application et dans les fichiers agenda. L'adresse exacte reste à compléter. Les séances du **9 et du 23 septembre 2026 sont entièrement fictives**, ajoutées uniquement pour tester les compteurs ; elles sont explicitement marquées comme exemples.

## Code source

Le dossier `app/` contient une version statique avec fichiers séparés :

| Fichier | Rôle |
|---|---|
| `model.js` | Règles métier, données fictives, validation des sauvegardes. |
| `app.js` | Interface, navigation, formulaires, droits simulés, exports et stockage local. |
| `styles.css` | Interface adaptative ordinateur/téléphone. |
| `index.html` | Point d'entrée de la version à fichiers séparés. |
| `manifest.webmanifest`, `sw.js`, `icon*` | Préparation pour une version installable/hors ligne une fois hébergée. Installation PWA non validée ici. |

Le fichier autonome se reconstruit depuis le dossier `ifosse-v0` avec :

```sh
python3 build.py
```

Pour servir la version source localement :

```sh
python3 -m http.server 8080 --directory app
```

Puis ouvrir `http://localhost:8080/` dans le navigateur. La version autonome et la version servie peuvent utiliser des espaces de stockage distincts : passer par l'export/import JSON pour transférer les essais.

Aucune dépendance JavaScript, aucun CDN, aucun suivi d'audience, aucune police externe. La V0 n'a pas été publiée sur un site public.

## Tests et limites

Voir **`TESTS.md`** pour les 26 tests métier et les 16 scénarios d'interface exécutés, ainsi que les limites de l'environnement de test. Les arbitrages fonctionnels sont dans **`DECISIONS_V0.md`**.

Avant un usage réel, il faudra notamment ajouter une authentification sur invitation, des autorisations côté serveur, une base partagée, des opérations atomiques pour les dernières places, un contrôle des modifications concurrentes, des sauvegardes et une politique de gestion des données. Les notifications et la fiche réglementaire restent des étapes séparées.
