import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { createSession, testSessionDate } from './helpers/sessions.js'
import { formatDate } from '../src/lib/dates.js'

test('administrator changes private payment and live readiness while member only reads own payment', async ({ page, browser }) => {
  const admin = await createMemberFixture()
  const member = await createMemberFixture()
  makeFixtureAdmin(admin)
  const context = await browser.newContext()
  const other = await context.newPage()
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined
  let id: string | undefined
  try {
    for (const [device, fixture] of [[page, admin], [other, member]] as const) {
      await openConfirmation(device, await requestMagicLink(device, fixture))
      await device.getByRole('button', { name: 'Se connecter', exact: true }).click()
      await expect(device.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    }
    client = await fixtureClient(admin)
    const memberClient = await fixtureClient(member)
    id = await createSession(client, `Paiement ${admin.firstName}`)
    expect((await client.rpc('set_session_rsvp', { p_session_id: id, p_member_id: member.memberId, p_rsvp: 'yes' })).error).toBeNull()
    expect((await client.rpc('set_member_caci', { p_member_id: member.memberId, p_expiry_date: testSessionDate })).error).toBeNull()
    expect((await memberClient.rpc('set_own_transport', { p_session_id: id, p_mode: 'own' })).error).toBeNull()
    for (const device of [page, other]) {
      const button = device.getByRole('button', { name: new RegExp(`séance du ${formatDate(testSessionDate)}`) })
      await expect(button).toBeVisible({ timeout: 12000 }); await button.click()
    }
    await expect(other.getByText('Mon paiement : À régler')).toBeVisible()
    await page.getByRole('tab', { name: 'Gestion', exact: true }).click()
    const selection = page.getByRole('combobox', { name: `Sélection de ${member.firstName} Fictif`, exact: true })
    await selection.selectOption('selected')
    await expect(selection).toHaveValue('selected')
    await expect(selection).toBeEnabled()
    await page.getByText(`Détails et paiement de ${member.firstName} Fictif`, { exact: true }).click()
    const summary = page.locator('.readiness').filter({ has: page.getByRole('combobox', { name: `Paiement de ${member.firstName} Fictif`, exact: true }) })
    await expect(summary.getByText('3/4 points prêts', { exact: true })).toBeVisible()
    const payment = summary.getByRole('combobox', { name: `Paiement de ${member.firstName} Fictif`, exact: true })
    await payment.selectOption('paid')
    await expect(summary.getByText('Brouillon prêt à publier', { exact: true })).toBeVisible()
    await expect(page.getByText('Base du récapitulatif : brouillon privé, à publier. CACI, trajet et conducteur utilisent cette même base.', { exact: true })).toBeVisible()
    await expect(other.getByText('Mon paiement : Payé')).toBeVisible({ timeout: 12000 })
    await payment.selectOption('free')
    await expect(other.getByText('Mon paiement : Gratuit')).toBeVisible({ timeout: 12000 })
    expect((await memberClient.rpc('set_payment_status', { p_session_id: id, p_member_id: member.memberId, p_status: 'paid' })).error?.code).toBe('42501')
    expect((await memberClient.rpc('get_admin_readiness', { p_session_id: id })).error?.code).toBe('42501')
    expect((await memberClient.from('session_participations').select('payment_status').eq('member_id', admin.memberId)).data).toEqual([])
    await expect(other.getByRole('combobox', { name: /Paiement de/ })).toHaveCount(0)
    await expect(page.getByText('Préparation opérationnelle uniquement', { exact: false })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    expect((await client.rpc('set_payment_status', {p_session_id:id,p_member_id:member.memberId,p_status:'unpaid'})).error).toBeNull()
    await expect(payment).toHaveValue('unpaid', {timeout:12000})
    await page.getByLabel('À régler',{exact:true}).check()
    await expect(summary).toBeVisible({timeout:12000})
    await payment.selectOption('paid')
    await expect(page.locator('.management-row')).toHaveCount(0)
    await expect(page.getByText(`${member.firstName} Fictif · Paiement enregistré.`,{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Réinitialiser la sélection affichée'}).click()
    await page.getByText(`Détails et paiement de ${member.firstName} Fictif`,{exact:true}).click()
    await summary.screenshot({ path: 'test-results/payment-readiness-mobile.png' })
  } finally {
    if (id && client) await client.rpc('delete_session', { p_session_id: id })
    await context.close(); await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})
