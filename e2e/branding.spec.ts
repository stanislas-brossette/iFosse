import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Real App/AuthGate/layout with a synthetic service boundary: no account,
// database, token or email is created for these visual checks.
async function syntheticService(page: Page, signedIn: boolean) {
  await page.route('**/src/lib/supabase.ts', async route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      const member = { id:'11111111-1111-4111-8111-111111111111', auth_user_id:'11111111-1111-4111-8111-111111111111', first_name:'Camille', last_name:'Exemple', role:'member', disabled_at:null, email:'camille@example.test', phone:'', current_level:'N2', preparing_level:null, caci_expiry_date:'2027-08-31', has_usual_car:false, usual_passenger_seats:3, usual_meeting_point:'' };
      const query = { select(){return this}, eq(){return this}, order(){return this}, maybeSingle:async()=>({data:member,error:null}), then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)} };
      export const supabase = {
        auth:{getSession:async()=>({data:{session:${signedIn ? '{user:{id:member.auth_user_id}}' : 'null'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
        from:()=>query,
        rpc:async name=>({data:name==='get_my_notifications'?{enabled:true,unread_count:0,items:[],has_more:false}:[],error:null})
      };
    `,
  }))
}

for (const width of [1440, 390, 320]) {
  test(`club branding stays legible on login and in navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await syntheticService(page, false)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Connexion à iFosse' })).toBeVisible()
    const logo = page.locator('.app-brand .club-logo')
    await expect(logo).toBeVisible()
    expect(await logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 1240 && image.naturalHeight === 1336)).toBe(true)
    await expect(page.getByRole('textbox', { name: 'Adresse email' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    if (width !== 320) await page.screenshot({ path: `test-results/visual-acceptance/branding-login-${width}.png` })
    await page.unroute('**/src/lib/supabase.ts')
    await syntheticService(page, true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
    const navigationLogo = page.locator(width > 760 ? '.sidebar > .brand .club-logo' : '.mobile-club-logo')
    await expect(navigationLogo).toBeVisible()
    const proportions = await navigationLogo.evaluate(image => { const box = image.getBoundingClientRect(); return box.width / box.height })
    expect(proportions).toBeCloseTo(1240 / 1336, 2)
    await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    if (width !== 320) await page.screenshot({ path: `test-results/visual-acceptance/branding-navigation-${width}.png` })
    await page.getByRole('button', { name: 'Mon profil', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Mon profil', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('browser and installed icons decode at advertised sizes and keep maskable artwork safe', async ({ page }) => {
  await syntheticService(page, false)
  await page.goto('/')
  const icons = await page.evaluate(async () => {
    const manifest = await (await fetch('/manifest.webmanifest')).json()
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')]
    const entries = [...manifest.icons, ...links.map(link => ({ src: link.href, sizes: link.sizes.value, purpose: 'browser' }))]
    return Promise.all(entries.map(async ({ src, sizes, purpose }) => {
      const image = new Image(); image.src = src; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, image.width, image.height).data
      let outside = 0, colored = 0, transparent = 0
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const offset = (y * image.width + x) * 4
        if (pixels[offset + 3] !== 255) transparent++
        if (Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 245) {
          colored++
          if (Math.hypot(x + .5 - image.width / 2, y + .5 - image.height / 2) > image.width * .4) outside++
        }
      }
      return { sizes, actual: `${image.width}x${image.height}`, purpose, outside, colored, transparent }
    }))
  })
  expect(icons).toHaveLength(6)
  for (const icon of icons) {
    expect(icon.actual).toBe(icon.sizes)
    expect(icon.colored).toBeGreaterThan(0)
    expect(icon.transparent).toBe(0)
    if (icon.purpose === 'maskable') expect(icon.outside).toBe(0)
  }
})
