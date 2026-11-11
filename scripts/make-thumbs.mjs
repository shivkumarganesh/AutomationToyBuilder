// Regenerates the gallery thumbnails in public/thumbs/ from the live app.
//   1. npm run dev -- --port 5199
//   2. npm install --no-save playwright-core
//   3. node scripts/make-thumbs.mjs [chromium-path]
import { chromium } from 'playwright-core'

const TOYS = {
  simplest: 'Simplest Automaton',
  woodpecker: 'Snail Cam Woodpecker',
  nodspin: 'Nod & Spin Carousel',
  hummingbird: 'Geared Hummingbird',
  carousel: 'Bevel Gear Carousel',
  owl: 'Stepping Owl',
  bird: 'Flapping Bird',
  gull: 'Soaring Gull',
  flyingbird: 'Flying Bird',
  manta: 'Manta Ray',
  dragon: 'Dragon',
  fish: 'Swimming Fish',
}

const browser = await chromium.launch({
  executablePath: process.argv[2] ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
// 320 px sidebar + 52 px header leave an 800 × 600 canvas
const page = await browser.newPage({ viewport: { width: 1120, height: 652 } })
await page.goto('http://localhost:5199/')
await page.addStyleTag({ content: '.crank-controls{display:none!important}' })
for (const [key, name] of Object.entries(TOYS)) {
  await page.locator('.brand').click()
  await page.locator('.toy-card', { has: page.locator('.card-name', { hasText: new RegExp(`^${name}$`) }) }).click()
  await page.waitForTimeout(2500)
  await page.locator('.canvas-pane canvas').screenshot({
    path: `public/thumbs/${key}.jpg`,
    type: 'jpeg',
    quality: 82,
  })
  console.log('shot', key)
}
await browser.close()
