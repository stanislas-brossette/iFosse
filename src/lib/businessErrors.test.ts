import { expect, it } from 'vitest'
import { businessError } from './businessErrors'
it('maps only reliable codes/known business errors; never prints provider details',()=>{
  expect(businessError({code:'42501',message:'sensitive'},'Refus')).toContain('Vos droits')
  expect(businessError({code:'40001'},'Refus')).toContain('changé ailleurs')
  expect(businessError({message:'Cette voiture est complète.'},'Refus')).toContain('trajet précédent est conservé')
  expect(businessError({code:'23514',message:'constraint "sessions_end_time_check" SECRET'},'Refus')).toContain('heure de fin')
  expect(businessError({code:'PGRST500',message:'password=SECRET token=SECRET'},'Réessayez.')).toBe('Réessayez.')
})
