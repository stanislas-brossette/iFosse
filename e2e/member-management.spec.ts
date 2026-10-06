import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { anonymousClient, createMemberFixture, fixtureClient, makeFixtureAdmin, makeFixturePresident, openConfirmation, releaseFixturePresident, removeMemberFixture, requestMagicLink, serviceClient } from './helpers/local-supabase.js'
import type { MemberFixture } from './helpers/local-supabase.js'

const signIn = async (page: import('@playwright/test').Page, member: MemberFixture) => {
  await openConfirmation(page, await requestMagicLink(page, member))
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mon profil', exact: true })).toBeVisible()
}

test('President creates a passwordless member, manages one directory and reversibly blocks login and existing tokens', async ({ page, browser }) => {
  const president = await createMemberFixture()
  const admin = await createMemberFixture()
  let created: MemberFixture | undefined
  const email = `ifosse-e2e-${randomUUID()}@example.test`
  const context = await browser.newContext()
  const memberPage = await context.newPage()
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    makeFixturePresident(president); makeFixtureAdmin(admin)
    await signIn(page, president)
    const presidentClient = await fixtureClient(president)
    await page.getByRole('button', { name: 'Administration', exact: true }).click()
    const directory = page.locator('.directory')
    await expect(directory.getByRole('heading', { name: 'Gestion des adhérents' })).toHaveCount(1)
    await expect(page.getByText('Droits administrateur', { exact: true })).toHaveCount(0)
    await directory.getByRole('button', { name: 'Ajouter un adhérent', exact: true }).click()
    await directory.getByLabel('Prénom', { exact: true }).fill('Camille')
    await directory.getByLabel('Nom', { exact: true }).fill('Synthétique')
    await page.getByLabel('Email du nouvel adhérent').fill(email.toUpperCase())
    await page.getByRole('button', { name: 'Créer l’adhérent' }).click()
    await expect(directory.getByText('Camille Synthétique', { exact: true })).toBeVisible()
    const profile = await serviceClient().from('members').select('*').eq('email', email).single()
    expect(profile.error).toBeNull(); expect(profile.data?.role).toBe('member'); expect(profile.data?.disabled_at).toBeNull()
    if (!profile.data?.auth_user_id) throw new Error('Created identity not linked.')
    created = { authUserId: profile.data.auth_user_id, memberId: profile.data.id, email, firstName: 'Camille', messageIds: [] }
    // No invitation/password was needed: use the ordinary login page and mail.
    await signIn(memberPage, created)
    const oldClient = await fixtureClient(created)
    const row = directory.getByRole('listitem').filter({ hasText: email })
    await directory.getByLabel('Rechercher un adhérent').fill(email)
    await expect(directory.getByRole('listitem')).toHaveCount(1)
    await row.getByText('Gérer les droits et l’accès de Camille Synthétique', { exact: true }).click()
    await row.getByRole('button', { name: 'Accorder les droits admin' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click()
    await expect(row.getByText('Administrateur', { exact: true })).toBeVisible()
    await row.getByRole('button', { name: 'Retirer les droits admin' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmer', exact: true }).click()
    await expect(row.getByText('Adhérent', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await page.screenshot({ path: 'test-results/visual-acceptance/president-directory-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await row.getByRole('button', { name: 'Désactiver', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/historiques seront conservés/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Annuler', exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Désactiver', exact: true }).click()
    await dialog.getByRole('button', { name: 'Confirmer', exact: true }).click()
    await expect(row).toHaveCount(0)
    expect((await oldClient.from('sessions').select('id')).data).toEqual([])
    expect((await oldClient.from('members').select('id')).data).toEqual([])
    expect((await oldClient.rpc('set_member_active', { p_member_id: president.memberId, p_active: false })).error?.code).toBe('42501')
    const refreshed = await oldClient.auth.refreshSession()
    expect(refreshed.error).toBeTruthy()
    // The real Auth token hook also denies a newly generated magic-link token.
    const link = await serviceClient().auth.admin.generateLink({ type: 'magiclink', email })
    if (!link.data.properties?.hashed_token) throw new Error('No local test token.')
    const denied = await anonymousClient().auth.verifyOtp({ type: 'email', token_hash: link.data.properties.hashed_token })
    expect(denied.error).toBeTruthy(); expect(denied.data.session).toBeNull()
    await expect(memberPage.getByRole('heading', { name: 'Profil indisponible' })).toBeVisible()
    await expect(memberPage.getByRole('button', { name: 'Mon profil', exact: true })).toHaveCount(0)
    await directory.getByLabel('Accès').selectOption('inactive')
    await expect(row.getByText('Inactif', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: 'test-results/visual-acceptance/president-directory-phone.png' })
    await row.getByText('Gérer les droits et l’accès de Camille Synthétique', { exact: true }).click()
    await row.getByRole('button', { name: 'Réactiver', exact: true }).click()
    await dialog.getByRole('button', { name: 'Confirmer', exact: true }).click()
    await directory.getByLabel('Accès').selectOption('active')
    await expect(row).toBeVisible()
    const restored = await fixtureClient(created)
    expect((await restored.from('members').select('id')).data).toEqual([{ id: created.memberId }])
    // Duplicate UI creation cannot alter the previously created identity/profile.
    await directory.getByRole('button', { name: 'Ajouter un adhérent', exact: true }).click()
    await directory.getByLabel('Prénom', { exact: true }).fill('Autre')
    await directory.getByLabel('Nom', { exact: true }).fill('Identité')
    await page.getByLabel('Email du nouvel adhérent').fill(email)
    await page.getByRole('button', { name: 'Créer l’adhérent' }).click()
    await expect(page.getByRole('alert')).toContainText('déjà utilisée')
    expect((await presidentClient.from('members').select('first_name').eq('id', created.memberId).single()).data?.first_name).toBe('Camille')
  } finally {
    await context.close()
    // Recover even if a browser assertion fails after the server committed creation.
    if (!created) {
      const row = await serviceClient().from('members').select('*').eq('email', email).maybeSingle()
      if (row.data?.auth_user_id) created = { authUserId: row.data.auth_user_id, memberId: row.data.id, email, firstName: 'Camille', messageIds: [] }
    }
    if (created) await removeMemberFixture(created)
    releaseFixturePresident(president)
    await removeMemberFixture(admin); await removeMemberFixture(president)
  }
})

test('Admin and member cannot call the Edge creation/lifecycle boundaries; Admin sees only operational directory controls', async ({ page }) => {
  const admin = await createMemberFixture(), member = await createMemberFixture()
  try {
    makeFixtureAdmin(admin)
    await signIn(page, admin)
    for (const fixture of [admin, member]) {
      const client = await fixtureClient(fixture)
      const result = await client.functions.invoke('create-member', { body: { request_id: randomUUID(), first_name: 'Refusé', last_name: 'Fictif', email: `ifosse-e2e-${randomUUID()}@example.test` } })
      expect(result.error).toBeTruthy()
      expect((await client.rpc('set_member_active', { p_member_id: member.memberId, p_active: false })).error?.code).toBe('42501')
      expect((await client.rpc('set_member_active', { p_member_id: member.memberId, p_active: true })).error?.code).toBe('42501')
    }
    await page.getByRole('button', { name: 'Administration', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Gestion des adhérents' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Ajouter un adhérent' })).toHaveCount(0)
    await expect(page.getByText(/Gérer les droits et l’accès/)).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  } finally { await removeMemberFixture(admin); await removeMemberFixture(member) }
})
