import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { createSession, testSessionDate } from './helpers/sessions.js'
import { formatDate } from '../src/lib/dates.js'

test('parallel group publications are versioned and reject a draft after selection republication', async () => {
  const admin = await createMemberFixture(); makeFixtureAdmin(admin)
  const client = await fixtureClient(admin); const other = await fixtureClient(admin)
  let id: string | undefined
  try {
    id = await createSession(client, `Palanquées concurrentes ${admin.firstName}`)
    expect((await client.rpc('set_session_rsvp', { p_session_id: id, p_rsvp: 'yes' })).error).toBeNull()
    expect((await client.rpc('set_draft_selection', { p_session_id: id, p_member_id: admin.memberId, p_state: 'selected' })).error).toBeNull()
    expect((await client.rpc('publish_selection', { p_session_id: id })).error).toBeNull()
    expect((await client.rpc('set_draft_palanquee', { p_session_id: id, p_member_id: admin.memberId, p_group_number: 1 })).error).toBeNull()
    const publications = await Promise.all([client.rpc('publish_palanquees', { p_session_id: id }), other.rpc('publish_palanquees', { p_session_id: id })])
    expect(publications.every(result => !result.error)).toBe(true)
    const versions = await client.from('palanquee_publications').select('version').eq('session_id', id).order('version')
    expect(versions.data?.map(row => row.version)).toEqual([1, 2])
    expect((await client.rpc('set_draft_palanquee', { p_session_id: id, p_member_id: admin.memberId, p_group_number: 2 })).error).toBeNull()
    expect((await other.rpc('publish_selection', { p_session_id: id })).error).toBeNull()
    expect((await client.rpc('publish_palanquees', { p_session_id: id })).error?.code).toBe('22023')
    const latest = await other.rpc('get_current_palanquees', { p_session_id: id })
    expect(latest.data?.[0]?.group_number).toBe(1); expect(latest.data?.[0]?.needs_review).toBe(true)
  } finally {
    if (id) await client.rpc('delete_session', { p_session_id: id })
    await removeMemberFixture(admin)
  }
})

test('published palanquées survive private editing, update live levels and republish across devices', async ({ page, browser }) => {
  const admin = await createMemberFixture(); const member = await createMemberFixture()
  makeFixtureAdmin(admin)
  const context = await browser.newContext(); const other = await context.newPage()
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined; let id: string | undefined
  try {
    for (const [device, fixture] of [[page, admin], [other, member]] as const) {
      await openConfirmation(device, await requestMagicLink(device, fixture))
      await device.getByRole('button', { name: 'Se connecter', exact: true }).click()
      await expect(device.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    }
    client = await fixtureClient(admin); const memberClient = await fixtureClient(member)
    expect((await memberClient.rpc('update_own_profile', { p_first_name: member.firstName, p_last_name: 'Fictif', p_phone: '', p_current_level: 'MF1', p_preparing_level: '', p_has_usual_car: false, p_usual_passenger_seats: 0, p_usual_meeting_point: '' })).error).toBeNull()
    id = await createSession(client, `Palanquées ${admin.firstName}`)
    for (const fixture of [admin, member]) {
      expect((await client.rpc('set_session_rsvp', { p_session_id: id, p_member_id: fixture.memberId, p_rsvp: 'yes' })).error).toBeNull()
      expect((await client.rpc('set_draft_selection', { p_session_id: id, p_member_id: fixture.memberId, p_state: 'selected' })).error).toBeNull()
    }
    expect((await client.rpc('publish_selection', { p_session_id: id })).error).toBeNull()
    for (const device of [page, other]) {
      const button = device.getByRole('button', { name: `Voir la séance du ${formatDate(testSessionDate)}` })
      await expect(button).toBeVisible({ timeout: 12000 }); await button.click()
      await device.getByRole('button', { name: 'Palanquées', exact: true }).click()
    }
    const editor = page.locator('.palanquee-editor'); const published = other.locator('.published-groups')
    await expect(other.locator('.palanquees > .level-summary')).toContainText('Total : 2 · E3 : 1 · Autres / non classés : 1')
    const picker = editor.getByRole('combobox', { name: `Palanquée de ${member.firstName} Fictif`, exact: true })
    await picker.selectOption('1')
    await expect(editor.locator('.draft-summaries')).toContainText('E3 : 1')
    await expect(other.getByRole('heading', { name: 'Palanquées publiées', exact: true })).toBeVisible()
    expect((await memberClient.from('palanquee_draft').select('*').eq('session_id', id)).data).toEqual([])
    expect((await memberClient.rpc('publish_palanquees', { p_session_id: id })).error?.code).toBe('42501')
    await editor.getByRole('button', { name: 'Publier les palanquées', exact: true }).click()
    await editor.getByRole('button', { name: 'Confirmer la publication des palanquées', exact: true }).click()
    await expect(other.getByRole('heading', { name: 'Palanquées publiées · version 1', exact: true })).toBeVisible({ timeout: 12000 })
    await expect(published.getByRole('heading', { name: 'Palanquée 1', exact: true })).toBeVisible()
    await picker.selectOption('2')
    await editor.getByRole('checkbox', { name: `${member.firstName} Fictif est encadrant`, exact: true }).check()
    await expect(published.getByRole('heading', { name: 'Palanquée 1', exact: true })).toBeVisible()
    await expect(published.getByRole('heading', { name: 'Palanquée 2', exact: true })).toHaveCount(0)
    await other.getByRole('button', { name: 'Mon profil', exact: true }).click()
    await other.getByLabel('Niveau actuel', { exact: true }).fill('N2')
    await other.getByLabel('Niveau préparé', { exact: true }).fill('N3')
    await other.getByRole('button', { name: 'Enregistrer mon profil', exact: true }).click()
    await expect(other.getByText('Profil enregistré.', { exact: true })).toBeVisible()
    await other.getByRole('button', { name: 'Séances', exact: true }).click()
    await expect(published.locator('.level-summary')).toContainText('PN3 : 1', { timeout: 12000 })
    await expect(editor.locator('.draft-summaries')).toContainText('PN3 : 1', { timeout: 12000 })
    await editor.getByRole('button', { name: 'Publier les palanquées', exact: true }).click()
    await editor.getByRole('button', { name: 'Confirmer la publication des palanquées', exact: true }).click()
    await expect(other.getByRole('heading', { name: 'Palanquées publiées · version 2', exact: true })).toBeVisible({ timeout: 12000 })
    await expect(published.getByRole('heading', { name: 'Palanquée 2', exact: true })).toBeVisible()
    await expect(published).toContainText('Encadrant')
    await expect(other.locator('.palanquee-editor')).toHaveCount(0)
    await expect(other.getByText('Aucun contrôle des qualifications, des ratios ou des limites de profondeur', { exact: false })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    await page.locator('.palanquees').screenshot({ path: 'test-results/palanquees-mobile.png' })
  } finally {
    if (id && client) await client.rpc('delete_session', { p_session_id: id })
    await context.close(); await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})
