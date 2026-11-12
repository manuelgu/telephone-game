// Records scripted playthroughs of the app as iPad-sized screencasts.
// Usage: node scripts/video/record.mjs <outDir>   (needs `vite preview` running, BASE env to override)
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { DRAWINGS, GUESSES } from './drawings.mjs'

const BASE = process.env.BASE ?? 'http://localhost:4173'
const OUT = path.resolve(process.argv[2] ?? 'video-out')
const ONLY = process.env.ONLY // 'pass' | 'online'
const VIEW = { width: 1180, height: 820 } // iPad Air landscape (CSS px)
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const seedScript = (seed) =>
  `(()=>{let a=${seed};Math.random=()=>{a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}})();`

// Touch ripple so taps are visible in the video (not on the drawing canvas).
const TAP_SCRIPT = `
try { localStorage.setItem('tg:lang','en') } catch {}
addEventListener('pointerdown', (e) => {
  if (e.target && e.target.closest && e.target.closest('canvas')) return
  const d = document.createElement('div'); d.className = '__tap'
  d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'
  document.documentElement.appendChild(d); setTimeout(() => d.remove(), 700)
}, true)
document.addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style')
  s.textContent = '.__tap{position:fixed;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:rgba(59,130,196,.25);border:3px solid rgba(59,130,196,.8);pointer-events:none;z-index:99999;animation:__tap .65s ease-out forwards}@keyframes __tap{from{transform:scale(.35);opacity:1}to{transform:scale(1.2);opacity:0}}'
  document.head.appendChild(s)
})`

class Recorder {
  constructor(page, name) {
    this.page = page
    this.name = name
    this.dir = path.join(OUT, name)
    fs.rmSync(this.dir, { recursive: true, force: true })
    fs.mkdirSync(this.dir, { recursive: true })
    this.frames = []
    this.markers = []
  }
  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page)
    this.cdp.on('Page.screencastFrame', (f) => {
      const file = `f${String(this.frames.length).padStart(6, '0')}.jpg`
      fs.writeFileSync(path.join(this.dir, file), Buffer.from(f.data, 'base64'))
      this.frames.push({ file, ts: f.metadata.timestamp })
      this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
    })
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 2360, maxHeight: 1640 })
    this.t0 = Date.now() / 1000
  }
  mark(name) {
    this.markers.push({ name, ts: Date.now() / 1000 })
    console.log(`[${this.name}] ${(Date.now() / 1000 - this.t0).toFixed(1)}s ${name}`)
  }
  async stop() {
    await sleep(600)
    await this.cdp.send('Page.stopScreencast').catch(() => {})
    const end = Date.now() / 1000
    fs.writeFileSync(
      path.join(this.dir, 'recording.json'),
      JSON.stringify({ t0: this.t0, end, frames: this.frames, markers: this.markers }, null, 1),
    )
  }
}

// ---------- interaction helpers ----------
const button = (page, text) => page.locator('button', { hasText: text }).first()

async function tap(page, locator, { before = 350, after = 650 } = {}) {
  await locator.waitFor({ state: 'visible', timeout: 15000 })
  await sleep(before)
  await locator.click()
  await sleep(after)
}

async function type(page, locator, text, delay = 85) {
  await locator.click()
  await locator.pressSequentially(text, { delay })
}

/** Pen stroke via CDP so the app receives pointerType "pen" with real pressure (like Apple Pencil). */
async function penStroke(cdp, box, pts, { stepPx = 5, pause = 5 } = {}) {
  const clamp = (v) => Math.min(0.997, Math.max(0.003, v)) // presses outside the canvas would miss it
  const abs = pts.map(([x, y]) => [box.x + clamp(x) * box.width, box.y + clamp(y) * box.height])
  const dense = [abs[0]]
  for (let i = 1; i < abs.length; i++) {
    const [x0, y0] = abs[i - 1]
    const [x1, y1] = abs[i]
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / stepPx))
    for (let s = 1; s <= steps; s++) dense.push([x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps])
  }
  const n = dense.length
  const force = (i) => 0.35 + 0.5 * Math.sin((Math.PI * i) / Math.max(1, n - 1))
  const ev = (type, [x, y], i, extra = {}) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y, pointerType: 'pen', force: force(i), ...extra })
  await ev('mouseMoved', dense[0], 0)
  await ev('mousePressed', dense[0], 0, { button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i < n; i++) {
    await ev('mouseMoved', dense[i], i, { button: 'left', buttons: 1 })
    if (pause) await sleep(pause)
  }
  await ev('mouseReleased', dense[n - 1], n - 1, { button: 'left', buttons: 0, clickCount: 1 })
}

async function penTap(cdp, box, [x, y]) {
  await penStroke(cdp, box, [[x, y]], { pause: 0 })
}

/** Draw a scripted sketch for `word` using the real toolbar. fast=true for off-screen bots. */
async function drawWord(page, cdp, word, { fast = false } = {}) {
  const ops = DRAWINGS[word] ?? DRAWINGS.smiley
  const canvas = page.locator('canvas.drawing-canvas')
  await canvas.waitFor()
  const box = await canvas.boundingBox()
  const pause = fast ? 0 : 6
  const between = fast ? 30 : 220
  let tool = 'pen'
  const setTool = async (name) => {
    if (tool === name) return
    tool = name
    await page.locator(`button[aria-label="${name === 'pen' ? 'Pen' : 'Fill'}"]`).click()
    await sleep(between)
  }
  const setColor = async (c) => {
    await page.locator(`button[aria-label="${c}"]`).click()
    await sleep(between)
  }
  for (const op of ops) {
    if (op.size) {
      await page.locator(`button[aria-label="${op.size}"]`).click()
      await sleep(between)
    }
    if (op.stroke) {
      await setTool('pen')
      await penStroke(cdp, box, op.stroke, { pause })
      await sleep(fast ? 10 : 120)
    } else if (op.fill) {
      await setTool('fill')
      await setColor(op.color)
      await penTap(cdp, box, op.fill)
      await sleep(fast ? 30 : 350)
    } else if (op.color) {
      await setTool('pen')
      await setColor(op.color)
    }
  }
}

/** Tap the expected card, else any card we have a drawing for, else type the word. Returns the word used. */
async function pickWord(page, word, exclude = []) {
  await page.locator('.word-card').first().waitFor()
  const cards = (await page.locator('.word-card').allTextContents()).map((c) => c.trim())
  const choice = cards.includes(word)
    ? word
    : cards.find((c) => DRAWINGS[c] && !exclude.includes(c))
  console.log(`  cards: ${cards.join(' | ')} -> ${choice ?? `(typing "${word}")`}`)
  await sleep(1400)
  if (choice) {
    await tap(page, page.locator('.word-card', { hasText: new RegExp(`^${choice}$`) }), { before: 200 })
    return choice
  }
  await type(page, page.locator('.own-word input'), word)
  await tap(page, button(page, 'Use it'))
  return word
}

async function guess(page, text, { slow = true } = {}) {
  const input = page.locator('.guess-turn input')
  await input.waitFor()
  await sleep(slow ? 1600 : 200)
  await type(page, input, text, slow ? 85 : 10)
  await tap(page, button(page, 'Submit'), { before: 250 })
}

async function newDevice(browser, seed) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 })
  await ctx.addInitScript(seedScript(seed))
  await ctx.addInitScript(TAP_SCRIPT)
  const page = await ctx.newPage()
  return { ctx, page }
}

// ---------- scenario 1: pass & play on one iPad ----------
async function passAndPlay(browser) {
  const { page } = await newDevice(browser, 79) // deals ufo / igloo / hot air balloon
  await page.goto(BASE)
  await page.locator('.home').waitFor()
  await sleep(500)
  const rec = new Recorder(page, 'pass')
  const cdp = await page.context().newCDPSession(page)
  await rec.start()
  rec.mark('home')
  await sleep(2600)

  await tap(page, button(page, 'Pass & play'))
  rec.mark('setup')
  await sleep(900)
  const names = ['Anna', 'Ben', 'Cleo']
  const inputs = page.locator('.player-row input')
  for (let i = 0; i < 3; i++) await type(page, inputs.nth(i), names[i])
  await sleep(500)
  rec.mark('style')
  await tap(page, button(page, 'One chain'), { after: 1500 })
  await tap(page, button(page, 'Everyone has a book'), { after: 900 })
  rec.mark('settings')
  await page.locator('button[aria-label="-"]').scrollIntoViewIfNeeded()
  await sleep(500)
  await tap(page, page.locator('button[aria-label="-"]'), { after: 1000 })
  await tap(page, button(page, 'Start game'), { after: 300 })

  const picks = { Anna: 'ufo', Ben: 'igloo', Cleo: 'hot air balloon' }
  const words = []
  // step 0: everyone chooses a secret word
  for (const name of names) {
    rec.mark(`handoff:${name}:word`)
    await sleep(1500)
    await tap(page, button(page, `I'm ${name}`), { after: 200 })
    rec.mark(`word:${name}`)
    words.push(await pickWord(page, picks[name], words))
  }
  // step 1: everyone draws the word of the book they got (book of the player to the right)
  for (const [i, name] of names.entries()) {
    rec.mark(`handoff:${name}:draw`)
    await sleep(1300)
    await tap(page, button(page, `I'm ${name}`), { after: 300 })
    rec.mark(`draw:${name}`)
    const prompt = (await page.locator('.prompt-text').textContent())?.trim()
    await sleep(1300)
    await drawWord(page, cdp, prompt)
    await sleep(700)
    await tap(page, button(page, 'Done'), { after: 300 })
    rec.mark(`drawn:${name}:${prompt}`)
    void i
  }
  // step 2: everyone guesses the drawing they see
  for (const [i, name] of names.entries()) {
    rec.mark(`handoff:${name}:guess`)
    await sleep(1300)
    await tap(page, button(page, `I'm ${name}`), { after: 300 })
    rec.mark(`guess:${name}`)
    const original = words[(i - 2 + 3) % 3]
    await guess(page, GUESSES[original])
  }
  rec.mark('allDone')
  await sleep(2200)
  await tap(page, button(page, 'Reveal the books'), { after: 200 })
  for (let b = 0; b < 3; b++) {
    rec.mark(`book:${b}`)
    await sleep(1800) // cover
    for (let p = 0; p < 4; p++) {
      const isSummary = p === 3
      await tap(page, button(page, p === 0 ? 'Next page' : 'Next page'), { before: 0, after: isSummary ? 300 : 0 })
      await sleep(p === 1 ? 2600 : 2100)
    }
    rec.mark(`summary:${b}`)
    await sleep(800)
    if (b < 2) await tap(page, button(page, 'Next book'), { before: 400, after: 0 })
  }
  rec.mark('finish')
  await tap(page, button(page, 'Finish'), { after: 1200 })
  await tap(page, button(page, 'Past games'), { after: 2600 })
  rec.mark('end')
  await rec.stop()
  await page.context().close()
}

// ---------- scenario 2: online – host + joiner on their own iPads ----------
async function online(browser) {
  const host = await newDevice(browser, 10) // deals "crown"
  const joiner = await newDevice(browser, 23) // deals "kite"
  const bot = await newDevice(browser, 56) // off-screen third player, deals "campfire"
  await Promise.all([host.page.goto(BASE), joiner.page.goto(BASE)])
  await Promise.all([host.page.locator('.home').waitFor(), joiner.page.locator('.home').waitFor()])
  await sleep(500)
  const H = new Recorder(host.page, 'host')
  const J = new Recorder(joiner.page, 'joiner')
  const hcdp = await host.ctx.newCDPSession(host.page)
  const jcdp = await joiner.ctx.newCDPSession(joiner.page)
  const bcdp = await bot.ctx.newCDPSession(bot.page)
  await Promise.all([H.start(), J.start()])
  H.mark('home')
  await sleep(2000)

  // host creates a room
  await tap(host.page, button(host.page, 'Play online'))
  H.mark('online')
  await type(host.page, host.page.locator('input.input-big'), 'Anna')
  await tap(host.page, button(host.page, 'Create room'), { after: 300 })
  await host.page.locator('.room-code').waitFor()
  const code = (await host.page.locator('.room-code').textContent()).trim()
  H.mark(`lobby:${code}`)
  await sleep(2500)

  // joiner enters the code
  await tap(joiner.page, button(joiner.page, 'Play online'))
  J.mark('online')
  await type(joiner.page, joiner.page.locator('input.input-big'), 'Ben')
  await sleep(300)
  await type(joiner.page, joiner.page.locator('.code-input'), code, 160)
  await tap(joiner.page, button(joiner.page, 'Join'), { after: 300 })
  J.mark('joined')
  await sleep(1500)

  // third player joins via invite link (off-screen)
  await bot.page.goto(`${BASE}/?join=${code}`)
  await type(bot.page, bot.page.locator('input.input-big'), 'Cleo', 5)
  await bot.page.locator('button', { hasText: 'Join' }).first().click()
  H.mark('cleo-joined')
  await sleep(2200)

  // host shortens the book and starts
  await host.page.locator('button[aria-label="-"]').scrollIntoViewIfNeeded()
  await sleep(600)
  await tap(host.page, host.page.locator('button[aria-label="-"]'), { after: 900 })
  await tap(host.page, button(host.page, 'Start game'), { after: 200 })
  H.mark('start')

  // step 0: all pick at once (each device has its own cards)
  const picked = {}
  await Promise.all([
    (async () => (picked.host = await pickWord(host.page, 'crown')))(),
    (async () => {
      await sleep(900)
      picked.joiner = await pickWord(joiner.page, 'kite', ['crown'])
    })(),
    (async () => {
      await sleep(2500)
      picked.bot = await pickWord(bot.page, 'campfire', ['crown', 'kite'])
    })(),
  ])
  H.mark('draw')
  // step 1: simultaneous drawing on both iPads
  const drawOn = async (dev, cdp, rec, delay, fast = false) => {
    await dev.page.locator('.prompt-text').waitFor({ timeout: 15000 })
    const prompt = (await dev.page.locator('.prompt-text').textContent()).trim()
    await sleep(delay)
    await drawWord(dev.page, cdp, prompt, { fast })
    await sleep(fast ? 100 : 600)
    await dev.page.locator('button', { hasText: 'Done' }).first().click()
    rec?.mark(`drawn:${prompt}`)
  }
  await Promise.all([
    drawOn(host, hcdp, H, 1200),
    drawOn(joiner, jcdp, J, 1700),
    drawOn(bot, bcdp, null, 9000, true),
  ])
  H.mark('guess')
  // step 2: guesses (Cleo is last so the waiting screen shows)
  // host guesses Ben's book (rainbow), joiner guesses Cleo's book (campfire), bot guesses Anna's (balloon)
  await Promise.all([
    guess(host.page, GUESSES[picked.joiner] ?? 'mystery blob'),
    (async () => {
      await sleep(1200)
      await guess(joiner.page, GUESSES[picked.bot] ?? 'mystery blob')
    })(),
    (async () => {
      await sleep(13000)
      await guess(bot.page, GUESSES[picked.host] ?? 'mystery blob', { slow: false })
    })(),
  ])
  H.mark('reveal')
  await host.page.locator('.viewer').waitFor({ timeout: 20000 })
  await sleep(2000)
  for (let b = 0; b < 3; b++) {
    H.mark(`book:${b}`)
    await sleep(1500)
    for (let p = 0; p < 4; p++) {
      await tap(host.page, button(host.page, 'Next page'), { before: 0, after: 0 })
      await sleep(p === 1 ? 2300 : 1800)
    }
    if (b < 2) await tap(host.page, button(host.page, 'Next book'), { before: 300, after: 0 })
  }
  H.mark('finish')
  await tap(host.page, button(host.page, 'Finish'), { after: 2500 })
  H.mark('end')
  await Promise.all([H.stop(), J.stop()])
  await Promise.all([host.ctx.close(), joiner.ctx.close(), bot.ctx.close()])
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  if (!ONLY || ONLY === 'pass') await passAndPlay(browser)
  if (!ONLY || ONLY === 'online') await online(browser)
} finally {
  await browser.close()
}
console.log('done ->', OUT)
