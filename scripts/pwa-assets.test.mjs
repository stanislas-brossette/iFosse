// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
it('includes the browser session when fetching protected same-origin preview manifests', async () => {
  const html = await read('index.html')
  expect(html).toMatch(/<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"\s+crossorigin="use-credentials"\s*\/>/)
})
it('ships a same-origin, stable standalone manifest covering navigation and callback', async () => {
  const m = JSON.parse(await read('public/manifest.webmanifest'))
  expect(m).toMatchObject({ id: '/', name: 'iFosse', short_name: 'iFosse', start_url: '/seances', scope: '/', display: 'standalone', lang: 'fr', prefer_related_applications: false })
  expect(m.start_url.startsWith(m.scope)).toBe(true); expect('/auth/confirm'.startsWith(m.scope)).toBe(true)
  expect(m.icons).toEqual(expect.arrayContaining([expect.objectContaining({ sizes: '192x192', purpose: 'any' }), expect.objectContaining({ sizes: '512x512', purpose: 'any' }), expect.objectContaining({ sizes: '512x512', purpose: 'maskable' })]))
  for (const icon of m.icons) {
    expect(icon.src.startsWith('/icons/')).toBe(true)
    const png = await readFile(new URL(`../public${icon.src}`, import.meta.url))
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes)
  }
})
it.each([['ifosse-dolphin-16.png', 16], ['ifosse-dolphin-32.png', 32], ['ifosse-dolphin-192.png', 192], ['ifosse-dolphin-512.png', 512], ['ifosse-dolphin-maskable-512.png', 512], ['ifosse-dolphin-apple-180.png', 180]])('ships a valid square PNG %s', async (name, size) => {
  const png = await readFile(new URL(`../public/icons/${name}`, import.meta.url))
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  expect(png.readUInt32BE(16)).toBe(size); expect(png.readUInt32BE(20)).toBe(size)
})
it('links browser and Apple icons without introducing a service worker', async () => {
  const html = await read('index.html')
  expect(html).toContain('href="/manifest.webmanifest"')
  expect(html).not.toContain('href="/icons/ifosse.svg"')
  for (const [, path] of html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]+href="([^"]+)"/g)) {
    const png = await readFile(new URL(`../public${path}`, import.meta.url))
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  expect(html).toContain('rel="apple-touch-icon"')
  expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"')
  expect(await read('src/main.tsx')).toContain('installController.start()')
  expect(await read('src/main.tsx')).not.toContain('serviceWorker.register')
})
it('revalidates install metadata/documents while preserving hashed asset caching and build gates', async () => {
  const config = await read('netlify.toml')
  for (const path of ['/', '/index.html', '/seances', '/seances/*', '/profil', '/administration', '/auth/confirm', '/manifest.webmanifest', '/icons/*']) expect(config).toContain(`for = "${path}"\n[headers.values]\nCache-Control = "public, max-age=0, must-revalidate"`)
  expect(config).toContain('Cache-Control = "public, max-age=31536000, immutable"')
  expect(config).toContain('npm run typecheck && npm run lint && npm test && npm run build')
})
