import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
// Maintainer-only asset regeneration, not a build/runtime dependency.
// Render the existing vector branding without changing its geometry.
const svg = await readFile(new URL('../public/icons/ifosse.svg', import.meta.url), 'utf8')
const browser = await chromium.launch(process.env.GOOGLE_CHROME_PATH ? { executablePath: process.env.GOOGLE_CHROME_PATH } : {})
try {
  for (const [name, size] of [['ifosse-192.png',192],['ifosse-512.png',512],['ifosse-maskable-512.png',512],['apple-touch-icon.png',180]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`)
    await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname })
    await page.close()
  }
} finally { await browser.close() }
console.log('Generated Android, maskable and Apple icons from the existing iFosse waves.')
