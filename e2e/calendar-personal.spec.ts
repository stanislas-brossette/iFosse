import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { todayParis } from '../src/lib/dates.js'

test('personal calendar follows publication and transport across devices without exposing the draft', async ({ page, browser }) => {
  test.setTimeout(90000)
  const admin = await createMemberFixture(); const member = await createMemberFixture()
  makeFixtureAdmin(admin)
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const other = await context.newPage()
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined
  const ids: string[] = []
  const ok = (result: { error: unknown }) => expect(result.error).toBeNull()
  try {
    for (const [device, fixture] of [[page, admin], [other, member]] as const) {
      await openConfirmation(device, await requestMagicLink(device, fixture))
      await device.getByRole('button', { name: 'Se connecter', exact: true }).click()
      await expect(device.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    }
    client = await fixtureClient(admin)
    const own = await fixtureClient(member)
    const today = todayParis()
    const past = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)
    for (const [date, title] of [[today, 'Calendrier fictif aujourd’hui'], [past, 'Calendrier fictif passé non clôturé']] as const) {
      const created = await client.rpc('save_session', { p_date: date, p_title: title, p_start_time: '21:00', p_end_time: '22:00', p_capacity: 1, p_registration_open: true, p_venue: 'Bassin fictif', p_address: '', p_notes: '', p_school_holiday: false, p_end_time_estimated: false })
      ok(created); ids.push(created.data!)
    }
    const id = ids[0]
    const card = other.locator('.session-card').filter({ hasText: 'Calendrier fictif aujourd’hui' })
    await expect(card).toBeVisible({ timeout: 12000 })
    await expect(card.getByText('Sans réponse', { exact: true })).toBeVisible()
    await expect(card.getByText('Non concerné', { exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: /Voir \/ répondre/ })).toBeVisible()
    await expect(other.getByText('Calendrier fictif passé non clôturé', { exact: true })).toHaveCount(0)
    for (const fixture of [admin, member]) ok(await client.rpc('set_session_rsvp', { p_session_id: id, p_member_id: fixture.memberId, p_rsvp: 'yes' }))
    ok(await client.rpc('set_draft_selection', { p_session_id: id, p_member_id: member.memberId, p_state: 'selected' }))
    await expect(card.getByText('Oui', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(card.getByText('Sélection non publiée', { exact: true })).toBeVisible()
    await card.getByRole('button', { name: /Organiser mon trajet/ }).focus()
    await other.keyboard.press('Enter')
    await expect(other.getByRole('tab', { name: 'Covoiturage', exact: true })).toHaveAttribute('aria-selected', 'true')
    expect((await own.rpc('get_car_offers', { p_session_id: id })).data).toHaveLength(0)
    await other.getByRole('button', { name: 'Toutes les séances', exact: true }).click()
    const car = await client.rpc('offer_car', { p_session_id: id, p_passenger_capacity: 1, p_meeting_point: 'Parking fictif', p_note: '' })
    ok(car); ok(await own.rpc('join_car', { p_session_id: id, p_car_offer_id: car.data! }))
    ok(await client.rpc('publish_selection', { p_session_id: id }))
    await expect(card.getByText('Confirmé', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(card.getByText('Provisoire · conducteur non confirmé', { exact: true })).toBeVisible()
    await expect(card.getByText('Vous pouvez encore répondre Oui', { exact: true })).toHaveCount(0)
    ok(await client.rpc('set_draft_selection', { p_session_id: id, p_member_id: member.memberId, p_state: 'waiting' }))
    // A subsequent published payment update triggers a fresh snapshot; private selection still does not leak.
    ok(await client.rpc('set_payment_status', { p_session_id: id, p_member_id: member.memberId, p_status: 'paid' }))
    await expect(card.getByText('Payé', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(card.getByText('Confirmé', { exact: true })).toBeVisible()
    const adminCard = page.locator('.session-card').filter({ hasText: 'Calendrier fictif aujourd’hui' })
    await expect(adminCard.getByText('À régler', { exact: true })).toBeVisible()
    ok(await client.rpc('set_draft_selection', { p_session_id: id, p_member_id: admin.memberId, p_state: 'selected' }))
    ok(await client.rpc('publish_selection', { p_session_id: id }))
    await expect(card.getByText('En attente', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(card.getByText('Provisoire · conducteur non confirmé', { exact: true })).toHaveCount(0)
    await expect(card.getByRole('button', { name: /Voir la séance/ })).toBeVisible()
    ok(await own.rpc('set_session_rsvp', { p_session_id: id, p_member_id: member.memberId, p_rsvp: 'no' }))
    await expect(card.getByText('Non', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(card.getByText('Non concerné', { exact: true })).toBeVisible()
    await expect(card.getByText('Vous pouvez encore répondre Oui', { exact: true })).toBeVisible()
    await other.getByRole('button', { name: 'Passées', exact: true }).click()
    // The previous date may belong to the preceding season on September 1.
    if (today.slice(5) === '09-01') await other.getByRole('button', { name: 'Saison précédente', exact: true }).click()
    await expect(other.getByText('Calendrier fictif passé non clôturé', { exact: true })).toBeVisible()
    expect(await other.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  } finally {
    if (client) for (const id of ids) await client.rpc('delete_session', { p_session_id: id })
    await context.close(); await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})
