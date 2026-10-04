import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { seasonOf, todayParis } from '../src/lib/dates.js'
import { createSession } from './helpers/sessions.js'

test('member and admin cards show only effective published occupancy across draft, republication and withdrawal', async ({ page, browser }) => {
  test.setTimeout(90000)
  const admin = await createMemberFixture(); const member = await createMemberFixture()
  const context = await browser.newContext(); const other = await context.newPage()
  let a: Awaited<ReturnType<typeof fixtureClient>> | undefined; let id: string | undefined
  try {
    makeFixtureAdmin(admin)
    for (const [device, fixture] of [[page, admin], [other, member]] as const) {
      await openConfirmation(device, await requestMagicLink(device, fixture))
      await device.getByRole('button', { name: 'Se connecter', exact: true }).click()
      await expect(device.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    }
    a = await fixtureClient(admin); const m = await fixtureClient(member)
    const title = `Occupation ${admin.firstName}`
    id = await createSession(a, title)
    const cards = [page, other].map(device => device.locator('article').filter({ hasText: title }))
    const check = async (text: string) => { for (const card of cards) await expect(card).toContainText(text, { timeout: 12000 }) }
    await check('Sélection non publiée · 2 places')
    for (const fixture of [admin, member]) expect((await a.rpc('set_session_rsvp', { p_session_id: id, p_member_id: fixture.memberId, p_rsvp: 'yes' })).error).toBeNull()
    expect((await a.rpc('set_draft_selection', { p_session_id: id, p_member_id: member.memberId, p_state: 'selected' })).error).toBeNull()
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await other.evaluate(() => window.dispatchEvent(new Event('focus')))
    await check('Sélection non publiée · 2 places')
    expect((await a.rpc('publish_selection', { p_session_id: id })).error).toBeNull()
    await check('1 confirmés / 2 places')
    expect((await a.rpc('set_draft_selection', { p_session_id: id, p_member_id: admin.memberId, p_state: 'selected' })).error).toBeNull()
    for (const client of [a, m]) expect((await client.rpc('get_session_card_summaries', { p_start_year: seasonOf(todayParis()) })).data?.find(row => row.session_id === id)?.confirmed_count).toBe(1)
    expect((await a.rpc('publish_selection', { p_session_id: id })).error).toBeNull()
    await check('2 confirmés / 2 places')
    expect((await m.rpc('set_session_rsvp', { p_session_id: id, p_rsvp: 'no', p_confirm_withdrawal: true })).error).toBeNull()
    await check('1 confirmés / 2 places')
    for (const card of cards) await expect(card.getByRole('progressbar')).toHaveAttribute('value', '1')
  } finally {
    if (id && a) await a.rpc('delete_session', { p_session_id: id })
    await context.close(); await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})
