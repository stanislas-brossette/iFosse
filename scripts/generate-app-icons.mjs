import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

// Maintainer-only deterministic exports of the owner-approved dolphin image.
// No generation, network access or build/runtime dependency is introduced.
const source = await readFile(new URL('../assets/branding/ifosse-dolphin-source.png', import.meta.url))
const exports = [
  ['ifosse-dolphin-16.png', 16],
  ['ifosse-dolphin-32.png', 32],
  ['ifosse-dolphin-192.png', 192],
  ['ifosse-dolphin-512.png', 512],
  ['ifosse-dolphin-maskable-512.png', 512, true],
  ['ifosse-dolphin-apple-180.png', 180],
]
const browser = await chromium.launch(process.env.GOOGLE_CHROME_PATH ? { executablePath: process.env.GOOGLE_CHROME_PATH } : {})
try {
  const page = await browser.newPage()
  for (const [name, size, maskable = false] of exports) {
    const png = await page.evaluate(async ({ source, size, maskable }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${source}`
      await image.decode()
      const original = document.createElement('canvas')
      original.width = image.width; original.height = image.height
      const context = original.getContext('2d')
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, image.width, image.height).data
      let left = image.width, right = -1, top = image.height, bottom = -1
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          if (pixels[(y * image.width + x) * 4 + 3] < 64) continue
          left = Math.min(left, x); right = Math.max(right, x)
          top = Math.min(top, y); bottom = Math.max(bottom, y)
        }
      }
      if (right < left) throw new Error('The source icon is empty.')
      const width = right - left + 1, height = bottom - top + 1
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const output = canvas.getContext('2d')
      // Opaque white preserves navy contrast in dark tabs and on home screens.
      output.fillStyle = '#ffffff'; output.fillRect(0, 0, size, size)
      // The entire .55-square artwork fits inside the .40-radius safe circle.
      const scale = size * (maskable ? .55 : .88) / Math.max(width, height)
      output.imageSmoothingEnabled = true; output.imageSmoothingQuality = 'high'
      output.drawImage(image, left, top, width, height, (size - width * scale) / 2, (size - height * scale) / 2, width * scale, height * scale)
      return canvas.toDataURL('image/png').split(',')[1]
    }, { source: source.toString('base64'), size, maskable })
    await writeFile(new URL(`../public/icons/${name}`, import.meta.url), Buffer.from(png, 'base64'))
  }
  await page.close()
} finally { await browser.close() }
console.log('Generated browser, Android, maskable and Apple icons from the approved Eiffel Tower and dolphin.')
