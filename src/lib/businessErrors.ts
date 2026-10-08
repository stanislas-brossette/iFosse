type Failure={code?:string;message?:string}|null|undefined
const messages:Record<string,string>={
  'Capacité de sélection dépassée. Modifiez la séance pour l’augmenter.':'La capacité de sélection est atteinte. Augmentez la capacité avant de retenir une autre personne.',
  'La capacité est inférieure à la sélection ou aux présences.':'Cette capacité est inférieure aux personnes sélectionnées ou ayant plongé.',
  'Sélection incohérente ou capacité dépassée.':'Vérifiez les réponses Oui et la capacité avant de publier.',
  'Seuls les adhérents ayant répondu Oui peuvent être sélectionnés.':'Seule une réponse Oui peut être retenue dans le brouillon.',
  'Cette voiture est complète.':'Cette voiture est complète. Votre trajet précédent est conservé.',
  'La capacité est inférieure au nombre de passagers.':'Le nombre de places ne peut pas être inférieur aux passagers déjà à bord.',
  'Séance ouverte requise.':'Le bilan est clôturé. Rouvrez-le avant de modifier la séance.',
  'Rouvrez le bilan avant de modifier cette séance.':'Le bilan est clôturé. Rouvrez-le avant de modifier la séance.',
  'Rouvrez le bilan avant de corriger les présences.':'Le bilan est clôturé. Rouvrez-le avant de corriger les présences.',
  'Inscriptions fermées.':'Les inscriptions sont fermées. Un désistement reste possible.',
  'Les présences se renseignent après la séance.':'Les présences se renseignent après l’heure de fin de la séance (heure de Paris).',
  'La séance n’est pas encore terminée.':'La séance n’est pas encore terminée (heure de Paris).',
  'Renseignez la présence de chaque participant confirmé.':'Renseignez toutes les présences des confirmés avant de clôturer.',
  'Le nombre de plongeurs dépasse la capacité.':'Le nombre de personnes ayant plongé dépasse la capacité. Corrigez les présences ou la capacité.',
}
export function businessError(error:Failure,fallback:string){
  if(error?.code==='42501'||error?.code==='401'||error?.code==='403')return 'Vos droits ne permettent plus cette action. Actualisez votre accès.'
  if(error?.code==='PGRST202')return 'Cette action nécessite une mise à jour du serveur. Contactez l’administrateur.'
  if(error?.code==='40001')return 'Les données ont changé ailleurs. Actualisez avant de réessayer.'
  if(error?.message&&messages[error.message])return messages[error.message]
  if(error?.code==='23514'&&error.message?.includes('"sessions_end_time_check"'))return 'L’heure de fin doit être après l’heure de début, le même jour.'
  return fallback
}
