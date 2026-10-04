import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { createSession, testSessionDate } from './helpers/sessions.js'
import { formatDate } from '../src/lib/dates.js'

test('concurrent last-seat joins and driver withdrawal preserve capacity and passenger registrations', async () => {
  const driver = await createMemberFixture()
  const first = await createMemberFixture()
  const second = await createMemberFixture()
  makeFixtureAdmin(driver)
  const admin = await fixtureClient(driver)
  const a = await fixtureClient(first)
  const b = await fixtureClient(second)
  let id: string | undefined
  try {
    id = await createSession(admin, `Places ${driver.firstName}`)
    for (const member of [driver, first, second]) expect((await admin.rpc('set_session_rsvp', { p_session_id: id, p_member_id: member.memberId, p_rsvp: 'yes' })).error).toBeNull()
    const offer = await admin.rpc('offer_car', { p_session_id: id, p_passenger_capacity: 1, p_meeting_point: 'Parking', p_note: '' })
    expect(offer.error).toBeNull()
    const attempts = await Promise.all([
      a.rpc('join_car', { p_session_id: id, p_car_offer_id: offer.data! }),
      b.rpc('join_car', { p_session_id: id, p_car_offer_id: offer.data! }),
    ])
    expect(attempts.filter(result => !result.error)).toHaveLength(1)
    expect(attempts.filter(result => result.error?.code === '22023')).toHaveLength(1)
    const offers = await admin.rpc('get_car_offers', { p_session_id: id })
    expect(offers.data?.[0]?.occupied).toBe(1)
    const winner = attempts[0].error ? second : first
    const retry = attempts[0].error ? a : b
    const race = await Promise.all([
      admin.rpc('set_session_rsvp', { p_session_id: id, p_rsvp: 'no', p_confirm_withdrawal: true }),
      retry.rpc('join_car', { p_session_id: id, p_car_offer_id: offer.data! }),
    ])
    expect(race[0].error).toBeNull()
    const passengers = await admin.from('car_passengers').select('*').eq('session_id', id)
    expect(passengers.data).toEqual([])
    const people = await admin.rpc('get_session_transport', { p_session_id: id })
    expect(people.data?.find(person => person.member_id === winner.memberId)?.mode).toBe('needs')
    const registered = await admin.from('session_participations').select('rsvp').eq('session_id', id).in('member_id', [first.memberId, second.memberId])
    expect(registered.data?.map(person => person.rsvp)).toEqual(['yes', 'yes'])
    expect((await admin.rpc('get_car_offers', { p_session_id: id })).data).toEqual([])
  } finally {
    if (id) await admin.rpc('delete_session', { p_session_id: id })
    await removeMemberFixture(second); await removeMemberFixture(first); await removeMemberFixture(driver)
  }
})

test('profile defaults only prefill an explicit offer; passenger reassigns after driver removes car', async ({ page, browser }) => {
  const driver = await createMemberFixture()
  const passenger = await createMemberFixture()
  makeFixtureAdmin(driver)
  const context = await browser.newContext()
  const other = await context.newPage()
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined
  let id: string | undefined
  try {
    await openConfirmation(page, await requestMagicLink(page, driver))
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await page.getByRole('button', { name: 'Mon profil', exact: true }).click()
    await page.getByLabel('J’ai habituellement une voiture disponible').check()
    await page.getByLabel('Places passagers habituelles').fill('2')
    await page.getByLabel('Point de rendez-vous habituel').fill('Parking habituel')
    await page.getByRole('button', { name: 'Enregistrer mon profil' }).click()
    await expect(page.getByText('Profil enregistré.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Séances', exact: true }).click()
    await openConfirmation(other, await requestMagicLink(other, passenger))
    await other.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(other.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    client = await fixtureClient(driver)
    id = await createSession(client, `Covoiturage ${driver.firstName}`)
    for (const fixture of [driver, passenger]) expect((await client.rpc('set_session_rsvp', { p_session_id: id, p_member_id: fixture.memberId, p_rsvp: 'yes' })).error).toBeNull()
    expect((await client.rpc('get_car_offers', { p_session_id: id })).data).toEqual([])
    for (const device of [page, other]) {
      await expect(device.getByRole('button', { name: `Voir la séance du ${formatDate(testSessionDate)}` })).toBeVisible({ timeout: 12000 })
      await device.getByRole('button', { name: `Voir la séance du ${formatDate(testSessionDate)}` }).click()
      await device.getByRole('tab', { name: 'Covoiturage', exact: true }).click()
    }
    const driverPanel = page.locator('.carpool')
    const passengerPanel = other.locator('.carpool')
    await driverPanel.getByRole('button', { name: 'Proposer une voiture', exact: true }).click()
    await expect(driverPanel.getByLabel('Places passagers proposées')).toHaveValue('2')
    await expect(driverPanel.getByLabel('Point de rendez-vous', { exact: true })).toHaveValue('Parking habituel')
    await expect(driverPanel.getByText('Aucune voiture proposée pour cette séance.')).toBeVisible()
    await driverPanel.getByRole('button', { name: 'Enregistrer ma voiture' }).click()
    await expect(driverPanel.getByText('Mon trajet : Conducteur')).toBeVisible()
    const join = passengerPanel.getByRole('button', { name: `Rejoindre la voiture de ${driver.firstName} Fictif` })
    await expect(join).toBeVisible({ timeout: 12000 })
    await join.click()
    await expect(passengerPanel.getByText('Mon trajet : Passager')).toBeVisible()
    await expect(driverPanel.getByText('1 place libre / 2 places passagers.')).toBeVisible({ timeout: 12000 })
    await driverPanel.getByRole('button', { name: 'Retirer ma voiture', exact: true }).click()
    await driverPanel.getByRole('button', { name: 'Confirmer le retrait de ma voiture' }).click()
    await expect(passengerPanel.getByText('Mon trajet : Je cherche un trajet')).toBeVisible({ timeout: 12000 })
    const row = await client.from('session_participations').select('rsvp').eq('session_id', id).eq('member_id', passenger.memberId).single()
    expect(row.data?.rsvp).toBe('yes')
    await passengerPanel.getByRole('button', { name: 'Je viens par mes propres moyens' }).click()
    await expect(passengerPanel.getByText('Mon trajet : Par mes propres moyens')).toBeVisible()
    // A member with no profile defaults can still explicitly offer a car.
    await passengerPanel.getByRole('button', { name: 'Proposer une voiture', exact: true }).click()
    await passengerPanel.getByLabel('Places passagers proposées').fill('1')
    await passengerPanel.getByRole('button', { name: 'Enregistrer ma voiture' }).click()
    await expect(passengerPanel.getByText('Mon trajet : Conducteur')).toBeVisible()
    await other.setViewportSize({ width: 390, height: 844 })
    expect(await other.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    await passengerPanel.screenshot({ path: 'test-results/carpool-mobile.png' })
  } finally {
    if (id && client) await client.rpc('delete_session', { p_session_id: id })
    await context.close()
    await removeMemberFixture(passenger); await removeMemberFixture(driver)
  }
})
