// Regenerates the square, light-studio thumbnails the atomm interface uses
// (public/thumbs/studio-<key>.jpg).
//   1. npm run dev -- --port 5199
//   2. npm install --no-save playwright-core
//   3. node scripts/make-studio-thumbs.mjs [chromium-path]
import { chromium } from 'playwright-core'

const TOYS = {
  flyingbird: 'Flying Bird', manta: 'Manta Ray', dragon: 'Dragon', fish: 'Swimming Fish',
  bird: 'Flapping Bird', simplest: 'Simplest Automaton', woodpecker: 'Snail Cam Woodpecker',
  nodspin: 'Nod & Spin Carousel', hummingbird: 'Geared Hummingbird', carousel: 'Bevel Gear Carousel',
  owl: 'Stepping Owl', gull: 'Soaring Gull',
  reindeer: 'Leaping Reindeer',
  sleighride: 'Sleigh Ride',
  winterfriends: 'Winter Friends',
  seaside: 'Seaside',
}
const browser = await chromium.launch({
  executablePath: process.argv[2] ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
// 64 tool rail + 320 panel + 320 parameters leave a 560 × 560 canvas
const page = await browser.newPage({ viewport: { width: 1264, height: 560 } })
await page.route('**/platform-sdk.js', (r) => r.abort())
await page.goto('http://localhost:5199/atomm.html')
await page.addStyleTag({ content: '.gen-canvas-top,.gen-canvas-bottom{display:none!important}' })
for (const [key, name] of Object.entries(TOYS)) {
  await page.locator('.thumb', { has: page.locator('.thumb-label', { hasText: new RegExp(`^${name}$`) }) }).click()
  await page.waitForTimeout(2600)
  await page.locator('.atomm-stage-3d canvas').screenshot({ path: `public/thumbs/studio-${key}.jpg`, type: 'jpeg', quality: 84 })
  console.log('shot', key)
}
await browser.close()
