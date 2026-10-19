import { expect, test } from '@playwright/test'

// Exercise the real decorative component and stylesheet without an Auth or DB
// fixture, and force rarity only in the browser test (no product debug switch).
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`rare bubbles preserve navigation and layout at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.clock.install()
    await page.route('**/src/main.tsx', async route => {
      const response = await route.fetch()
      const source = await response.text()
      expect(source).toMatch(/import App from "\/src\/App.tsx"/)
      await route.fulfill({ response, body: source.replace(/import App from "\/src\/App.tsx"/, 'import { SurpriseBubbles as App } from "/src/components/SurpriseBubbles.tsx"') })
    })
    await page.goto('/')
    await page.evaluate(() => {
      document.getElementById('root')!.insertAdjacentHTML('afterend', '<main class="shell"><section class="card"><p class="eyebrow">APSAP · Plongée</p><h1>Les séances</h1><p>Les prochains rendez-vous du club.</p><div style="padding-top:100px"><button data-bubbles id="browse">Consulter les séances</button> <button id="save">Enregistrer</button></div></section></main>')
      const button = document.getElementById('browse')!
      button.addEventListener('click', () => { button.textContent = 'Séances consultées' })
      let calls = 0
      let seed = 12345
      Math.random = () => {
        if (calls++ < 2) return calls === 1 ? 0 : .7
        seed = seed * 16807 % 2147483647
        return seed / 2147483647
      }
    })
    const browse = page.locator('#browse')
    await browse.click()
    await expect(page.locator('.surprise-bubble')).toHaveCount(0)
    await page.clock.fastForward(5_000)
    await page.locator('#save').click()
    await expect(page.locator('.surprise-bubble')).toHaveCount(0)
    await browse.click()
    await expect(browse).toHaveText('Séances consultées')
    await expect(page.locator('.surprise-bubble')).toHaveCount(5)
    const visual = await page.evaluate(() => {
      const layer = document.querySelector('.surprise-bubbles')!
      for (const animation of layer.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 350 }
      const style = getComputedStyle(layer)
      const bubble = getComputedStyle(document.querySelector('.surprise-bubble')!)
      return { pointerEvents: style.pointerEvents, position: style.position, opacity: Number(bubble.opacity), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    expect(visual).toMatchObject({ pointerEvents: 'none', position: 'fixed', overflow: false })
    expect(visual.opacity).toBeGreaterThan(0)
    await page.screenshot({ path: `test-results/visual-acceptance/bubbles-${viewport.width}.png` })
    // The layer must not intercept another real click while visible.
    await browse.click()
    await page.clock.fastForward(1400)
    await expect(page.locator('.surprise-bubble')).toHaveCount(0)
    await browse.click()
    await expect(page.locator('.surprise-bubble')).toHaveCount(0)
    await expect(browse).toBeFocused()
    // Reduced motion suppresses the effect even without a cooldown.
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await page.clock.fastForward(5_000)
    await page.evaluate(() => { Math.random = () => 0; document.body.insertAdjacentHTML('beforeend', '<button data-bubbles>Consulter</button>') })
    await page.getByRole('button', { name: 'Consulter', exact: true }).press('Enter')
    await expect(page.locator('.surprise-bubble')).toHaveCount(0)
  })
}
