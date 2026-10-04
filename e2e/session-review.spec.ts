import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { createSession, testSessionDate } from './helpers/sessions.js'
import { formatDate } from '../src/lib/dates.js'

test('withdrawal confirmation preserves cancellations and participant tabs exclude withdrawals', async ({ page, browser }) => {
  test.setTimeout(90000)
  const driver = await createMemberFixture(); const passenger = await createMemberFixture()
  makeFixtureAdmin(driver)
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const other = await context.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined; let id: string | undefined
  try {
    for (const [device, fixture] of [[page, driver], [other, passenger]] as const) {
      await openConfirmation(device, await requestMagicLink(device, fixture))
      await device.getByRole('button', { name: 'Se connecter', exact: true }).click()
      await expect(device.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    }
    client = await fixtureClient(driver); const memberClient = await fixtureClient(passenger)
    id = await createSession(client, `Retrait ${driver.firstName}`)
    for (const fixture of [driver, passenger]) {
      expect((await client.rpc('set_session_rsvp', { p_session_id: id, p_member_id: fixture.memberId, p_rsvp: 'yes' })).error).toBeNull()
      expect((await client.rpc('set_draft_selection', { p_session_id: id, p_member_id: fixture.memberId, p_state: 'selected' })).error).toBeNull()
    }
    expect((await client.rpc('publish_selection', { p_session_id: id })).error).toBeNull()
    const car = await client.rpc('offer_car', { p_session_id: id, p_passenger_capacity: 1, p_meeting_point: 'Parking', p_note: '' })
    expect(car.error).toBeNull()
    expect((await memberClient.rpc('join_car', { p_session_id: id, p_car_offer_id: car.data! })).error).toBeNull()
    for (const device of [page, other]) {
      const open = device.getByRole('button', { name: `Voir la séance du ${formatDate(testSessionDate)}` })
      await expect(open).toBeVisible({ timeout: 12000 }); await open.click()
      await expect(device.getByText('Ma place : Confirmé', { exact: true })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Non', exact: true }).click()
    await expect(page.getByText('La place confirmée sera libérée.', { exact: false })).toBeVisible()
    await expect(page.getByText('La voiture sera retirée.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Conserver la réponse', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Ma réponse : Oui', exact: true })).toBeVisible()
    expect((await client.rpc('get_car_offers', { p_session_id: id })).data?.[0]?.occupied).toBe(1)
    expect((await client.rpc('get_current_selection', { p_session_id: id })).data?.filter(person => person.state === 'selected')).toHaveLength(2)
    await page.getByRole('tab', { name: 'Gestion', exact: true }).click()
    await page.getByText('Corriger une réponse ·', { exact: false }).click()
    const correction = page.getByRole('combobox', { name: `Réponse de ${passenger.firstName} Fictif`, exact: true })
    await correction.selectOption('maybe')
    await expect(page.getByText('La place confirmée sera libérée.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Conserver la réponse', exact: true }).click()
    await expect(correction).toHaveValue('yes')
    await page.getByRole('tab', { name: 'Ma participation', exact: true }).click()
    await page.getByRole('button', { name: 'Non', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer le changement de réponse', exact: true }).click()
    await expect(page.getByText('Ma place : Désisté', { exact: true })).toBeVisible()
    await other.getByRole('tab', { name: 'Covoiturage', exact: true }).click()
    await expect(other.getByText('Mon trajet : Je cherche un trajet', { exact: true })).toBeVisible({ timeout: 12000 })
    expect((await memberClient.from('session_participations').select('rsvp').eq('session_id', id).single()).data?.rsvp).toBe('yes')
    await expect(other.locator('.selection ul.member-list')).toHaveCount(0)
    await other.getByRole('tab', { name: 'Palanquées', exact: true }).click()
    await expect(other.locator('.selection ul.member-list')).toHaveCount(0)
    await other.getByRole('tab', { name: 'Participants', exact: true }).click()
    await expect(other.locator('.participant-selection')).not.toContainText(driver.firstName)
    expect((await memberClient.rpc('get_session_responses', { p_session_id: id })).data?.some(row => row.member_id === driver.memberId)).toBe(false)
    expect((await memberClient.rpc('get_current_selection', { p_session_id: id })).data?.some(row => row.member_id === driver.memberId)).toBe(false)
    await other.getByRole('tab', { name: 'Ma participation', exact: true }).click()
    await other.getByRole('button', { name: 'Non', exact: true }).click()
    await expect(other.getByText('La place confirmée sera libérée.', { exact: false })).toBeVisible()
    await other.getByRole('button', { name: 'Conserver la réponse', exact: true }).click()
    await expect(other.getByRole('heading', { name: 'Ma réponse : Oui', exact: true })).toBeVisible()
    await other.getByRole('button', { name: 'Non', exact: true }).click()
    await other.getByRole('button', { name: 'Confirmer le changement de réponse', exact: true }).click()
    await expect(other.getByText('Ma place : Désisté', { exact: true })).toBeVisible()
    await other.getByRole('tab', { name: 'Participants', exact: true }).click()
    await expect(other.locator('.participant-selection')).toContainText('Aucune réponse Oui ou Peut-être.')
    expect(await other.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    await other.screenshot({ path: 'test-results/session-review-mobile.png', fullPage: true })
  } finally {
    if (id && client) await client.rpc('delete_session', { p_session_id: id })
    await context.close(); await removeMemberFixture(passenger); await removeMemberFixture(driver)
  }
})
