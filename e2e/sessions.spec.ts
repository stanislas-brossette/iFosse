import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { formatDate, seasonOf, todayParis } from '../src/lib/dates.js'

test('two accounts share sessions and responses, with advisory CACI and private participant details', async ({ page, browser }) => {
  const admin = await createMemberFixture()
  const member = await createMemberFixture()
  makeFixtureAdmin(admin)
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined
  const context = await browser.newContext()
  const other = await context.newPage()
  const date = `${seasonOf(todayParis()) + 1}-08-01`
  let sessionId: string | undefined
  try {
    await openConfirmation(page, await requestMagicLink(page, admin))
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    client = await fixtureClient(admin)
    const caci = await client.rpc('set_member_caci', { p_member_id: member.memberId, p_expiry_date: `${seasonOf(todayParis()) + 1}-07-31` })
    expect(caci.error).toBeNull()
    await openConfirmation(other, await requestMagicLink(other, member))
    await other.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(other.getByRole('button', { name: 'Nouvelle séance', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Nouvelle séance', exact: true }).click()
    await page.getByLabel('Date de la fosse').fill(date)
    await page.getByLabel('Nombre de places').fill('1')
    await page.getByLabel('Titre', { exact: true }).fill(`Fosse ${admin.firstName}`)
    await page.getByLabel('Lieu', { exact: true }).fill('Piscine de test')
    await page.getByLabel('Vacances scolaires', { exact: true }).check()
    await page.getByRole('button', { name: 'Enregistrer la séance', exact: true }).click()
    await expect(page.getByRole('heading', { name: `Fosse ${admin.firstName} · ${formatDate(date)}` })).toBeVisible()
    const row = await client.from('sessions').select('id').eq('title', `Fosse ${admin.firstName}`).single()
    expect(row.error).toBeNull(); sessionId = row.data?.id
    await expect(other.getByRole('button', { name: `Voir la séance du ${formatDate(date)}` })).toBeVisible({ timeout: 12000 })
    await other.getByRole('button', { name: `Voir la séance du ${formatDate(date)}` }).click()
    await expect(other.getByText('Vacances scolaires', { exact: true })).toBeVisible()
    await expect(other.getByRole('button', { name: 'Modifier la séance', exact: true })).toHaveCount(0)
    await other.getByRole('button', { name: 'Oui', exact: true }).click()
    await expect(other.getByRole('alert')).toContainText('Votre CACI sera expiré')
    await expect(other.getByRole('heading', { name: 'Ma réponse : Sans réponse' })).toBeVisible()
    await other.getByRole('button', { name: 'Confirmer Oui malgré l’avertissement' }).click()
    await expect(other.getByRole('heading', { name: 'Ma réponse : Oui' })).toBeVisible()
    await page.getByRole('button', { name: 'Oui', exact: true }).click()
    await page.getByRole('button', { name: 'Participants', exact: true }).click()
    await expect(page.getByText(`${member.firstName} Fictif ·`, { exact: false })).toBeVisible({ timeout: 12000 })
    const responses = await client.rpc('get_session_responses', { p_session_id: sessionId! })
    expect(responses.data?.filter(row => row.rsvp === 'yes')).toHaveLength(2)
    await other.getByRole('button', { name: 'Peut-être', exact: true }).click()
    await expect(other.getByRole('heading', { name: 'Ma réponse : Peut-être' })).toBeVisible()
    await other.getByRole('button', { name: 'Non', exact: true }).click()
    await expect(other.getByRole('heading', { name: 'Ma réponse : Non' })).toBeVisible()
    await expect(page.getByText(`${member.firstName} Fictif ·`, { exact: false })).toHaveCount(0, { timeout: 12000 })
    await other.getByRole('button', { name: 'Participants', exact: true }).click()
    const detail = other.locator('section').filter({ has: other.getByRole('heading', { name: `Fosse ${admin.firstName} · ${formatDate(date)}` }) })
    await expect(detail.getByText(admin.email, { exact: false })).toHaveCount(0)
    await expect(detail.getByText(member.email, { exact: false })).toHaveCount(0)
    await other.setViewportSize({ width: 390, height: 844 })
    expect(await other.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    await other.screenshot({ path: 'test-results/session-mobile.png', fullPage: true })
    await page.getByRole('button', { name: 'Modifier la séance', exact: true }).click()
    await page.getByLabel('Nombre de places').fill('2')
    await page.getByRole('button', { name: 'Enregistrer la séance', exact: true }).click()
    await other.getByRole('button', { name: 'Ma participation', exact: true }).click()
    await expect(detail.getByText('2 places pour la sélection finale.', { exact: false })).toBeVisible({ timeout: 12000 })
    await page.getByRole('button', { name: 'Modifier la séance', exact: true }).click()
    await page.getByRole('button', { name: 'Supprimer la séance', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la suppression', exact: true }).click()
    await expect(other.getByRole('heading', { name: `Fosse ${admin.firstName} · ${formatDate(date)}` })).toHaveCount(0, { timeout: 12000 })
    await expect(other.getByRole('button', { name: `Voir la séance du ${formatDate(date)}` })).toHaveCount(0)
    sessionId = undefined
  } finally {
    if (client) {
      const remaining = await client.from('sessions').select('id').eq('title', `Fosse ${admin.firstName}`)
      for (const row of remaining.data ?? []) await client.rpc('delete_session', { p_session_id: row.id })
    }
    await context.close()
    await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})
