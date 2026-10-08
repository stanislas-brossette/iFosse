# Product decisions

This file records explicit product decisions so that they do not get lost between conversations, prototypes and implementation changes.

## D001 — Session is the main entry point

**Decision:** iFosse is organized primarily around a diving-pool session.

**Rationale:** the operational problem to solve is session organization, not general club administration.

---

## D002 — All club members have accounts

**Decision:** all club members will have an iFosse account.

**Scale:** approximately 50 users.

---

## D003 — Application roles remain intentionally small

**Decision:** iFosse uses three application roles: member, administrator and president.

Administrators cover the operational DP / organizer capabilities used by Xavier and TitO. The president is the super-admin described in D018.

Federation or instructor qualification hierarchies remain separate from application permissions and should only be added if a concrete product need appears.

---

## D004 — Registrations may exceed capacity

**Decision:** Yes responses are never capped by session capacity.

A session with capacity 20 may have more than 20 Yes responses.

**Rationale:** organizers choose the final participants later and cancellations may occur.

---

## D005 — Final selection is capacity constrained

**Decision:** the administrator's final participant selection cannot exceed the session's current capacity.

Encadrants/instructors consume a place.

If more places are needed, an administrator may edit the session and increase its capacity.

---

## D006 — Selection uses draft + publication

**Decision:** administrator selection changes are prepared as a draft.

Members continue to see the previous published state until an administrator explicitly publishes the draft.

Administrators may later modify and publish again.

**Rationale:** organizers need freedom to work on the list without exposing unstable intermediate decisions.

---

## D007 — Session participant view focuses on registered members

**Decision:** the session Participants tab shows members who answered Yes or Maybe.

No and unanswered members are not displayed in that regular session view. Administrators can still access the broader member population from management tools when they need to correct or enter a response.

---

## D008 — Season runs September to August

**Decision:** participation counters are calculated per season from 1 September through 31 August.

Example: season 2026–2027 runs from 1 September 2026 through 31 August 2027.

---

## D009 — Attendance drives participation counters

**Decision:** season counters are based on actual validated attendance, not registration or selection.

**Rationale:** late withdrawals and replacements must not distort the history.

---

## D010 — Payment remains trust-based

**Decision:** no online payment workflow is required.

Payment status is administrative information with states such as To pay / Paid / Free.

Members can see their own status.

Only administrators can modify it.

---

## D011 — Carpooling is editable after registration

**Decision:** members may add, change or remove carpool information after their initial session response.

A driver offers a configurable number of passenger seats for a specific session.

If a driver withdraws, passengers remain registered but their transport becomes unresolved.

---

## D012 — Regulatory document generation is deferred

**Decision:** simple palanquee organization may exist in the MVP, but generation and long-term storage of the official regulatory document is deferred to a later version.

---

## D013 — Keep the MVP focused on fosse management

**Decision:** richer member records and general club-management functions are future extensions.

The MVP should not expand into licence/CACI/document management, pedagogical tracking or general ERP features unless explicitly reprioritized.

---

## D014 — V0 is a prototype, not production architecture

**Decision:** `frontend/iFosse_V0.html` is the functional reference for the current flows.

Its single-file/local-storage implementation is not a constraint on the architecture of the production application.


---

## D015 — Car profile defaults are optional

**Decision:** members do not have a car by default in their profile.

A member may opt in to storing usual carpool defaults (passenger seats and meeting point). These values only prefill future session car offers and never create an offer automatically.

A member without a usual car in their profile may still offer a car for a specific session. After doing so, the application may explicitly offer to save those values as profile defaults.

**Rationale:** session transport is the operational truth, while profile car information is only a convenience.


---

## D016 — Member dashboard is personal and member directory is admin-only

**Decision:** the global member directory is visible only to administrators.

Regular members continue to see participant information in the context of a specific session, where it is useful for coordination, but they do not browse the club-wide member list.

The regular-member home dashboard should prioritize information that is directly actionable for that member: response status, published selection status, transport, and payment. Global operational indicators belong to the administrator dashboard.

**Rationale:** regular members need a simpler, more personal interface and should not be exposed to unnecessary club-wide operational information.


---

## D017 — Palanquee level summaries are informational

**Decision:** the palanquee editor shows a dynamic summary of the qualifications / training levels present in the published participant selection, and a live summary for each palanquee while the administrator changes assignments.

The initial summary categories are:

- E3
- E2
- E1
- N4
- N3
- PN3
- PN2
- PN1

For the current prototype data model, MF1 is displayed as E3 in this summary. A member preparing N3 / N2 / N1 is displayed respectively as PN3 / PN2 / PN1 when no higher listed current qualification category applies.

**Important:** these summaries are visual aids for the DP. They do not validate regulatory compliance, required supervision ratios, depth limits, or qualification rules.


---

## D018 — President is the super-admin role

**Decision:** iFosse has three application roles:

- `member` — regular member;
- `admin` — manages sessions, selections, payments, attendance, palanquees and member information;
- `president` — has all admin permissions and is the only role allowed to grant or revoke admin rights.

The prototype keeps exactly one president. The president role itself cannot be removed from the member editor.

**Rationale:** ordinary admins should not be able to escalate privileges or remove each other's rights. Governance of administrator access belongs to the president.


---

## D019 — CACI expiry warnings are advisory

**Decision:** iFosse compares a member's CACI end date with both the current date and the date of a future fosse.

The interface distinguishes:

- valid;
- expires soon (within 60 days);
- expired;
- not entered.

If a member answers Yes to a future fosse where their CACI will be expired, or where no CACI date is entered, the application warns them before saving the response but does not block registration.

Admins see the CACI status for the member list and specifically "on the day" in the session-selection view.

**Rationale:** the member may renew their CACI before the session, so an advisory warning supports follow-up without prematurely blocking registration.


---

## D020 — Readiness summary is operational

**Decision:** the administrator selection view summarizes four operational points per member: selection, CACI validity on the session date, transport and payment.

**Rationale:** organizers should be able to spot unresolved preparation items without switching between several views.

This summary is not a regulatory or medical fitness decision.

---

## D021 — Members can see their own CACI validity

**Decision:** members may see their own CACI end date and status in Mon profil.

The date remains maintained by an administrator in the prototype.

---

## D022 — School-holiday marking is explicit

**Decision:** an administrator may mark a session as taking place during school holidays.

The prototype displays a "Vacances scolaires" badge and does not automatically derive the holiday calendar.


---

## D023 — Production authentication uses email magic links

**Decision:** the production MVP uses passwordless email magic-link authentication.

Members authenticate with a known club email address. Successful login creates a refreshable long-lived browser session intended to survive normal browser restarts until explicit logout, revocation or provider expiry.

There is no password creation or password reset flow in the MVP.

**Rationale:** the club has a small known population and the priority is minimizing login/support friction for non-technical users.

---

## D024 — Production stack is React + Supabase + Netlify

**Decision:** the production MVP uses React + TypeScript + Vite for the frontend, Supabase (EU region) for PostgreSQL/Auth/RLS, and Netlify for frontend hosting and preview deployments.

A separate custom API server is not required initially. Atomic business operations are implemented with PostgreSQL constraints/functions/transactions where needed.

**Rationale:** this keeps the architecture small and managed while providing real authentication, shared durable state, server-side authorization and transactional database behavior.

---

## D025 — Published selections and palanquees are versioned snapshots

**Decision:** production publication creates immutable versioned snapshots rather than mutating the previously published state in place.

The latest successful publication is the member-visible state. A new draft does not alter the current publication.

**Rationale:** this matches the validated draft/publication UX and provides a straightforward audit/recovery path.

---

## D026 — Session response visibility is enforced at the API boundary

**Decision:** following the independent review and the request to implement its fixes, regular member-facing response/selection projections expose other members only while their current response is Yes or Maybe. Members retain their own response and withdrawal/selection status. A separate admin-only response projection supports No/unanswered corrections. Direct historical selection/group reads follow the same own/admin/Yes-or-Maybe boundary; stored publications remain immutable.

The Participants view contains only Yes/Maybe, including their published selection status. Other session tabs show a compact personal selection summary, without prepending the full participant list. This tightens the older specification's general wording that all No responses were member-visible; it implements the review's recommended minimization rather than only hiding rows in React. Validated attendance/history remains governed by the existing bilan rules.

**Withdrawal:** a response change that releases a published confirmed place or an occupied car requires explicit confirmation, including administrator corrections. Canceling changes nothing. Server checks run under the session lock; existing transactional car/selection cleanup remains authoritative.

---

## D027 — Provisional carpooling and checklist basis

**Decision:** a Yes member may offer a car before final confirmation. Car cards and personal trips are provisional until the driver is effectively selected in the latest publication. Passenger booking remains possible; driver exclusion/withdrawal keeps the existing displacement rules.

The administrator checklist uses one consistent selection basis for both the participant and their driver: the private draft when its header exists, otherwise the published effective selection. A passenger/driver trip is transport-ready only if that driver is selected in that basis. The checklist states its basis; four draft points display “Brouillon prêt à publier”, not a published confirmation. Public car cards always use the publication and never reveal draft state. This is an operational distinction, not a transport guarantee or regulatory assessment.

---

## D028 — President-managed membership lifecycle

**Decision (explicit member-management request):** one Admin/President directory replaces the duplicated rights list. Only the current President can create an ordinary member or suspend/reactivate access. Creation uses a small Supabase Edge Function for Auth Admin, followed by a caller-authorized transactional SQL finalizer reusing operator provisioning. No passwords, public signup or invitations are introduced; operator bootstrap/recovery remains available.

Suspension is `members.disabled_at`, enforced both by current-member RLS/RPC authorization and a required Custom Access Token Auth hook. History, operational session state, roles and seed ownership remain intact; organizers handle any future-session adjustments explicitly. Reactivation clears the suspension, without removing separate operator Auth bans. An inactive profile cannot become President. General hard deletion is excluded, including test accounts, pending a separate verified history/referential-integrity procedure. See [deployment and recovery instructions](member-management.md).


## D029 — Transfert explicite de la présidence

**Decision (demande explicite du propriétaire) :** le président courant peut transférer la présidence à un autre adhérent ou admin actif disposant d’une identité Auth confirmée et utilisable. L’ancien président devient administrateur, conformément à la RPC existante ; l’unicité de la présidence est conservée. Ce parcours dédié ne permet pas de retirer simplement le rôle depuis l’éditeur ordinaire.

L’interface place cette action exceptionnelle en bas de Mon profil du président, dans une section dépliable : identité du successeur, avertissement sur les droits perdus, email à recopier et reconnaissance explicite avant confirmation. Annuler/Escape ne fait rien. Une fiche modifiée demande actualisation/reconfirmation. Le serveur réautorise après verrou, vérifie disponibilité et identité, effectue les deux changements et leur audit atomiquement. Le retour nécessite un nouveau transfert par le nouveau président ou la récupération opérateur existante. Pas de nouveaux mots de passe, invitations Auth, signup ou secrets frontend. Les notifications informatives de D030 sont une activation séparée.

Précaution de transfert : les adresses fictives en `.invalid` sont exclues des choix et refusées par les deux RPC ; aucun marqueur ou enregistrement seed n’est modifié. La confirmation demande d’avoir vérifié que le successeur peut se connecter avec son lien habituel. Ce contrôle humain ne prétend pas garantir la délivrabilité de tout email. `.invalid` est réservé aux noms volontairement invalides ([RFC 2606](https://www.rfc-editor.org/rfc/rfc2606#section-2)). Les fixtures locales `example.test` restent utilisables via Mailpit ; elles ne doivent pas être utilisées comme successeurs réels hébergés.


## D030 — Notifications transactionnelles de compte

**Décision (demande explicite du propriétaire)** : première tranche email pour création depuis le Président, désactivation/réactivation, attribution/retrait admin et transfert de présidence (deux intéressés). Bienvenue informatif sans invitation/Auth token. Pas d’email de CACI, modification personnelle, import/seed ou récupération/bootstrap opérateur. Cette décision remplace la mention antérieure « aucun email » pour ces seules opérations applicatives ; Auth reste inchangé.

Mise en file avec l’audit après réussite, worker serveur Brevo séparé, destinataires synthétiques exclus, staging limité à une liste exacte de testeurs. Envoi désactivé par défaut, aucun rattrapage des anciens audits. Une panne fournisseur ne remet pas en cause l’action métier. Statut accepté distinct de livré ; reprises bornées après refus certain, incertitude revue par opérateur pour éviter les doublons. [Architecture, déploiement et limites](member-notifications.md).
