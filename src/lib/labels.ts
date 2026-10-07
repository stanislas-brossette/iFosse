export const selectionLabels: Record<string, string> = { pending: 'En attente de publication', waiting: 'En attente', selected: 'Confirmé', declined: 'Non retenu', withdrawn: 'Désisté', none: 'Sans participation' }
export const transportLabels = { unset: 'Trajet à préciser', needs: 'Je cherche un trajet', own: 'Par mes propres moyens', driver: 'Conducteur', passenger: 'Passager' } as const
export const paymentLabels = { unpaid: 'À régler', paid: 'Payé', free: 'Gratuit' } as const
export const attendanceLabels = { unknown: 'À renseigner', dived: 'A plongé', absent: 'Absent', not_dived: 'N’a pas plongé' } as const

export const rsvpLabels = { unanswered: 'Sans réponse', yes: 'Oui', maybe: 'Peut-être', no: 'Non' } as const
