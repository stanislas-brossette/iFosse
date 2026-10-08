# Comparaison de sélection — #51

Recette locale jetable : 50 profils fictifs, 35 réponses Oui/Peut-être, 20 confirmés publiés, 19 retenus dans le nouveau brouillon, trois voitures et quatre palanquées. Même scénario avant/après, ordinateur 1440×900 et téléphone 390×844. Aucun jeton, profil réel ou stockage Auth dans les captures.

| Vue | Avant | Après |
| --- | --- | --- |
| Ordinateur, lignes | [Avant](before-desktop.png) | [Après](after-desktop.png) |
| Téléphone, lignes | [Avant](before-phone.png) | [Après](after-phone.png) |
| Ordinateur, page entière | — | [Après](after-desktop-full.png) |
| Téléphone, page entière | — | [Après](after-phone-full.png) |

Exécuter `npm run test:e2e -- e2e/visual-acceptance.spec.ts` uniquement sur une base locale de test isolée. Les états CACI/transport/paiement restent calculés par les API existantes. L’aide réglementaire n’est pas remplacée par ces indicateurs.
