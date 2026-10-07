import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import type { MemberFixture } from './helpers/local-supabase.js'
import { seasonOf, todayParis } from '../src/lib/dates.js'

// Safe screenshots contain only synthetic fixtures, after the callback token
// has been removed. No storage state, traces, videos or auth URLs are exported.
test('realistic club volumes retain desktop/mobile layout, keyboard tabs and role boundaries', async ({ page, browser }) => {
  test.setTimeout(180000)
  const fixtures: MemberFixture[] = []; const sessions: string[] = []
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const memberPage = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  let admin: Awaited<ReturnType<typeof fixtureClient>> | undefined
  const capture = async (device: Page, name: string, fullPage = false, section?: string) => {
    await device.evaluate(() => window.scrollTo(0, 0))
    if (section) await device.locator(section).first().evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 180))
    expect(new URL(device.url()).hash).toBe('')
    expect(await device.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    const tooSmall = await device.locator('button:visible, input:visible:not([type=checkbox]), select:visible').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height < 43).length)
    expect(tooSmall).toBe(0)
    await device.screenshot({ path: `test-results/visual-acceptance/${name}.png`, fullPage })
  }
  const ok = (result: { error: unknown }) => expect(result.error).toBeNull()
  try {
    await mkdir('test-results/visual-acceptance', { recursive: true })
    await page.goto('/'); await expect(page.getByRole('heading', { name: 'Connexion à iFosse' })).toBeVisible()
    await capture(page, 'desktop-login')
    for (let i = 0; i < 50; i++) fixtures.push(await createMemberFixture())
    const names = ['Camille','Alex','Louise','Nicolas','Sophie','Laurent','Élodie','Marc','Nathalie','Julien']
    const levels = ['MF1','N3','N2','N1','E2','N4','N2','N3','N1','N2']
    const statements = fixtures.map((f, i) => {
      if (!/^[0-9a-f-]{36}$/i.test(f.memberId)) throw Error('Invalid fixture')
      f.firstName = names[i % names.length]
      const last = `Fictif-${String(i + 1).padStart(2, '0')}`
      return `update public.members set role='${i === 0 ? 'president' : 'member'}',first_name='${f.firstName}',last_name='${last}',current_level='${levels[i % levels.length]}',preparing_level=${i % 6 === 0 ? "'N3'" : 'null'},caci_expiry_date=${i % 8 === 0 ? 'null' : "'2099-12-31'"} where id='${f.memberId}' and email like 'ifosse-e2e-%@example.test';`
    }).join('\n')
    execFileSync('docker', ['exec','-i','supabase_db_ifosse','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], { input: statements, stdio: ['pipe','pipe','pipe'] })
    for (const [device, fixture] of [[page, fixtures[0]], [memberPage, fixtures[1]]] as const) {
      await openConfirmation(device, await requestMagicLink(device, fixture)); await device.getByRole('button', { name: 'Se connecter', exact: true }).click()
      await expect(device.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    }
    admin = await fixtureClient(fixtures[0])
    const year = seasonOf(todayParis())
    for (const [index, date] of [`${year}-11-04`,`${year}-12-09`,`${year + 1}-01-06`,`${year + 1}-02-03`].entries()) {
      const result = await admin.rpc('save_session', { p_date: date, p_start_time: '21:00', p_end_time: '22:00', p_title: ['Fosse de novembre','Dernière fosse de l’année','Reprise de janvier','Fosse de février'][index], p_venue: 'Piscine de Villeneuve', p_address: 'Accueil du bassin · entrée côté parking', p_notes: 'Rendez-vous quinze minutes avant la séance. Pensez à votre matériel.', p_capacity: 20, p_registration_open: index !== 3, p_school_holiday: index === 3, p_end_time_estimated: false })
      ok(result); sessions.push(result.data!)
    }
    const id = sessions[0]
    for (const [i, f] of fixtures.slice(0, 35).entries()) {
      ok(await admin.rpc('set_session_rsvp', { p_session_id: id, p_member_id: f.memberId, p_rsvp: i < 30 ? 'yes' : 'maybe' }))
      if (i < 20) ok(await admin.rpc('set_draft_selection', { p_session_id: id, p_member_id: f.memberId, p_state: 'selected' }))
      ok(await admin.rpc('set_payment_status', { p_session_id: id, p_member_id: f.memberId, p_status: i % 4 === 0 ? 'unpaid' : i % 5 === 0 ? 'free' : 'paid' }))
    }
    ok(await admin.rpc('publish_selection', { p_session_id: id }))
    const clients = new Map<number, Awaited<ReturnType<typeof fixtureClient>>>()
    const client = async (i: number) => { if (!clients.has(i)) clients.set(i, await fixtureClient(fixtures[i])); return clients.get(i)! }
    const cars: string[] = []
    for (const i of [5, 10, 25]) {
      const result = await (await client(i)).rpc('offer_car', { p_session_id: id, p_passenger_capacity: 4, p_meeting_point: ['Parking du club','Métro porte de Paris','Gare de Lyon'][cars.length], p_departure_time: '19:45', p_note: 'Retour après la séance.' })
      ok(result); cars.push(result.data!)
    }
    for (const [car, passengers] of [[cars[0], [1,2,3]], [cars[1], [6,7,8]], [cars[2], [16,17,18]]] as const) {
      for (const i of passengers) ok(await (await client(i)).rpc('join_car', { p_session_id: id, p_car_offer_id: car }))
    }
    for (let i = 0; i < 20; i++) ok(await admin.rpc('set_draft_palanquee', { p_session_id: id, p_member_id: fixtures[i].memberId, p_group_number: Math.floor(i / 5) + 1, p_is_leader: i % 5 === 0 }))
    ok(await admin.rpc('publish_palanquees', { p_session_id: id }))
    ok(await admin.rpc('set_draft_selection', { p_session_id: id, p_member_id: fixtures[19].memberId, p_state: 'waiting' }))
    await expect(memberPage.locator('.session-card')).toHaveCount(4, { timeout: 12000 })
    await expect(memberPage.getByText('20 confirmés / 20 places', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(memberPage.getByRole('button', { name: 'Administration', exact: true })).toHaveCount(0)
    await expect(memberPage.getByText('Vous pouvez encore répondre Oui', { exact: true })).toHaveCount(0)
    await expect(memberPage.locator('.personal-status')).toHaveCount(4)
    await expect(memberPage.getByText('Prochaine séance', { exact: true })).toHaveCount(1)
    await capture(memberPage, 'desktop-member-sessions')
    await expect(memberPage.getByRole('combobox', { name: 'Saison', exact: true })).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: 'Saison précédente', exact: true })).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: 'Saison suivante', exact: true })).toHaveCount(0)
    await capture(memberPage, 'desktop-personal-calendar-full', true)
    await expect(page.locator('.session-card')).toHaveCount(4, { timeout: 12000 })
    await page.locator('.session-card').filter({ hasText: 'Fosse de novembre' }).getByRole('button').click()
    await page.getByRole('tab', { name: 'Gestion', exact: true }).click()
    await expect(page.locator('.management-row')).toHaveCount(35)
    await expect(page.getByText('Sélection de travail · 19 / 20', { exact: true })).toBeVisible()
    await capture(page, 'desktop-admin-gestion-overview')
    await capture(page, 'desktop-admin-gestion', false, '.selection-group.selected')
    await capture(page, 'desktop-admin-gestion-full', true)
    await page.getByLabel('Rechercher dans la sélection').fill('Fictif-01')
    await expect(page.locator('.management-row')).toHaveCount(1)
    await page.getByLabel('Rechercher dans la sélection').fill('')
    await expect(page.locator('.management-row')).toHaveCount(35)
    await page.getByRole('button', { name: 'Administration', exact: true }).click()
    await expect(page.locator('.directory .member-list > li')).toHaveCount(50)
    await expect(page.locator('.role-management')).toHaveCount(0)
    const directory = page.locator('.directory')
    await expect(directory.locator('.member-actions details')).toHaveCount(49)
    const target = directory.locator('li').filter({ hasText: 'Fictif-50' })
    await target.locator('summary').click()
    await target.getByRole('button', { name: 'Accorder les droits admin', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click()
    await expect(target.getByText('Administrateur', { exact: true })).toBeVisible()
    await target.getByRole('button', { name: 'Retirer les droits admin', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click()
    await expect(target.getByText('Adhérent', { exact: true })).toBeVisible()
    await capture(page, 'desktop-president-roles', false, '.directory .member-list > li:last-child')
    await target.locator('summary').click()
    await capture(page, 'desktop-admin-directory')
    await memberPage.setViewportSize({ width: 390, height: 844 })
    await capture(memberPage, 'phone-member-sessions')
    await expect(memberPage.getByRole('combobox', { name: 'Saison', exact: true })).toHaveCount(0)
    await capture(memberPage, 'phone-personal-calendar-full', true)
    await memberPage.locator('.session-card').filter({ hasText: 'Fosse de novembre' }).getByRole('button').click()
    await expect(memberPage.getByRole('tab', { name: 'Ma participation', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(memberPage.locator('.participation-summary')).toContainText('Votre place est confirmée')
    await capture(memberPage, 'phone-session-detail', true)
    await expect(memberPage.getByRole('button', { name: 'Ouvrir Gestion de la séance' })).toHaveCount(0)
    await expect(memberPage.getByText('Informations et accès').locator('..')).not.toHaveAttribute('open')
    await expect(memberPage.getByRole('button', { name: 'Voir les rubriques suivantes' })).toBeVisible()
    const tabsTop = await memberPage.getByRole('tablist').evaluate(element => element.getBoundingClientRect().top)
    expect(tabsTop).toBeLessThan(460)
    for (const width of [320, 390]) {
      await memberPage.setViewportSize({ width, height: 844 })
      await memberPage.addStyleTag({ content: ':root { font-size: 20px; }' })
      const first = memberPage.getByRole('tab', { name: 'Ma participation', exact: true })
      await first.focus(); await first.press('End')
      const active = memberPage.getByRole('tab', { name: 'Bilan', exact: true })
      await expect(active).toBeFocused()
      expect(await active.evaluate(element => { const r = element.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth })).toBe(true)
      await active.press('Home')
      await capture(memberPage, `phone-${width}-large-text`, true)
      await memberPage.evaluate(() => document.querySelectorAll('style').forEach(style => { if (style.textContent?.includes(':root { font-size: 20px; }')) style.remove() }))
    }
    await memberPage.setViewportSize({ width: 390, height: 844 })
    await memberPage.setViewportSize({ width: 1440, height: 900 })
    await capture(memberPage, 'desktop-personal-participation')
    await memberPage.getByRole('tab', { name: 'Covoiturage', exact: true }).click()
    await expect(memberPage.locator('.booked-trip')).toBeVisible()
    await capture(memberPage, 'desktop-personal-transport', true)
    await memberPage.getByRole('tab', { name: 'Palanquées', exact: true }).click()
    await expect(memberPage.getByRole('region', { name: 'Ma palanquée publiée' })).toContainText('Palanquée 1')
    await capture(memberPage, 'desktop-personal-palanquee', true)
    await memberPage.setViewportSize({ width: 390, height: 844 })
    await memberPage.getByRole('tab', { name: 'Ma participation', exact: true }).click()
    const firstTab = memberPage.getByRole('tab', { name: 'Ma participation', exact: true })
    await firstTab.focus(); await firstTab.press('ArrowRight')
    const participants = memberPage.getByRole('tab', { name: 'Participants', exact: true })
    await expect(participants).toBeFocused(); await expect(participants).toHaveAttribute('aria-selected', 'true')
    expect(await participants.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')
    await expect(memberPage.locator('.participant-selection li')).toHaveCount(35)
    await capture(memberPage, 'phone-participants')
    await memberPage.getByRole('tab', { name: 'Covoiturage', exact: true }).click()
    await expect(memberPage.locator('.car-card')).toHaveCount(2)
    await expect(memberPage.getByRole('region', { name: 'Mon trajet réservé' })).toContainText('Laurent Fictif-06')
    await capture(memberPage, 'phone-carpooling', true)
    await memberPage.getByRole('tab', { name: 'Palanquées', exact: true }).click()
    await expect(memberPage.locator('.published-groups > section')).toHaveCount(4)
    await capture(memberPage, 'phone-palanquees', true)
    await memberPage.getByRole('tab', { name: 'Bilan', exact: true }).click()
    await capture(memberPage, 'phone-bilan')
    await memberPage.getByRole('button', { name: 'Mon profil', exact: true }).click()
    await expect(memberPage.getByLabel('Fin de validité CACI')).toHaveCount(0)
    await capture(memberPage, 'phone-member-profile')
    await page.setViewportSize({ width: 390, height: 844 })
    await capture(page, 'phone-admin-directory')
    await page.getByRole('button', { name: 'Mon profil', exact: true }).click()
    await expect(page.getByLabel('Fin de validité CACI')).toBeVisible()
    await capture(page, 'phone-admin-profile')
    await page.getByRole('button', { name: 'Séances', exact: true }).click()
    await page.getByRole('button', { name: 'Ouvrir Gestion de la séance' }).click()
    await expect(page.getByRole('tab', { name: 'Gestion', exact: true })).toHaveAttribute('aria-selected', 'true')
    await capture(page, 'phone-admin-gestion-overview')
    await capture(page, 'phone-admin-gestion', false, '.selection-group.selected')
    await capture(page, 'phone-admin-gestion-full', true)
    await page.getByRole('button', { name: 'Modifier la séance', exact: true }).click()
    const lastAction = page.getByRole('button', { name: 'Supprimer la séance', exact: true })
    await lastAction.scrollIntoViewIfNeeded()
    const bounds = await lastAction.boundingBox(); const nav = await page.getByRole('navigation', { name: 'Navigation principale' }).boundingBox()
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(nav!.y)
    await capture(page, 'phone-form-end', true)
  } finally {
    if (admin) for (const id of sessions) await admin.rpc('delete_session', { p_session_id: id })
    await context.close()
    if (fixtures.length) makeFixtureAdmin(fixtures[0]) // Disposable test president must leave presidency before erasure.
    for (const fixture of fixtures.reverse()) await removeMemberFixture(fixture)
  }
})
