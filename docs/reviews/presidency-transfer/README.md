# Transfert explicite de présidence

Recette locale avec 50 identités entièrement fictives `example.test`, président et successeur connectés sur deux navigateurs. Une personne est suspendue ; le successeur a une participation publiée et payée conservée après le transfert.

- [Ordinateur 1440×900](desktop.png) : identité et conséquences, confirmation désactivée tant que l’email ne correspond pas.
- [Téléphone 390×844](phone.png) : choix revérifié après conflit serveur, email recopié et reconnaissance cochée avant confirmation.

Les captures sont prises après suppression du fragment Auth, sans token, donnée réelle, état de stockage, trace ou vidéo. Contrôles >=44px, aucun débordement horizontal, ouverture clavier, annulation/Escape et retour du focus contrôlés. La boîte reste défilable sur un écran plus petit.

Les comptes fictifs `.invalid` sont exclus et refusés par le serveur ; la confirmation demande d’avoir vérifié que le successeur peut se connecter.

Les tests vérifient le brouillon de création préservé/abandonné explicitement, la reconfirmation après modification réelle du CACI, les rôles réactualisés sans reconnexion, les anciens jetons privés de droits présidentiels, les données métier conservées, le double transfert et la suspension concurrents. Le serveur est validé sur la pile locale isolée seulement ; la migration `20261008110000_presidency_transfer.sql` doit être appliquée en staging avant recette hébergée. Aucun projet hébergé n’est modifié par cette validation.
