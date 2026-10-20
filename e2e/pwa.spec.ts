import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { appOrigin, createMemberFixture, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'

async function fakeInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const target = window as unknown as { installPromptCalls: number }
    target.installPromptCalls = 0
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => { target.installPromptCalls++ },
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    }))
  })
}
async function safeScreenshot(page: Page, name: string) {
  expect(new URL(page.url()).hash).toBe('')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await page.screenshot({ path: `test-results/visual-acceptance/pwa-${name}.png` })
}

test('manifest fetch includes the existing preview protection cookie', async ({ page, context }) => {
  await context.addCookies([{ name: 'synthetic-preview-access', value: 'allowed', url: appOrigin, httpOnly: true }])
  let authenticated = false
  await page.route('**/manifest.webmanifest', async route => {
    const headers = await route.request().allHeaders()
    authenticated = headers.cookie?.includes('synthetic-preview-access=allowed') ?? false
    if (!authenticated) { await route.fulfill({ status: 401, contentType: 'text/html', body: 'Preview login required' }); return }
    await route.continue()
  })
  await page.goto('/')
  const cdp = await context.newCDPSession(page)
  const result = await cdp.send('Page.getAppManifest')
  expect(authenticated).toBe(true)
  expect(result.errors).toEqual([])
  expect(JSON.parse(result.data!)).toMatchObject({ name: 'iFosse', start_url: '/seances' })
  await cdp.detach()
})

test('public manifest/icons cover install and callback routes without service-worker or data caching', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toMatch(/json|manifest/)
  const manifest = await response.json()
  expect(manifest).toMatchObject({ id: '/', start_url: '/seances', scope: '/', display: 'standalone', name: 'iFosse' })
  for (const icon of manifest.icons) {
    const result = await request.get(icon.src)
    expect(result.ok()).toBe(true); expect(result.headers()['content-type']).toContain('image/png')
  }
  expect((await request.get('/icons/ifosse-dolphin-apple-180.png')).ok()).toBe(true)
  for (const path of ['/seances','/profil','/auth/confirm']) expect((await request.get(path)).ok()).toBe(true)
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
  expect(await page.evaluate(async () => await caches.keys())).toEqual([])
})

test('a prompt captured during login stays available in Profile, supports keyboard and hides after install', async ({ page }) => {
  const member = await createMemberFixture()
  try {
    await openConfirmation(page, await requestMagicLink(page, member))
    await fakeInstallPrompt(page) // Before the authenticated Profile exists.
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    await page.getByRole('button', { name: 'Mon profil', exact: true }).click()
    const install = page.getByRole('button', { name: 'Installer iFosse', exact: true })
    await expect(install).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 900 })
    await install.scrollIntoViewIfNeeded(); await safeScreenshot(page, 'install-desktop')
    await page.setViewportSize({ width: 390, height: 844 })
    await install.scrollIntoViewIfNeeded(); await safeScreenshot(page, 'install-phone')
    expect(await install.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    await install.focus(); await install.press('Enter')
    await expect(page.getByText('Installation demandée.', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { installPromptCalls: number }).installPromptCalls)).toBe(1)
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
    await expect(page.getByRole('heading', { name: 'iFosse sur mon téléphone' })).toHaveCount(0)
    // A normal reload retains the online session and does not use a worker cache.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Mon profil', exact: true })).toBeVisible()
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
    expect(await page.evaluate(async () => await caches.keys())).toEqual([])
  } finally { await removeMemberFixture(member) }
})

test('Safari guidance is compact at 390px and disappears in an installed context', async ({ browser }) => {
  const member = await createMemberFixture()
  const context = await browser.newContext({ baseURL:appOrigin, viewport: { width:390,height:844 }, userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' })
  try {
    const page=await context.newPage()
    await openConfirmation(page,await requestMagicLink(page,member));await page.getByRole('button',{name:'Se connecter',exact:true}).click()
    await page.getByRole('button',{name:'Mon profil',exact:true}).click()
    const guidance=page.getByText('Partager → Sur l’écran d’accueil',{exact:true})
    await expect(guidance).toBeVisible();await expect(page.getByRole('button',{name:'Installer iFosse'})).toHaveCount(0)
    await guidance.scrollIntoViewIfNeeded();await safeScreenshot(page,'ios-guidance-phone')
    await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}))
    await page.reload();await expect(page.getByRole('heading',{name:'Mon profil',exact:true})).toBeVisible()
    await expect(page.getByRole('heading',{name:'iFosse sur mon téléphone'})).toHaveCount(0)
  } finally { await context.close();await removeMemberFixture(member) }
})

test('an installed context completes its own magic link without sharing a browser session or consuming a scanner GET', async ({ browser }) => {
  const member=await createMemberFixture()
  const installed=await browser.newContext({baseURL:appOrigin,viewport:{width:390,height:844}})
  const browserContext=await browser.newContext({baseURL:appOrigin})
  await installed.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}))
  try {
    const app=await installed.newPage();const scanner=await browserContext.newPage()
    let verifications=0
    app.on('request',request=>{if(request.method()==='POST' && new URL(request.url()).pathname==='/auth/v1/verify')verifications++})
    const link=await requestMagicLink(app,member)
    await openConfirmation(scanner,link)
    await expect(scanner.getByRole('heading',{name:'Confirmer la connexion'})).toBeVisible()
    // Only the fake inbox screen is captured; never a callback, link or token.
    await app.getByText('Le lien ouvre mon navigateur au lieu d’iFosse',{exact:true}).click()
    await app.locator('.installed-login-help').scrollIntoViewIfNeeded();await safeScreenshot(app,'standalone-login-phone')
    const field=app.getByLabel('Lien de connexion reçu par email')
    await expect(field).toHaveAttribute('type','password')
    try { await field.fill(link) } catch { throw new Error('Could not paste the fictitious link into the installed test context.') }
    await field.press('Enter')
    await expect(app.getByRole('heading',{name:'Confirmer la connexion'})).toBeVisible()
    expect(new URL(app.url()).hash).toBe('');expect(verifications).toBe(0)
    await app.getByRole('button',{name:'Se connecter',exact:true}).focus();await app.keyboard.press('Enter')
    await expect(app.getByRole('button',{name:'Mon profil',exact:true})).toBeVisible();expect(verifications).toBe(1)
    await app.getByRole('button',{name:'Mon profil',exact:true}).click();await safeScreenshot(app,'standalone-profile-phone')
    await expect(app.getByRole('heading',{name:'iFosse sur mon téléphone'})).toHaveCount(0)
    const reopened=await installed.newPage();await reopened.goto('/seances')
    await expect(reopened.getByRole('button',{name:'Mon profil',exact:true})).toBeVisible()
    await scanner.getByRole('button',{name:'Se connecter',exact:true}).click()
    await expect(scanner.getByRole('alert')).toContainText('expiré ou a déjà été utilisé')
    expect(await app.evaluate(async()=>await caches.keys())).toEqual([])
  } finally {await installed.close();await browserContext.close();await removeMemberFixture(member)}
})
