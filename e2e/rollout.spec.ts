import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { formatDate, todayParis } from '../src/lib/dates.js'

test('fictitious organizer completes the session lifecycle through a phone viewport', async ({ page, browser }) => {
  test.setTimeout(90000)
  const admin = await createMemberFixture(); const member = await createMemberFixture()
  makeFixtureAdmin(admin)
  await page.setViewportSize({ width: 390, height: 844 })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const other = await context.newPage()
  const past = new Date(Date.parse(`${todayParis()}T12:00:00Z`) - 2 * 86400000).toISOString().slice(0, 10)
  const title = `Pilote fictif ${admin.firstName}`
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined; let id: string | undefined
  try {
    for (const [device, fixture] of [[page, admin], [other, member]] as const) {
      await openConfirmation(device, await requestMagicLink(device, fixture))
      await device.getByRole('button', { name: 'Se connecter', exact: true }).click()
      await expect(device.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
      await device.getByRole('button', { name: 'Passées', exact: true }).click()
    }
    client = await fixtureClient(admin)
    await page.getByRole('button', { name: 'Nouvelle séance', exact: true }).click()
    await page.getByLabel('Date de la fosse', { exact: true }).fill(past)
    await page.getByLabel('Titre', { exact: true }).fill(title)
    await page.getByLabel('Lieu', { exact: true }).fill('Piscine fictive')
    await page.getByLabel('Nombre de places', { exact: true }).fill('2')
    await page.getByRole('button', { name: 'Enregistrer la séance', exact: true }).click()
    await expect(page.getByRole('heading', { name: `${title} · ${formatDate(past)}`, exact: true })).toBeVisible()
    const stored = await client.from('sessions').select('id').eq('title', title).single()
    expect(stored.error).toBeNull(); id = stored.data!.id
    await expect(other.getByRole('button', { name: new RegExp(`séance du ${formatDate(past)}`) })).toBeVisible({ timeout: 12000 })
    await other.getByRole('button', { name: new RegExp(`séance du ${formatDate(past)}`) }).click()
    for (const device of [page, other]) {
      await device.getByRole('button', { name: 'Oui', exact: true }).click()
      if (device === other) await device.getByRole('button', { name: 'Confirmer Oui malgré l’avertissement', exact: true }).click()
      await expect(device.getByRole('heading', { name: 'Ma réponse : Oui', exact: true })).toBeVisible()
      await device.getByRole('tab', { name: 'Covoiturage', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Proposer une voiture', exact: true }).click()
    await page.getByLabel('Places passagers proposées').fill('1')
    await page.getByLabel('Point de rendez-vous', { exact: true }).fill('Parking fictif')
    await page.getByRole('button', { name: 'Enregistrer ma voiture', exact: true }).click()
    await expect(other.getByRole('button', { name: `Rejoindre la voiture de ${admin.firstName} Fictif` })).toBeVisible({ timeout: 12000 })
    await other.getByRole('button', { name: `Rejoindre la voiture de ${admin.firstName} Fictif` }).click()
    await expect(other.getByText('Mon trajet : Passager', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Gestion', exact: true }).click()
    for (const fixture of [admin, member]) {
      await page.getByRole('combobox', { name: `Sélection de ${fixture.firstName} Fictif`, exact: true }).selectOption('selected')
      await page.getByRole('combobox', { name: `Paiement de ${fixture.firstName} Fictif`, exact: true }).selectOption('paid')
    }
    await page.getByRole('button', { name: 'Publier la sélection', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la publication', exact: true }).click()
    await expect(other.getByText('Ma place : Confirmé', { exact: true })).toBeVisible({ timeout: 12000 })
    await page.getByRole('tab', { name: 'Palanquées', exact: true }).click()
    for (const fixture of [admin, member]) await page.getByRole('combobox', { name: `Palanquée de ${fixture.firstName} Fictif`, exact: true }).selectOption('1')
    await page.getByRole('checkbox', { name: `${admin.firstName} Fictif est encadrant`, exact: true }).check()
    await page.getByRole('button', { name: 'Publier les palanquées', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la publication des palanquées', exact: true }).click()
    await other.getByRole('tab', { name: 'Palanquées', exact: true }).click()
    await expect(other.getByText('Palanquées publiées · version 1 · sélection version 1.', { exact: true })).toBeVisible({ timeout: 12000 })
    await page.getByRole('tab', { name: 'Bilan', exact: true }).click()
    for (const fixture of [admin, member]) await page.getByRole('combobox', { name: `Présence de ${fixture.firstName} Fictif`, exact: true }).selectOption('dived')
    await page.getByRole('button', { name: 'Clôturer le bilan', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la clôture', exact: true }).click()
    const counter = other.getByText('Mes fosses réalisées cette saison', { exact: false })
    await expect(counter).toContainText('1. Seuls', { timeout: 12000 })
    await page.getByRole('button', { name: 'Rouvrir le bilan', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la réouverture', exact: true }).click()
    await page.getByRole('combobox', { name: `Présence de ${member.firstName} Fictif`, exact: true }).selectOption('absent')
    await page.getByRole('button', { name: 'Clôturer le bilan', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la clôture', exact: true }).click()
    await expect(counter).toContainText('0. Seuls', { timeout: 12000 })
    for (const device of [page, other]) expect(await device.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    await page.screenshot({ path: 'test-results/rollout-phone.png', fullPage: true })
  } finally {
    if (!id && client) id = (await client.from('sessions').select('id').eq('title', title).maybeSingle()).data?.id
    if (id && client) await client.rpc('delete_session', { p_session_id: id })
    await context.close(); await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})
