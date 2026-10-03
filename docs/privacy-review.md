# Revue de confidentialité avant lancement

Statut : contrôles techniques locaux testés; décisions de conservation et information des adhérents à valider par APSAP avant import réel. Ce document ne constitue pas une validation juridique ou réglementaire.

## Minimisation et accès déjà implémentés

| Données | Finalité dans le MVP | Accès applicatif |
| --- | --- | --- |
| Nom, prénom, niveaux | Inscriptions, sélection, organisation des palanquées | Identités/niveaux dans le contexte d’une séance; annuaire global administrateur uniquement |
| Email/Auth | Connexion par lien magique, support | Soi/administrateur; aucune projection de participants ou de palanquées n’expose l’email |
| Téléphone et habitudes de voiture | Coordination et préremplissage explicite | Soi/administrateur; proposer une voiture ne publie pas le téléphone |
| Point de rendez-vous/heure/note proposés | Organisation d’un trajet de séance | Membres actifs; écrire seulement les informations utiles au trajet |
| Date de fin CACI | Avertissement à la date de la séance | Soi en lecture; administrateur en écriture; aucune pièce médicale ni diagnostic |
| Paiement unpaid/paid/free | Suivi déclaratif de la séance | Soi en lecture; administrateur/president en écriture; aucun paiement en ligne |
| Présences et compteurs | Bilan et historique de participation | Bilan non clôturé soi/admin; bilan validé dans le contexte de séance; compteur personnel pour un membre, roster minimal pour admin |
| Publications et audit minimal | Traçabilité et reprise après erreur | Publications visibles aux membres; audit admin/opérateur; pas de copie de certificats, téléphone ou email dans les événements |

Les rôles sont relus en base pour les écritures sensibles; la révocation ne dépend pas de l’expiration du JWT. L’API ne donne aucun droit d’écriture directe aux tables métier dans le navigateur. Les previews doivent utiliser un projet distinct et uniquement des données fictives. Les sauvegardes et fichiers de roster sont privés, chiffrés selon la procédure opérateur, et exclus du dépôt.

## Décisions à consigner par le club

Avant lancement, APSAP doit nommer le responsable/référent, préciser finalités et bases juridiques, examiner le traitement de la date CACI, les contrats/sous-traitants (Supabase, Netlify, SMTP), les destinataires et les éventuels transferts. Préparer une notice compréhensible avec contact, accès/rectification/effacement et modalités d’exercice des droits. Valider la région EU du projet réel; la configuration locale ne prouve pas la localisation ou les engagements contractuels hébergés.

Fixer des durées justifiées par catégorie, plutôt qu’une conservation indéfinie : données de membre actif et départ du club, habitudes de voiture, séances/présences nominatives nécessaires aux compteurs, paiements déclaratifs, snapshots/audit et sauvegardes. Distinguer usage actif, éventuel archivage à accès limité et suppression. Définir qui examine les échéances et conserve la preuve du traitement des demandes. Ne pas appliquer automatiquement une durée conçue pour des factures à ce simple indicateur de paiement.

Aucune durée chiffrée ni purge automatique n’est introduite sans décision du club. À l’effacement, la suppression de l’identité/profil peut cascader des identifiants et affectations historiques; les traces d’audit minimales peuvent encore comporter des UUID. Le club doit préciser la conservation de ces traces et la manière de réappliquer un effacement après restauration. Transférer la présidence avant toute suppression du compte président. Tester l’opération sur staging, avec sauvegarde privée, avant une demande réelle.

Sources de revue : [principes et limitation de conservation CNIL](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2), [déterminer les durées selon la finalité](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees), [guide CNIL pour les associations](https://www.cnil.fr/sites/default/files/atoms/files/cnil-guide_association.pdf). La validation et le calendrier de conservation restent un gate de #18.
