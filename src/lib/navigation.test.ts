import { afterEach, expect, it } from 'vitest'
import { allowedRoute, clearReturnPath, consumeReturnPath, parseRoute, rememberReturnPath, routePath } from './navigation'
afterEach(()=>{history.replaceState(null,'','/');clearReturnPath()})
const id='12345678-1234-4234-8234-123456789abc'
it('validates internal routes and canonicalizes query enums without retaining private data',()=>{
  expect(routePath(parseRoute(`/seances/${id}?tab=transport&token_hash=SECRET`)!)).toBe(`/seances/${id}?tab=transport`)
  expect(routePath(parseRoute('/seances?season=2026&view=past')!)).toBe('/seances?season=2026&view=past')
  expect(parseRoute('/seances?season=evil&view=evil')).toMatchObject({view:'upcoming',season:undefined})
  expect(parseRoute(`/seances/${id}?tab=evil`)).toMatchObject({tab:'overview'})
  for(const invalid of ['https://evil.test','//evil.test','/auth/confirm','/seances/bad-id',`/seances/${id}#token_hash=secret`,'/\\evil.test'])expect(parseRoute(invalid)).toBeNull()
})
it('denies private routes before rendering while preserving permitted session tab',()=>{
  const member=allowedRoute(parseRoute(`/seances/${id}?tab=manage`)!,false)
  expect(member.tab).toBe('overview');expect(member.sessionId).toBe(id)
  expect(allowedRoute(parseRoute('/administration')!,false).area).toBe('sessions')
  expect(allowedRoute(parseRoute(`/seances/${id}/modifier`)!,false).editing).toBeUndefined()
  expect(allowedRoute(parseRoute('/administration')!,true).area).toBe('admin')
})
it('resumes sanitized links once, rejects tampered/external/auth targets and works without stored target',()=>{
  history.replaceState(null,'',`/seances/${id}?tab=bilan&access_token=SECRET`);rememberReturnPath()
  expect(sessionStorage.getItem('ifosse:return-path')).toBe(`/seances/${id}?tab=bilan`)
  expect(consumeReturnPath()).toBe(`/seances/${id}?tab=bilan`);expect(consumeReturnPath()).toBe('/seances')
  for(const invalid of ['https://evil.test','//evil.test','/auth/confirm#token_hash=secret']){sessionStorage.setItem('ifosse:return-path',invalid);expect(consumeReturnPath()).toBe('/seances')}
})
