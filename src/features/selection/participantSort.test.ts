import { afterEach, expect, it, vi } from 'vitest'
import { defaultSort, readSort, saveSort, sortParticipants } from './participantSort'
const person = (id: string, last: string, date: string | null, level: string | null = 'N2', state: string | null = 'waiting', first = 'Alex') => ({ member_id: id, last_name: last, first_name: first, registered_at: date, current_level: level, state })
const rows = [person('c', 'Zulu', '2026-10-03', 'N1', 'selected'), person('a', 'Éclair', '2026-10-01', 'N3', 'declined'), person('b', 'Durand', '2026-10-02', 'N2', 'waiting')]
const ids = (key: typeof defaultSort.key, descending = false, people = rows) => sortParticipants(people, { key, descending }).map(p => p.member_id)
afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks() })
it('defaults to oldest registration, without mutating loaded data', () => {
  expect(defaultSort).toEqual({ key: 'registration', descending: false })
  expect(ids('registration')).toEqual(['a', 'b', 'c']); expect(rows[0].member_id).toBe('c')
  expect(ids('registration', true)).toEqual(['c', 'b', 'a'])
})
it('orders French surnames then first names, and reverses names', () => {
  expect(ids('name')).toEqual(['b', 'a', 'c']); expect(ids('name', true)).toEqual(['c', 'a', 'b'])
  expect(ids('name', false, [person('a','Durand','2026-10-01','N1','pending','Zoé'),person('b','Durand','2026-10-02','N1','pending','Anne')])).toEqual(['b','a'])
})
it('orders diving and teaching levels deterministically, ignoring training level', () => {
  expect(ids('level', false, [person('n','N',null,'N1'),person('d','D',null,'Débutant')])).toEqual(['d','n'])
  expect(ids('level')).toEqual(['c','b','a']); expect(ids('level',true)).toEqual(['a','b','c'])
  expect(ids('level', false, [person('a','A',null,'MF1'),person('b','B',null,' n4 '),person('c','C',null,'E1')])).toEqual(['b','c','a'])
})
it('orders published statuses and reverses groups but keeps oldest first within each', () => {
  expect(ids('selection')).toEqual(['c','b','a']); expect(ids('selection',true)).toEqual(['a','b','c'])
  const grouped = [person('c','Z','2026-10-03'), person('a','A','2026-10-01'),person('b','B','2026-10-02','N1','selected')]
  expect(ids('selection',true,grouped)).toEqual(['a','c','b'])
  expect(ids('selection',false,[person('p','P',null,'N1','pending'),person('w','W',null,'N1','waiting'),person('d','D',null,'N1','withdrawn'),person('n','N',null,'N1','none')])).toEqual(['w','p','d','n'])
})
it('uses chronological, name and ID tie breaks even when input order changes', () => {
  const ties = [person('b','A','2026-10-01'),person('a','A','2026-10-01'),person('c','Z','2026-10-01')]
  expect(ids('registration',false,ties)).toEqual(['a','b','c'])
  expect(ids('registration',true,ties.reverse())).toEqual(['a','b','c'])
})
it('keeps missing/unknown dates, levels and statuses last in both directions', () => {
  const unknown = [person('m','B',null,null,null),person('u','A','invalid','unknown','unknown'),person('k','K','2026-10-01')]
  for (const key of ['registration','level','selection'] as const) for (const descending of [false,true]) expect(ids(key,descending,unknown)).toEqual(['k','u','m'])
})
it('persists only in session storage and ignores corrupt or unsupported preferences', () => {
  expect(readSort()).toEqual(defaultSort)
  saveSort({key:'level',descending:true}); expect(readSort()).toEqual({key:'level',descending:true})
  sessionStorage.setItem('ifosse:participant-sort','bad'); expect(readSort()).toEqual(defaultSort)
  sessionStorage.setItem('ifosse:participant-sort','{"key":"payment","descending":true}'); expect(readSort()).toEqual(defaultSort)
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw Error('blocked') }); expect(() => saveSort(defaultSort)).not.toThrow()
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(() => { throw Error('blocked') }); expect(readSort()).toEqual(defaultSort)
})
