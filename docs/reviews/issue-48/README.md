# Revue visuelle du calendrier personnel — issue #48

Captures locales du 7 octobre 2026, régénérées sur la branche `codex/restore-calendar-personal-status` (PR #56, restauration de #54 conservant #55).
Toutes les identités sont inventées (domaine réservé `example.test`). Les captures
sont prises après retrait du jeton de connexion de l’URL ; aucune trace navigateur,
vidéo, session exportée ou donnée réelle n’est incluse.

La recette utilise 50 adhérents, 35 réponses, 20 confirmés publiés, un brouillon
privé différent, plusieurs voitures et des palanquées. Le compte capturé est un
adhérent confirmé, passager d’un conducteur confirmé, avec paiement enregistré.
Les autres séances n’ont pas encore de réponse/publication.

- [Ordinateur : viewport 1440×900, page entière](desktop-calendar.png)
- [Téléphone : viewport 390×844, page entière](mobile-calendar.png)

Inspection : une seule prochaine séance, une seule date visible par carte
(tuile jour/mois avec date complète accessible et au survol), quatre statuts personnels lisibles,
occupation publiée, rappel des inscriptions possibles malgré la sélection pleine seulement sans
réponse Oui préalable (absent sur ces captures),
filtres séparés des saisons et action principale unique. La suite vérifie aussi
l’absence de débordement horizontal et les contrôles d’au moins 44 px ; les tests
existants de focus et navigation clavier restent exécutés.

Reproduction sur une pile Supabase **locale de test isolée**, après reset/migrations :
`npm run test:e2e -- calendar-personal.spec.ts visual-acceptance.spec.ts`.
La suite de calendrier vérifie en plus le trajet provisoire, son action directe,
les republications, le paiement personnel et la séance passée non clôturée.
Ces captures ne constituent pas une validation du pilote organisateur (#18),
de l’Auth/SMTP hébergé ou de la production.

Revalidation de la restauration : typecheck/lint/build et 138 tests unitaires,
560 assertions pgTAP, contrôle des types après reset isolé ; les deux scénarios
navigateur calendrier/revue visuelle passent sur le schéma migré. Une base locale
ancienne a été inspectée en lecture seule : seulement quatre champs d’occupation.
La régression de schéma ancien produit un avertissement explicite de migration.
Le statut du schéma staging reste à vérifier avec la procédure opérateur ; aucune
base hébergée ni la base locale habituelle n’a été modifiée.
