import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { chromium, expect, test } from '@playwright/test'
import {
  anonymousClient, appOrigin, browserLaunchOptions, createMemberFixture, expireMagicLink,
  openConfirmation, removeMemberFixture, requestMagicLink, serviceClient,
} from './helpers/local-supabase.js'
import type { MemberFixture } from './helpers/local-supabase.js'

const expiredMessage = 'Ce lien est expiré ou a déjà été utilisé. Demandez un nouveau lien.'
let fixture: MemberFixture

test.beforeEach(async () => { fixture = await createMemberFixture() })
test.afterEach(async () => { if (fixture) await removeMemberFixture(fixture) })

test('a scanner cannot consume the link; a different browser signs in, logs out, and cannot reuse it', async ({ page }) => {
  const link = await requestMagicLink(page, fixture)
  const scannerUrl = new URL(link)
  scannerUrl.hash = ''
  const scanner = await page.request.get(scannerUrl.href)
  expect(scanner.ok()).toBe(true)

  // A new browser process has no PKCE verifier or storage from the requester.
  const otherBrowser = await chromium.launch(browserLaunchOptions)
  try {
    const otherPage = await otherBrowser.newPage()
    await openConfirmation(otherPage, link)
    await expect(otherPage.getByRole('heading', { name: 'Confirmer la connexion' })).toBeVisible()
    await expect(otherPage.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible()
    await expect(otherPage.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0)
    await otherPage.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(otherPage.locator('.auth-toolbar').getByText(`${fixture.firstName} Fictif`, { exact: true })).toBeVisible()
    await otherPage.setViewportSize({ width: 390, height: 844 })
    expect(await otherPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    await otherPage.screenshot({ path: 'test-results/auth-member-mobile.png', fullPage: true })
    await expect(page.getByLabel('Adresse email')).toBeVisible()

    await otherPage.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(otherPage.getByLabel('Adresse email')).toBeVisible()
    const hasStoredSession = await otherPage.evaluate(() => Object.keys(localStorage).some(key => key.endsWith('-auth-token')))
    expect(hasStoredSession).toBe(false)
    const { data, error } = await anonymousClient().from('members').select('id')
    expect(Boolean(error) || !data?.length).toBe(true)

    await openConfirmation(otherPage, link)
    await otherPage.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(otherPage.getByRole('alert')).toHaveText(expiredMessage)
    await expect(otherPage.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0)
  } finally { await otherBrowser.close() }
})

test('a real browser restart retains the refreshable member session', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'ifosse-e2e-profile-'))
  let context = await chromium.launchPersistentContext(profile, browserLaunchOptions)
  try {
    const page = await context.newPage()
    await page.goto(appOrigin)
    const link = await requestMagicLink(page, fixture)
    await openConfirmation(page, link)
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(page.locator('.auth-toolbar').getByText(`${fixture.firstName} Fictif`, { exact: true })).toBeVisible()
    await context.close()

    context = await chromium.launchPersistentContext(profile, browserLaunchOptions)
    const restored = await context.newPage()
    await restored.goto(appOrigin)
    await expect(restored.locator('.auth-toolbar').getByText(`${fixture.firstName} Fictif`, { exact: true })).toBeVisible()
    await restored.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(restored.getByLabel('Adresse email')).toBeVisible()
  } finally {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
})

test('real token refresh preserves unsaved profile and logout clears account state', async ({ page }) => {
  const next = await createMemberFixture()
  try {
    await openConfirmation(page, await requestMagicLink(page, fixture))
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await page.getByRole('button', { name: 'Mon profil', exact: true }).click()
    await page.getByLabel('Téléphone', { exact: true }).fill('0612345678')
    const refreshedId = await page.evaluate(async () => {
      const modulePath = '/src/lib/supabase.ts'
      const { supabase } = await import(modulePath)
      const result = await supabase.auth.refreshSession()
      if (result.error) throw new Error('Local token refresh failed.')
      return result.data.user?.id
    })
    expect(refreshedId).toBe(fixture.authUserId)
    await expect(page.getByRole('heading', { name: 'Mon profil', exact: true })).toBeVisible()
    await expect(page.getByLabel('Téléphone', { exact: true })).toHaveValue('0612345678')
    await page.getByRole('button', { name: 'Enregistrer mon profil', exact: true }).click()
    await expect(page.getByText('Profil enregistré.', { exact: true })).toBeVisible()
    await page.getByLabel('Téléphone', { exact: true }).fill('0699999999')
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Mon profil', exact: true })).toHaveCount(0)
    await openConfirmation(page, await requestMagicLink(page, next))
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Mon profil', exact: true }).click()
    await expect(page.getByLabel('Téléphone', { exact: true })).toHaveValue('')
  } finally { await removeMemberFixture(next) }
})

test('Supabase rejects a genuinely expired magic link', async ({ page }) => {
  const link = await requestMagicLink(page, fixture)
  expireMagicLink(fixture)
  await openConfirmation(page, link)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(expiredMessage)
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0)
})

test('unknown emails stay generic and direct public signup is disabled', async ({ page }) => {
  const email = `ifosse-unknown-${randomUUID()}@example.test`
  await page.goto('/')
  await page.getByLabel('Adresse email').fill(email)
  await page.getByRole('button', { name: 'Recevoir un lien de connexion' }).click()
  await expect(page.getByRole('status')).toContainText('Si cette adresse est connue du club')
  const { error } = await anonymousClient().auth.signUp({ email, password: randomUUID() })
  expect(Boolean(error)).toBe(true)
  const { data: users, error: listError } = await serviceClient().auth.admin.listUsers({ perPage: 1000 })
  if (listError) throw new Error('The local Auth directory could not be inspected.')
  const unexpected = users.users.find(user => user.email === email)
  // Clean up a failed signup-protection regression before reporting it.
  if (unexpected) await serviceClient().auth.admin.deleteUser(unexpected.id)
  expect(Boolean(unexpected)).toBe(false)
})
