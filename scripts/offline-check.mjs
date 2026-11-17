// Offline pass & play check (run after `npm run build`; uses the installed Chrome): load once, wait for the service worker to precache,
// kill the server, then play a full game offline (incl. reload mid-game + history).
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

const PORT = 4174, BASE = `http://localhost:${PORT}/`
const OUT = process.argv[2] ?? tmpdir() // where the reveal screenshot goes
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('  ✓ ' + m) }

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
for (let i = 0; i < 60; i++) { try { await fetch(BASE); break } catch { await sleep(500) } }

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: false })
const page = await ctx.newPage()
const failed = []
page.on('requestfailed', (r) => failed.push(r.url()))
await page.addInitScript(() => { try { localStorage.setItem('tg:lang', 'en') } catch {} })

console.log('online: first visit')
await page.goto(BASE)
await page.evaluate(() => navigator.serviceWorker.ready)
await page.reload() // let the SW take control
const cached = await page.evaluate(async () => {
  const names = await caches.keys(); let n = 0
  for (const k of names) n += (await (await caches.open(k)).keys()).length
  return n
})
ok(cached >= 15, `service worker precached ${cached} files`)

console.log('going offline: server killed + browser offline')
process.kill(-server.pid)
await sleep(800)
await ctx.setOffline(true)
let serverGone = false; try { await fetch(BASE) } catch { serverGone = true }
ok(serverGone, 'server is really down')

await page.reload()
await page.locator('.home').waitFor({ timeout: 5000 })
ok(true, 'app loads offline after reload')
const fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Patrick Hand"') })
ok(fontOk, 'handwriting font available offline')

// language switch offline
const btn = (name) => page.getByRole('button', { name, exact: false }).first()

await btn('How to play').click()
await page.getByRole('tab', { name: /Play online/ }).click()
ok(await page.locator('.howto li').count() === 5, 'How to play (both tabs) offline')
await page.getByRole('button', { name: 'Back' }).click()

await btn('Pass & play').click()
const names = ['Anna', 'Ben', 'Cleo']
for (let i = 0; i < 3; i++) await page.locator('.player-row input').nth(i).fill(names[i])
await page.locator('.chip', { hasText: '30s' }).click()
await page.locator('button[aria-label="-"]').click() // 2 pages after the word: draw + guess
await btn('Start game').click()

// word step
for (const n of names) {
  await btn(`I'm ${n}`).click()
  await page.locator('.word-card').first().click()
}
ok(true, 'all three picked a word card (decks offline)')

console.log('reload mid-game (offline)')
await sleep(500)
await page.reload()
await btn('Resume game').click({ timeout: 5000 })
await btn("I'm Anna").waitFor({ timeout: 5000 })
ok(await page.getByText('Turn 4 of 9').count() === 1, 'resumed exactly where we left off (turn 4 of 9)')
ok(true, 'in-progress game resumed after offline reload')

// draw step: exercise the tools
const tools = []
for (const n of names) {
  await btn(`I'm ${n}`).click()
  const canvas = page.locator('canvas.drawing-canvas'); await canvas.waitFor()
  ok(await page.locator('.timer-badge, [class*="timer"]').count() > 0, `${n}: timer shown`)
  const b = await canvas.boundingBox()
  const line = async (y) => { await page.mouse.move(b.x + 60, b.y + y); await page.mouse.down(); for (let x = 60; x < b.width - 60; x += 15) await page.mouse.move(b.x + x, b.y + y + Math.sin(x / 30) * 20); await page.mouse.up() }
  await line(b.height * 0.3); await line(b.height * 0.7)
  for (const label of ['Undo', 'Redo', 'Fill', 'Eraser', 'Pen']) {
    const l = page.locator(`button[aria-label="${label}"]`)
    if (await l.count()) { await l.first().click(); if (label === 'Fill') await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); tools.push(label) }
  }
  await btn('Done').click()
}
ok(true, `three drawings done offline (tools used: ${[...new Set(tools)].join(', ')})`)

// guess step
for (const n of names) {
  await btn(`I'm ${n}`).click()
  const img = page.locator('.guess-turn img')
  ok(await img.evaluate((el) => el.complete && el.naturalWidth > 0), `${n} sees the previous drawing`)
  await page.locator('.guess-turn input').fill('a squiggly thing')
  await btn('Submit').click()
}
await btn('Reveal the books').click()
for (let i = 0; i < 3; i++) await btn('Next page').click()
await page.screenshot({ path: `${OUT}/offline-reveal.png` })
ok(true, 'reveal flips through the book offline')
await btn('Finish').click()
await btn('Past games').click()
ok(await page.locator('.history li, .history-item, li').count() > 0, 'game saved in past games offline')
await page.reload()
await page.locator('.home, .history').first().waitFor()
ok(true, 'still works after another offline reload')
ok(failed.length === 0, 'no failed requests while offline')
await browser.close()
console.log('ALL OFFLINE CHECKS PASSED')
