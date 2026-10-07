# #50 — En-tête et navigation mobiles

Scénario identique avant/après : 50 profils fictifs, 35 réponses, 20 confirmés,
19 retenus dans le brouillon privé, trois voitures et quatre palanquées.
Les comptes de recette sont jetables ; aucun compte réel, jeton ni stockage Auth
n’est présent dans les images. Avant : master après #57. Après : cette PR.

| Écran à 390 × 844 | Avant | Après |
|---|---|---|
| Participation | [Avant](before-phone-participation.png) | [Après](after-phone-participation.png) |
| Transport | [Avant](before-phone-transport.png) | [Après](after-phone-transport.png) |
| Gestion | [Avant](before-phone-gestion.png) | [Après](after-phone-gestion.png) |

[Ordinateur 1440 × 900](desktop-participation.png),
[320px avec texte agrandi à 20px](phone-320-large-text.png),
[Fin du formulaire](phone-form-end.png).

Vérifications automatisées : onglets avant 460px dans le scénario adhérent,
commandes de défilement réellement actives, flèches/Home/End et focus visible,
onglet actif dans le viewport, 320/390px et texte agrandi, pas de débordement,
contrôles ≥44px, bouton Gestion réservé aux organisateurs, fin de formulaire
au-dessus de la navigation fixe. Profil et annuaire testés dans la même recette.

L’identité peut passer sur deux lignes avec texte agrandi. Le header devient
non fixe sur téléphone pour éviter de masquer des commandes ; publication
reste fixe pendant le défilement de Gestion. Les informations d’accès sont
repliées, et absentes si vides. La place publiée reste immédiatement visible
sur chaque rubrique ; réponse/trajet sont dépliables dans le résumé compact.
Les erreurs et confirmations de retrait ne sont pas repliées.

Pas de migration, de changement des autorisations ou des règles métier.
La comparaison des lignes de Gestion reste l’issue #51.
