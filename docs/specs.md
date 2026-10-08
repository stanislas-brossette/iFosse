# iFosse — Functional specification

## 1. Purpose

iFosse replaces the current Framadate + WhatsApp workflow used to organize the club's diving-pool sessions.

The first objective is not to build a complete club-management platform. It is to make session organization simple, transparent and much less time-consuming.

Approximate user population: **50 club members**.

## 2. Core concept

The main entry point is a **session**.

Each session contains at least:

- date;
- start and end time;
- location/address;
- optional access information;
- capacity;
- registration-open state;
- member responses;
- administrator selection;
- carpool information;
- payment information;
- attendance;
- optional simple palanquee grouping.

Default capacity is typically **20**, but an administrator can modify it at any time.

An instructor/encadrant occupies one of the available places.

## 3. Roles

iFosse uses three application roles: member, administrator and president.

### Member

A member can:

- view sessions;
- answer yes / maybe / no;
- modify their answer;
- see other members' Yes/Maybe answers and their own response status;
- propose or withdraw a car for a session;
- choose or change carpool arrangements;
- see the published participant selection;
- see their own payment status;
- see season participation counts;
- view published palanquees when present.

### Administrator

An administrator can do everything a member can, plus:

- create and edit sessions;
- change session capacity;
- modify member responses when needed;
- prepare the final participant selection;
- publish and re-publish that selection;
- change payment status;
- validate actual attendance;
- close/reopen a session bilan;
- create and publish simple palanquee groups;
- manage member data required by the application.

Xavier and TitO are representative administrator users / DP for the current workflow.

## 4. Registration

Each member has one response per session:

- Yes
- Maybe
- No

The response can be changed at any time.

The number of **Yes** responses is **not limited** by session capacity.

Within a session, the Participants tab shows only members who answered Yes or Maybe. The administrative management view can still expose the broader member population when needed for corrections.

## 5. Final participant selection

Registration and final selection are separate concepts.

Administrators prepare a **draft selection**.

The draft may contain at most the current session capacity.

Example:

- capacity = 20;
- 24 members answered Yes;
- administrator selects 20;
- the 4 others remain non-selected / waiting.

If administrators need 21 participants, they may first edit the session capacity to 21.


### President

The president is a super-admin.

The president has all admin capabilities and can additionally:

- promote a regular member to admin;
- remove admin rights from an admin;
- create an ordinary member (first name, last name, email) who subsequently uses normal magic-link login;
- deactivate/reactivate access with confirmation, while preserving all historical records (D028);
- explicitly transfer the sole presidency to another active linked member/admin, becoming an admin themselves (D029).

Regular admins cannot change application roles or create/deactivate/reactivate members. Administration uses one searchable directory with row-level actions; members cannot access it. Hard deletion is excluded. [Lifecycle and deployment details](member-management.md).

The MVP/prototype keeps exactly one president. The president role cannot be removed from the member editor.

### Publication

Draft changes are not immediately public.

Administrators must explicitly use a **Publish selection** action.

The last published selection is visible to everyone.

Administrators may later modify the draft and publish again. The newly published state replaces the previously published one.

Suggested selection states:

- Waiting
- Selected
- Not selected
- Withdrawn

The exact UI labels may evolve as long as the underlying distinction remains clear.

## 6. Season and participation counters

A season runs from **1 September through 31 August**.

Example:

- season 2026–2027 = 1 September 2026 to 31 August 2027.

The number of fosses completed by a member during the season is computed from the session history.

A member counts as having completed a fosse only when the administrator validates that the member actually participated.

Being selected is not sufficient.

This count is intended both as an attendance indicator and as useful context when administrators must choose between more volunteers than available places.

## 7. Carpooling

Carpooling is managed per session.

A registered member may later:

- indicate that they are driving;
- define the number of passenger seats offered;
- change or remove that offer.

Other members may choose a car while seats remain.

Rules:

- a driver must participate in the session;
- a car offer exists only for that session;
- passenger capacity must not be exceeded;
- the driver does not consume one of their own passenger seats;
- if the driver withdraws the car or leaves the session, passengers stay registered for the fosse but their transport becomes unresolved.

Carpool choices remain editable after initial registration.

Usual car information in the member profile is optional. Members without a car profile may still offer a car for a specific session.

When a member has usual car defaults, they may include:

- usual passenger-seat count;
- usual meeting point.

These values are used only to prefill a new session car offer. They never create an offer automatically.

If a member without profile car defaults offers a car for a session, the application may explicitly ask whether to save those values to the profile. This must remain opt-in.

## 8. Payments

Payment is trust-based. There is no online payment requirement in the MVP.

Suggested states:

- To pay
- Paid
- Free

Each member can see their own status.

Only an administrator can change it.

## 9. Attendance and session closure

After the session, an administrator validates who actually participated.

Attendance is the source of truth for the season counter.

The administrator can close the session bilan, and may reopen it later to correct an error.

## 10. Palanquees

The MVP may include simple manual grouping into palanquees.

The palanquee editor should also provide a dynamic qualification summary for the published selection and update per-palanquee summaries immediately when assignments change.

The first prototype uses the categories E3, E2, E1, N4, N3, PN3, PN2 and PN1. MF1 is represented as E3 in this display. PN3 / PN2 / PN1 represent members preparing N3 / N2 / N1 respectively.

This summary is informational only and must not be presented as regulatory validation.

These groups can be published and made visible to members.

The MVP does **not** need to generate a regulatory document.

Generating and storing the official regulatory record is a later feature.

## 11. Member profile

All club members have an application account.

For the first production version, the profile should stay small and focused on the fosse workflow.

Useful fields include:

- first name;
- last name;
- email;
- mobile phone;
- current diving level;
- level being prepared;
- application role / rights;
- optional address;
- optional usual car information;
- CACI validity end date, maintained by an administrator and visible read-only to the member.

The following are explicitly considered future club-management extensions rather than MVP requirements:

- licence tracking;
- insurance card;
- uploaded qualification documents;
- emergency contact management;
- training assessments;
- validated competencies;
- broader club administration.

## 12. Authentication

The original requirements mention email/password and possible biometrics.

For the production MVP, authentication uses email magic links.

Rules:

- every real member has their own account linked to a known club email address;
- arbitrary public sign-up is not required;
- no password creation or password-reset flow is required;
- authenticated sessions should persist across browser restarts on personal devices;
- logout opens a confirmation dialog; Annuler/Escape preserves the session, and only explicit confirmation ends the local session;
- administrator permissions must be enforced server-side / at the database boundary;
- account support should remain minimal.

## 13. Visibility

All members may see:

- session information;
- other members' current Yes / Maybe responses (No/unanswered remain own/admin-only under D026);
- published selection;
- published palanquees;
- carpool availability.

The club-wide member directory is not shown to regular members. Participant identities and relevant diving information remain visible within the context of a session.

A member may see their own payment status.

The regular-member dashboard should emphasize the member's own next actions and statuses rather than administrator-oriented global counts.

Administrators may see and edit administrative fields.

## 14. Out of scope for the first production MVP

- online payment;
- full accounting;
- regulatory palanquee document generation;
- complete licence/document management and uploaded medical documents;
- pedagogical skill tracking;
- native Android/iOS applications;
- full ERP-style club management.

## 15. V0 status

The V0 in `frontend/iFosse_V0.html` is a functional prototype used to validate these rules.

It intentionally uses:

- fictitious users;
- fictitious historical sessions for testing;
- local browser storage;
- simulated roles;
- no shared backend.

It must not be treated as secure or production-ready.


## CACI expiry warnings

The member record stores only a CACI validity end date.

The UI should display one of four CACI states:

- Valid;
- Expires soon: validity ends within 60 days of the reference date;
- Expired;
- Not entered.

The club-wide member view uses today's date as the reference.

The session-management view uses the session date as the reference and should show whether each participant's CACI is valid "on the day".

When a regular member answers Yes to a session for which their CACI will be expired, or when no CACI date is available, iFosse shows a warning before saving the response. Registration remains possible after explicit confirmation.


## 16. Session readiness summary

The administrator selection view includes a compact readiness summary for each displayed member.

The first prototype tracks four operational points:

- selection;
- CACI validity on the session date;
- resolved transport;
- payment status.

This is an operational checklist, not a regulatory fitness assessment.

## 17. School holidays

A session may be marked by an administrator as taking place during school holidays.

When marked, the session displays a visible "Vacances scolaires" badge.

The prototype stores this as an explicit session flag rather than attempting to infer school-holiday dates automatically.

### Participant list sorting

The Participants tab retains only Yes/Maybe responses and offers compact client-side
sorting, separate from the management search. Default: **Réponse**, Oui before
Peut-être, with French alphabetical last name then first name within each group.
The response comparator orders Non after Peut-être wherever such rows are already
available; this does not change the Participants tab's existing visibility rule (D007/D026).
The preference (criterion/direction) lives only in browser session storage;
it survives navigation/reload, with no server preference. Choosing another criterion
starts ascending. Old Inscription preferences fall back to the new default.

- **Réponse**: Oui, Peut-être, Non; unknown/missing responses last in either direction.
  Reverse reverses response groups only, keeping alphabetical names within each.
- **Nom**: French alphabetical last name, then first name; reverse reverses names.
- **Niveau**: display order `Débutant/N0, N1, N2, N3, N4, N5, E1, E2, E3, MF1, E4, MF2`.
  Current level is free text; trim/case are normalized for sorting (Débutant/
  Debutant uses the same rank as N0). This is a deterministic display convention,
  not an equivalence of diving/teaching qualifications. Level being prepared is ignored.
  Other/missing levels remain last in either direction.
- **Sélection**: effective published status only: Confirmé, En attente,
  En attente de publication, Non retenu, Désisté, Sans participation; unknown status last.
  Reverse reverses groups only, keeping alphabetical names within each.

For ties in every criterion: name ascending, then stable member UUID. Registration
timestamps are not used in any sort. All sorts leave loaded records unchanged.
No query, migration, search/filter or private draft visibility change is introduced.

### Calendrier personnel

Les cartes séparent ma réponse, ma sélection publiée effective, mon trajet
(avec avertissement provisoire si le conducteur n’est pas confirmé) et mon
paiement. Une réponse absente/Non ne crée pas une dette affichée : le paiement
est alors « Non concerné ». Le brouillon administrateur ne change pas ces cartes.

Le filtre initial est « À venir » : dates d’aujourd’hui et ultérieures à Paris.
« Passées » contient toutes les dates strictement antérieures, bilan clôturé ou
non. « Toutes » conserve l’ordre chronologique de toutes les saisons. La première séance
à venir dont le bilan n’est pas clôturé est mise en évidence une seule fois.
À la demande de la recette staging, le sélecteur de saison et les commandes précédente/suivante sont retirés. Les filtres couvrent toutes les saisons ; les
compteurs restent basés sur les présences et les bilans clôturés de septembre à août.

L’action principale est « Voir / répondre » sans réponse si les inscriptions
sont ouvertes, « Organiser mon trajet » pour Oui avec trajet absent ou provisoire
(sauf sélection Non retenu), sinon « Voir la séance ». Un bilan clôturé propose
toujours la consultation. Organiser ouvre Covoiturage sans réserver ni modifier
le trajet. Aucun paiement ne prend la priorité dans cette action.
Une sélection pleine ne ferme pas les inscriptions : la carte rappelle
« Vous pouvez encore répondre Oui » tant qu’elles sont ouvertes, uniquement si
la réponse personnelle n’est pas déjà Oui (sans réponse, Peut-être ou Non).

L’actualisation partagée conserve les dernières données valides lors d’un
échec et signale qu’elles ne sont pas actualisées. Avant la première réponse du
serveur, aucun statut personnel ou compteur n’est inventé. Les données d’une
ancienne saison ne sont pas présentées comme celles d’une nouvelle saison.

### Situation personnelle dans une séance

La participation présente d’abord la place dans la sélection publiée effective,
puis la réponse, le trajet, le paiement personnel et le CACI au jour de la séance.
Une réponse Oui reste une intention ; seule une place effectivement sélectionnée
est confirmée. Avant publication, le résumé le dit explicitement, sans annoncer
de date de décision. Un désistement puis un nouveau Oui ne restaure pas l’ancienne
confirmation : une nouvelle sélection publiée est nécessaire.

Participants, Covoiturage, Palanquées et Bilan utilisent une version compacte du
même résumé, sans répéter le grand préambule de sélection ni les données privées.
Gestion conserve le récapitulatif organisateur. Les totaux publics restent visibles
dans Participants. Les boutons de réponse et leurs confirmations CACI/retrait
conservent leurs règles et transactions existantes.

Dans Covoiturage, la voiture personnelle ou le trajet réservé précède les autres
offres. Le conducteur, le rendez-vous et le départ sont lisibles ; les informations
absentes et le conducteur non confirmé sont explicités. La voiture réservée n’est
pas répétée dans les alternatives. Dans Palanquées, le groupe publié de l’adhérent
précède les autres groupes, sans remplacer la publication par le brouillon et sans
réintroduire de personnes masquées par D026. Une absence d’affectation, de publication
ou un désistement produit une explication explicite.

Ces vues réutilisent les RPC existantes et leur actualisation partagée. Aucun
nouveau statut, préférence persistante, schéma ou permission n’est introduit.
Le résumé personnel de détail réutilise la projection du calendrier pour la saison
de la séance (un appel groupé, sans requête par participant). Lors d’un échec,
les derniers statuts valides sont conservés avec un avertissement ; avant le premier
chargement, aucun état personnel n’est inventé.

### Navigation mobile des séances (#50)

Le détail conserve un contexte compact (titre, date/horaires, lieu et retour).
Les accès/consignes sont dépliables et omis lorsqu’ils sont vides. Les onglets
horizontaux disposent de commandes de continuation quand ils débordent ;
flèches/Home/End déplacent le focus et rendent l’onglet actif visible.
Un bouton Gestion explicite reste réservé aux Admin/Président, sans changer
la rubrique personnelle ouverte par défaut. Hors participation, la place
publiée reste visible et la répétition réponse/trajet tient sur une ligne compacte
qui revient à la ligne si nécessaire.

### Comparaison organisateur dans Gestion (#51)

La sélection de travail conserve les groupes Retenu dans le brouillon / En attente / Non retenu. Les niveaux et le compteur de présences effectives dans les bilans clôturés de la saison de la séance sont visibles, avec tri par nom ou compteur. Les compteurs indisponibles restent explicitement inconnus et viennent après les compteurs connus dans les deux sens ; les égalités sont départagées par nom, prénom, identifiant. Le tri Participants reste indépendant.

Les filtres de Gestion se combinent avec la recherche par ET. CACI à vérifier inclut absent, expiré et proche d’expiration au jour de la séance ; Transport à organiser inclut non résolu et provisoire. À régler utilise le readiness paiement canonique. En attente utilise le choix du brouillon. Tous retire les filtres opérationnels ; Réinitialiser retire aussi la recherche. Aucun filtre ne modifie les données.

La base du récapitulatif opérationnel est indiquée globalement. Les informations et le paiement se déplient par personne ; le calcul CACI/transport/conducteur reste celui de la RPC canonique D027. Une décision privée n’est jamais présentée comme une confirmation publiée.

Avant publication, une comparaison nominative complète, indépendante des filtres, montre ajoutés/retirés des confirmés et autres changements. La première publication est identifiée. Le serveur revérifie une empreinte de la publication effective, du brouillon, des réponses et de la capacité sous le verrou de séance avant d’appeler la publication transactionnelle existante. Toute modification pertinente impose un nouveau récapitulatif et une reconfirmation. Paiements et trajets, sans effet sur le contenu de la sélection, n’invalident pas cette comparaison.

### Navigation et retours d’action (#52)

URL internes canoniques : `/seances` (période À venir), `?view=past|all`, option `season=2020…2100` pour un lien de saison sans réintroduire le sélecteur ; `/seances/:uuid?tab=overview|participants|transport|groups|bilan|manage`, `/seances/:uuid/modifier`, `/seances/nouvelle`, `/profil`, `/administration`. Période/saison sont conservées dans les liens de séance issus du calendrier. Les valeurs inconnues reviennent à une vue sûre. Les UUID absents/inaccessibles donnent un retour explicite au calendrier. Les chemins privés sont neutralisés avant rendu pour un membre, sans remplacer les autorisations serveur.

La navigation utilise l’historique du navigateur, y compris Retour/Avancer et rechargement. Un chemin de reprise est conservé uniquement dans le sessionStorage de ce navigateur au moment de demander un email, après validation/canonicalisation ; aucune destination externe, chemin Auth ou donnée/token du callback n’y est conservée. Après confirmation explicite du magic link, ce chemin est consommé une fois ; un autre navigateur revient au calendrier. Logout et changement d’identité effacent cette reprise et les écrans de l’identité précédente. Le template et les validations du callback restent inchangés.

Profil/annuaire et dernière vue Séances restent montés lors d’une navigation réversible. Les éditeurs CACI filtrés sont conservés sans être affichés hors filtre. Une sortie détruisant une saisie locale de séance/voiture, ou une annulation de création/CACI, nécessite Rester/Quitter si des changements existent. Un rechargement utilise l’avertissement standard du navigateur. Les drafts enregistrés en base ne déclenchent pas cet avertissement.

Abandonner un brouillon sélection/palanquées ouvre une confirmation accessible ; Annuler/Escape conserve le travail et restaure le focus. Confirmer retire seulement le brouillon privé, en conservant la publication. Enregistrement/succès/erreur sont placés près du contrôle concerné ; codes métier fiables sont traduits en français avec un fallback borné, sans message fournisseur brut. Une RPC absente signale une mise à jour serveur nécessaire.

### Formulaires et bilan simplifiés (#53)

- Les dates CACI de profil/annuaire sont affichées en français, sans dépendre du fuseau du navigateur ; stockage et inputs restent des dates ISO. Une date absente reste explicitement non renseignée. Le calcul de validité ne change pas.
- Les niveaux suggérés suivent l’ordre d’affichage existant (N0–N5, E1–E3, MF1, E4, MF2). Ils ne constituent ni une taxonomie obligatoire ni une équivalence de qualifications : tout libellé libre de longueur admise reste enregistrable. Les champs facultatifs sont indiqués ; les places passagers excluent le conducteur.
- La demande de connexion conduit à « Consultez votre messagerie », avec adresse normalisée, aide pour les courriers indésirables et formulation conditionnelle identique pour une adresse inconnue. Correction et nouvelle demande sont explicites ; aucun renvoi automatique ni délai d’attente fictif. Signup, confirmation du lien et restrictions de redirect restent inchangés.
- « Réinitialiser les filtres » de l’annuaire rétablit recherche vide, tous rôles/tous CACI et accès actifs. Les brouillons de création et de CACI sont conservés, y compris quand leur ligne est temporairement filtrée.
- Après l’heure de fin de Paris, un admin/président peut demander « Marquer les confirmés comme ayant plongé ». Un récapitulatif serveur nominatif précède la confirmation. Seules les présences À renseigner des confirmés effectifs de la dernière publication sont modifiées ; un draft privé différent, les absents, les personnes n’ayant pas plongé, les présences déjà saisies et les remplacements ne sont pas écrasés.
- Le lot est atomique, autorisé/audité côté serveur et refuse une confirmation périmée si sélection, présences ou état du bilan ont changé. Il faut relire le nouveau récapitulatif et confirmer de nouveau. Une reprise sans inconnus est sans effet. La clôture reste une action distincte, avec les contraintes existantes (présences renseignées et total de plongeurs respectant la capacité). Vérifier les absents avant de clôturer ; les compteurs septembre–août restent basés sur les bilans clôturés.

### Transfert de présidence (D029)

Administration présente une section distincte « Présidence du club » au président seulement. Le choix affiche nom/email ; confirmer nécessite de recopier l’email du successeur et reconnaître la perte des droits présidentiels. La création en cours demande d’abord confirmation d’abandon. Le successeur ne peut être soi-même, suspendu, sans compte Auth, banni, supprimé, non confirmé ou lié à une adresse Auth différente. CACI/niveau ne constituent pas une condition de gouvernance.

La fiche affichée est figée jusqu’à confirmation ; toute modification impose un choix actualisé et une nouvelle confirmation. Une perte de droits ou un résultat réseau ambigu impose de réactualiser l’accès avant toute nouvelle tentative. Le transfert atomique est audité, laisse exactement un président et conserve toutes les données métier/seed. Le profil de l’ancien président est réactualisé immédiatement ; le nouveau rôle est effectif côté serveur même avec les anciens jetons, et les autres appareils utilisent le rafraîchissement existant. Annuler/Escape ne change rien. La récupération opérateur reste distincte.
