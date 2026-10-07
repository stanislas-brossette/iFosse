import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { createSession, setCapacity, testSessionDate } from './helpers/sessions.js'
import { formatDate } from '../src/lib/dates.js'

test('concurrent final-place selection and capacity changes cannot overbook', async () => {
  const admin = await createMemberFixture()
  const member = await createMemberFixture()
  makeFixtureAdmin(admin)
  const client = await fixtureClient(admin)
  const secondDevice = await fixtureClient(admin)
  const title = `Concurrence ${admin.firstName}`
  let id: string | undefined
  try {
    id = await createSession(client, title, 1)
    for (const fixture of [admin, member]) expect((await client.rpc('set_session_rsvp', { p_session_id: id, p_member_id: fixture.memberId, p_rsvp: 'yes' })).error).toBeNull()
    const attempts = await Promise.all([
      client.rpc('set_draft_selection', { p_session_id: id, p_member_id: admin.memberId, p_state: 'selected' }),
      secondDevice.rpc('set_draft_selection', { p_session_id: id, p_member_id: member.memberId, p_state: 'selected' }),
    ])
    expect(attempts.filter(result => !result.error)).toHaveLength(1)
    expect(attempts.filter(result => result.error?.code === '22023')).toHaveLength(1)
    const draft = await client.from('selection_draft').select('member_id').eq('session_id', id).eq('state', 'selected')
    expect(draft.data).toHaveLength(1)
    expect((await setCapacity(client, id, title, 2)).error).toBeNull()
    const remaining = draft.data?.[0]?.member_id === admin.memberId ? member.memberId : admin.memberId
    const resizeRace = await Promise.all([
      setCapacity(client, id, title, 1),
      secondDevice.rpc('set_draft_selection', { p_session_id: id, p_member_id: remaining, p_state: 'selected' }),
    ])
    expect(resizeRace.filter(result => !result.error)).toHaveLength(1)
    expect(resizeRace.filter(result => result.error?.code === '22023')).toHaveLength(1)
    const session = await client.from('sessions').select('capacity').eq('id', id).single()
    const finalDraft = await client.from('selection_draft').select('member_id').eq('session_id', id).eq('state', 'selected')
    expect(finalDraft.data!.length).toBeLessThanOrEqual(session.data!.capacity)
    const publications = await Promise.all([
      client.rpc('publish_selection', { p_session_id: id }),
      secondDevice.rpc('publish_selection', { p_session_id: id }),
    ])
    expect(publications.every(result => !result.error)).toBe(true)
    const versions = await client.from('selection_publications').select('version').eq('session_id', id).order('version')
    expect(versions.data?.map(row => row.version)).toEqual([1, 2])
    const current = await client.rpc('get_current_selection', { p_session_id: id })
    expect(current.data!.filter(person => person.state === 'selected').length).toBeLessThanOrEqual(session.data!.capacity)
  } finally {
    if (id) await client.rpc('delete_session', { p_session_id: id })
    await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})

test('member sees the previous selection while admin drafts and then sees explicit republication', async ({ page, browser }) => {
  const admin = await createMemberFixture()
  const member = await createMemberFixture()
  makeFixtureAdmin(admin)
  const context = await browser.newContext()
  const other = await context.newPage()
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined
  let id: string | undefined
  try {
    await openConfirmation(page, await requestMagicLink(page, admin))
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    await openConfirmation(other, await requestMagicLink(other, member))
    await other.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(other.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    client = await fixtureClient(admin)
    const memberClient = await fixtureClient(member)
    id = await createSession(client, `Publication ${admin.firstName}`)
    expect((await client.rpc('set_session_rsvp', { p_session_id: id, p_member_id: member.memberId, p_rsvp: 'yes' })).error).toBeNull()
    await expect(page.getByRole('button', { name: new RegExp(`séance du ${formatDate(testSessionDate)}`) })).toBeVisible({ timeout: 12000 })
    await page.getByRole('button', { name: new RegExp(`séance du ${formatDate(testSessionDate)}`) }).click()
    await expect(other.getByRole('button', { name: new RegExp(`séance du ${formatDate(testSessionDate)}`) })).toBeVisible({ timeout: 12000 })
    await other.getByRole('button', { name: new RegExp(`séance du ${formatDate(testSessionDate)}`) }).click()
    await other.getByRole('tab', { name: 'Ma participation', exact: true }).click()
    const published = other.locator('.participation-summary')
    await expect(published.getByText('Ma place : En attente de publication')).toBeVisible()
    await page.getByRole('tab', { name: 'Gestion', exact: true }).click()
    const picker = page.getByRole('combobox', { name: `Sélection de ${member.firstName} Fictif`, exact: true })
    await picker.selectOption('selected')
    await expect(page.getByText('Brouillon privé en cours.', { exact: false })).toBeVisible()
    await expect(published.getByText('Ma place : En attente de publication')).toBeVisible()
    await expect(other.getByRole('tab', { name: 'Gestion', exact: true })).toHaveCount(0)
    const privateDraft = await memberClient.from('selection_draft').select('*').eq('session_id', id)
    expect(privateDraft.error).toBeNull(); expect(privateDraft.data).toEqual([])
    await page.getByRole('button', { name: 'Publier la sélection', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la publication', exact: true }).click()
    await expect(published.getByText('Ma place : Confirmé', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(published).toContainText('Votre place est confirmée dans la sélection publiée.')
    await picker.selectOption('declined')
    await expect(page.getByText('Brouillon privé en cours.', { exact: false })).toBeVisible()
    await expect(published.getByText('Ma place : Confirmé', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Publier la sélection', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la publication', exact: true }).click()
    await expect(published.getByText('Ma place : Non retenu', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(published).toContainText('Vous n’êtes pas retenu dans la sélection publiée.')
    const first = await client.from('selection_publications').select('id').eq('session_id', id).eq('version', 1).single()
    const snapshot = await client.from('selection_publication_members').select('state').eq('publication_id', first.data!.id).eq('member_id', member.memberId).single()
    expect(snapshot.data?.state).toBe('selected')
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    await page.screenshot({ path: 'test-results/selection-admin-mobile.png', fullPage: true })
  } finally {
    if (id && client) await client.rpc('delete_session', { p_session_id: id })
    await context.close()
    await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})
