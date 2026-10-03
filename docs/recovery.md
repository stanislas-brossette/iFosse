# Sauvegarde et restauration

## Preuve locale et portée

`npm run db:restore-check` a été exécuté avec succès sur le Supabase local. Le test crée deux identités fictives, une séance avec sélection publiée, paiements, voiture/passager, palanquée publiée et bilan clôturé. Il sauvegarde la base entière en format PostgreSQL custom, restaure dans une base temporaire distincte, puis vérifie liens Auth, propriétaires, RLS, confidentialité, snapshots, places, audit et correction du bilan/compteur. Il vérifie que la source reste inchangée et supprime fixtures, base temporaire et sauvegarde. Les événements d’audit minimaux restent conservés. CI exécute désormais ce test après les navigateurs.

Le test accepte uniquement le socket Docker local et le conteneur CLI `ifosse`. Il utilise le propriétaire local `supabase_admin` pour restaurer les schémas gérés et conserve les propriétaires/ACL d’origine. Restaurer tous les objets sous un nouveau propriétaire ou ignorer des erreurs de restauration invalide la preuve. Aucun accès à une base distante n’est accepté.

Cette preuve couvre une restauration logique locale réellement exécutée. La récupération du projet hébergé, de ses paramètres Auth/SMTP et de son application doit encore être répétée avec l’opérateur sur l’environnement de staging. Le PostgreSQL démarré par la CLI ne sert jamais de production.

## Exploitation hébergée

Avant lancement, nommer un opérateur principal et un suppléant, choisir le niveau de sauvegarde Supabase adapté, fixer la fréquence, la durée de conservation, la perte de données acceptable et le délai de reprise. Vérifier la disponibilité effective des sauvegardes et leur stockage hors du seul poste d’un organisateur. Conserver les exports chiffrés avec accès limité, hors Git/Netlify et hors preview public. Ils contiennent notamment les données Auth et les paiements.

Privilégier la restauration du fournisseur vers un projet de récupération privé. Pour une sauvegarde/restauration logique entre projets, suivre la [procédure officielle Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) avec la version de CLI verrouillée du dépôt. Elle distingue rôles, schéma, données et historique des migrations. Sauvegarder également l’historique `supabase_migrations`; vérifier les données Auth plutôt que supposer qu’un export du seul schéma applicatif suffit. Ne pas restaurer vers une preview contenant des visiteurs externes. Ne pas mettre les mots de passe de connexion dans un ticket, le dépôt ou les captures.

Les paramètres du projet (région, URL/redirects, template de lien magique, SMTP, secrets/clés, limites Auth), les variables Netlify et le lien Git sont une configuration séparée à inventorier dans le coffre opérateur. Le MVP n’utilise ni documents uploadés ni Edge Functions; si cela change, leur sauvegarde demandera une procédure distincte. Voir aussi [sauvegardes Supabase](https://supabase.com/docs/guides/platform/backups) et [restauration locale d’un export](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup).

## Reprise après incident

1. Geler les écritures et conserver la date/heure de la panne et le dernier point sain. Maintenir Framadate et les outils habituels comme fallback pendant le pilote.
2. Restaurer dans une cible privée distincte. En cas d’erreur, arrêter et diagnostiquer; ne pas ignorer les erreurs, relâcher RLS ou modifier arbitrairement les snapshots pour faire passer l’import.
3. Vérifier membres/Auth, rôles/présidence, séances, versions de publication, paiements privés, places passagers, présences, compteurs et audit. Tester des comptes de membre et d’administrateur séparés, y compris des requêtes refusées. Ne pas utiliser uniquement un compte opérateur qui contourne RLS.
4. Reconstituer les changements intervenus depuis la sauvegarde : révocations, bans, demandes d’effacement, nouvelles publications, paiements et présences. Une sauvegarde ancienne peut réintroduire des données effacées ou des droits retirés. Réappliquer les décisions avant ouverture et révoquer les sessions compromises.
5. Vérifier liens magiques sur un vrai téléphone, destinataires SMTP, redirects exacts et isolation des environnements. L’opérateur consigne la cible, le point restauré, les vérifications et la durée de reprise sans secrets.
6. Basculer uniquement après validation organisateur. Une restauration peut changer URL/clé publique; reconstruire le frontend avec la bonne configuration. Garder le fallback jusqu’à une fosse complète validée.
