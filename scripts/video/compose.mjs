// Composes the walkthrough video from the recordings made by record.mjs.
// Usage: node scripts/video/compose.mjs <recDir> <output.mp4>
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REC = path.resolve(process.argv[2] ?? 'video-out')
const OUTPUT = path.resolve(process.argv[3] ?? 'walkthrough.mp4')
const WORK = path.join(REC, 'compose')
fs.mkdirSync(WORK, { recursive: true })
const W = 1920
const H = 1080
const FPS = 30

const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })

// ---------------- 1. screencast frames -> constant frame rate clips ----------------
function loadRec(name) {
  const dir = path.join(REC, name)
  const rec = JSON.parse(fs.readFileSync(path.join(dir, 'recording.json'), 'utf8'))
  const t0 = rec.frames[0].ts
  const raw = path.join(WORK, `${name}-raw.mp4`)
  if (!fs.existsSync(raw)) {
    const lines = []
    rec.frames.forEach((f, i) => {
      const next = rec.frames[i + 1]?.ts ?? rec.end
      lines.push(`file '${path.join(dir, f.file)}'`, `duration ${Math.max(0.001, next - f.ts).toFixed(4)}`)
    })
    lines.push(`file '${path.join(dir, rec.frames.at(-1).file)}'`)
    fs.writeFileSync(path.join(WORK, `${name}.txt`), lines.join('\n'))
    console.log(`encoding ${name} (${rec.frames.length} frames)`)
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', path.join(WORK, `${name}.txt`), '-fps_mode', 'cfr', '-r', String(FPS),
      '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', raw])
  }
  const at = (marker, off = 0) => {
    const m = rec.markers.find((x) => x.name === marker || x.name.startsWith(marker + ':') || x.name.startsWith(marker))
    if (!m) throw new Error(`marker ${marker} not found in ${name}`)
    return m.ts + off
  }
  return { name, raw, t0, end: rec.end, at }
}

const pass = loadRec('pass')
const host = loadRec('host')
const joiner = loadRec('joiner')

// ---------------- 2. graphics rendered from HTML ----------------
const fontUrl = 'file://' + path.join(ROOT, 'node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2')
const iconUrl = 'file://' + path.join(ROOT, 'public/icon.svg')

const CSS = `
@font-face { font-family: 'Patrick Hand'; src: url('${fontUrl}') format('woff2'); }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { font-family: 'Patrick Hand', sans-serif; color: #2b2118; }
.paper { background-color: #f7efe0; background-image: radial-gradient(rgba(43,33,24,.10) 1.6px, transparent 1.6px); background-size: 30px 30px; }
.center { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.card { background: #fffdf8; border: 4px solid #2b2118; border-radius: 28px; box-shadow: 7px 7px 0 #2b2118; }
.tag { display: inline-block; padding: 6px 22px; border: 3px solid #2b2118; border-radius: 999px; font-size: 30px; box-shadow: 3px 3px 0 #2b2118; }
.yellow { background: #f2b632; } .blue { background: #3b82c4; color: #fff; } .red { background: #e8553d; color: #fff; }
.caption { position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 18px;
  padding: 10px 30px; background: #fffdf8; border: 4px solid #2b2118; border-radius: 22px; box-shadow: 5px 5px 0 #2b2118;
  font-size: 38px; white-space: nowrap; }
.caption .tag { font-size: 24px; padding: 2px 14px; box-shadow: none; }
.bezel { position: absolute; border-style: solid; border-color: #1c1c1e; box-shadow: 0 0 0 2px #3a3a3c inset; }
.cam { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #3a3a3c; }
`

async function renderPngs(items) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  for (const { file, html, transparent } of items) {
    const htmlFile = path.join(WORK, 'tmp.html')
    fs.writeFileSync(htmlFile, `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body class="${transparent ? '' : 'paper'}">${html}</body>`)
    await page.goto('file://' + htmlFile)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: file, omitBackground: !!transparent })
  }
  await browser.close()
}

// iPad layouts: screen rect in output pixels + bezel thickness
const SINGLE = { x: 335, y: 34, w: 1250, h: 869, b: 26 } // 1180x820 * ~1.06
const SPLIT = [
  { x: 70, y: 190, w: 860, h: 598, b: 20 },
  { x: 990, y: 190, w: 860, h: 598, b: 20 },
]

const bezelHtml = ({ x, y, w, h, b }) => `
  <div class="bezel" style="left:${x - b}px;top:${y - b}px;width:${w + 2 * b}px;height:${h + 2 * b}px;border-width:${b}px;border-radius:${b + 22}px"></div>
  <div class="cam" style="left:${x - b / 2 - 5}px;top:${y + h / 2 - 5}px"></div>`

const shadowHtml = ({ x, y, w, h, b }) =>
  `<div style="position:absolute;left:${x - b}px;top:${y - b}px;width:${w + 2 * b}px;height:${h + 2 * b}px;border-radius:${b + 22}px;background:#1c1c1e;box-shadow:0 18px 50px rgba(43,33,24,.35)"></div>`

const captionHtml = (text, tag, tagClass, top) =>
  `<div class="caption" style="top:${top}px"><span class="tag ${tagClass}">${tag}</span><span>${text}</span></div>`

const cards = {
  intro: `<div class="center">
      <img src="${iconUrl}" style="width:220px;transform:rotate(-6deg);filter:drop-shadow(6px 8px 0 rgba(43,33,24,.25))">
      <h1 style="font-size:130px;font-weight:400;margin-top:20px">Telephone Sketchbook</h1>
      <p style="font-size:52px;color:#6d5f52;margin-top:6px">Draw it. Guess it. Pass it on.</p></div>`,
  purpose: `<div class="center">
      <h1 style="font-size:84px;font-weight:400;margin-bottom:46px">The drawing telephone game</h1>
      <div style="display:grid;grid-template-columns:repeat(4,370px);gap:28px">
        ${[
          ['✍️', '#e8553d', 'Pick a secret word', 'for your own sketchbook'],
          ['🎨', '#3b82c4', 'The next player draws it', 'without saying a word'],
          ['🤔', '#f2b632', 'The next one guesses', 'only seeing the drawing'],
          ['📖', '#3fa66b', 'Flip through the books', 'and laugh at what it became'],
        ].map(([e, c, a, b], i) => `<div class="card" style="padding:34px 24px;transform:rotate(${i % 2 ? 1.2 : -1.2}deg)">
            <div style="width:110px;height:110px;margin:0 auto 18px;border-radius:50%;border:4px solid #2b2118;background:${c};display:grid;place-items:center;font-size:58px">${e}</div>
            <div style="font-size:44px;line-height:1.05">${a}</div><div style="font-size:32px;color:#6d5f52;margin-top:8px">${b}</div></div>`).join('')}
      </div>
      <p style="font-size:40px;color:#6d5f52;margin-top:50px">Drawing → guessing → drawing… every book changes as it goes round the table.</p></div>`,
  mode1: `<div class="center">
      <span class="tag yellow" style="font-size:40px">Mode 1 · the classic</span>
      <div style="font-size:150px;margin-top:26px">📱🔄</div>
      <h1 style="font-size:120px;font-weight:400">Pass &amp; play</h1>
      <p style="font-size:50px;color:#6d5f52;margin-top:4px">One iPad, passed around the table. Works offline.</p></div>`,
  mode2: `<div class="center">
      <span class="tag blue" style="font-size:40px">Mode 2</span>
      <div style="font-size:150px;margin-top:26px">📱📱📱</div>
      <h1 style="font-size:120px;font-weight:400">Play online</h1>
      <p style="font-size:50px;color:#6d5f52;margin-top:4px">Everyone on their own iPad or phone. Join with a code or QR.</p></div>`,
  outro: `<div class="center">
      <img src="${iconUrl}" style="width:170px;transform:rotate(-6deg)">
      <h1 style="font-size:110px;font-weight:400;margin-top:14px">Telephone Sketchbook</h1>
      <div style="display:flex;gap:22px;margin-top:30px">
        <span class="tag yellow">Pass &amp; play</span><span class="tag blue">Online rooms</span><span class="tag red">Apple Pencil</span>
      </div>
      <p style="font-size:44px;color:#6d5f52;margin-top:34px">iPhone · iPad · English · Deutsch · Svenska</p></div>`,
}

// ---------------- 3. timeline ----------------
// Scenes: { card, dur } | { layout:'single', src, from, to, speed, text } | { layout:'split', from, to, speed, text }
const P = (m, o) => pass.at(m, o)
const Hm = (m, o) => host.at(m, o)
const TL = [
  { card: 'intro', dur: 4.2 },
  { card: 'purpose', dur: 8.5 },
  { card: 'mode1', dur: 3.8 },
  { layout: 'single', from: P('home', 0.2), to: P('setup'), text: 'Start a game on one iPad with “Pass &amp; play”' },
  { layout: 'single', from: P('setup'), to: P('style'), text: 'Enter the players in seating order' },
  { layout: 'single', from: P('style'), to: P('settings'), text: 'Everyone gets their own book (default) – or play one single chain' },
  { layout: 'single', from: P('settings'), to: P('handoff:Anna:word'), text: 'Set a turn timer and the book length' },
  { layout: 'single', from: P('handoff:Anna:word'), to: P('handoff:Ben:word'), text: 'The app says who’s next – then pick a secret word for your book' },
  { layout: 'single', from: P('handoff:Ben:word'), to: P('handoff:Anna:draw'), speed: 2.2, text: 'Pass it on: Ben and Cleo pick their words too' },
  { layout: 'single', from: P('handoff:Anna:draw'), to: P('draw:Anna', 1.2), text: 'Round 2: draw the word in the book you were handed' },
  { layout: 'single', from: P('draw:Anna', 1.2), to: P('drawn:Anna'), speed: 1.6, text: 'Draw with Apple Pencil pressure, colours and the fill bucket' },
  { layout: 'single', from: P('drawn:Anna'), to: P('handoff:Anna:guess'), speed: 3.2, text: 'Pass the iPad – Ben and Cleo draw their pages' },
  { layout: 'single', from: P('handoff:Anna:guess'), to: P('handoff:Ben:guess'), text: 'Round 3: guess the drawing – without seeing the word' },
  { layout: 'single', from: P('handoff:Ben:guess'), to: P('allDone'), speed: 2.2, text: 'Everyone guesses what they see' },
  { layout: 'single', from: P('allDone'), to: P('book:0'), text: 'All books are complete – gather round!' },
  { layout: 'single', from: P('book:0'), to: P('summary:0', 0.9), text: 'Flip through each book together' },
  { layout: 'single', from: P('summary:0', 0.9), to: P('finish'), speed: 2.4, text: 'Every player has a book to reveal' },
  { layout: 'single', from: P('finish'), to: P('end', 0.4), text: 'Games are saved under “Past games”' },
  { card: 'mode2', dur: 3.8 },
  { layout: 'split', from: Hm('home', 0.2), to: Hm('lobby', 2.4), text: 'The host creates a room on their iPad' },
  { layout: 'split', from: Hm('lobby', 2.4), to: Hm('cleo-joined', 1.5), text: 'Friends join with the room code – or by scanning the QR code' },
  { layout: 'split', from: Hm('cleo-joined', 1.5), to: Hm('start'), text: 'The host sets the rules and starts the game' },
  { layout: 'split', from: Hm('start'), to: Hm('draw'), text: 'Everyone picks a secret word on their own device' },
  { layout: 'split', from: Hm('draw'), to: Hm('guess'), speed: 1.7, text: 'Everyone draws at the same time – no waiting' },
  { layout: 'split', from: Hm('guess'), to: Hm('guess', 6.5), text: 'Then everyone guesses the drawing they received' },
  { layout: 'split', from: Hm('guess', 6.5), to: Hm('reveal'), speed: 3.5, text: 'Done early? You can see who you’re still waiting for' },
  { layout: 'split', from: Hm('reveal'), to: Hm('book:1'), text: 'The host flips the pages – every screen follows along' },
  { layout: 'split', from: Hm('book:1'), to: Hm('finish'), speed: 2.4, text: 'Book after book…' },
  { layout: 'split', from: Hm('finish'), to: Hm('end', 0.2), text: 'Each device keeps the game in its history' },
  { card: 'outro', dur: 4.5 },
]

// ---------------- 4. render graphics ----------------
const pngs = []
const file = (n) => path.join(WORK, n)
for (const [name, html] of Object.entries(cards)) pngs.push({ file: file(`card-${name}.png`), html })
pngs.push({ file: file('base-single.png'), html: shadowHtml(SINGLE) })
pngs.push({ file: file('base-split.png'), html: SPLIT.map(shadowHtml).join('') })
TL.forEach((s, i) => {
  if (s.card) return
  if (s.layout === 'single') {
    pngs.push({
      file: file(`ov-${i}.png`),
      transparent: true,
      html: bezelHtml(SINGLE) + captionHtml(s.text, 'Pass &amp; play', 'yellow', 958),
    })
  } else {
    const labels = SPLIT.map(
      (r, k) => `<div style="position:absolute;left:${r.x}px;width:${r.w}px;top:${r.y - 86}px;text-align:center">
        <span class="tag ${k ? 'yellow' : 'blue'}" style="font-size:34px">${k ? '📱 Joiner · Ben’s iPad' : '👑 Host · Anna’s iPad'}</span></div>`,
    ).join('')
    pngs.push({
      file: file(`ov-${i}.png`),
      transparent: true,
      html: SPLIT.map(bezelHtml).join('') + labels + captionHtml(s.text, 'Online', 'blue', 870),
    })
  }
})
console.log(`rendering ${pngs.length} graphics`)
await renderPngs(pngs)

// ---------------- 5. render segments ----------------
const ENC = ['-r', String(FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17']
const segs = []
TL.forEach((s, i) => {
  const out = file(`seg-${String(i).padStart(2, '0')}.mp4`)
  segs.push(out)
  if (s.card) {
    ffmpeg(['-loop', '1', '-t', String(s.dur), '-i', file(`card-${s.card}.png`),
      '-vf', `fade=in:st=0:d=0.45,fade=out:st=${(s.dur - 0.45).toFixed(2)}:d=0.45,format=yuv420p`, ...ENC, out])
    return
  }
  const speed = s.speed ?? 1
  const dur = (s.to - s.from) / speed
  const pts = `setpts=(PTS-STARTPTS)/${speed}`
  if (s.layout === 'single') {
    const r = SINGLE
    ffmpeg(['-ss', (s.from - pass.t0).toFixed(3), '-t', (s.to - s.from).toFixed(3), '-i', pass.raw,
      '-loop', '1', '-i', file('base-single.png'), '-loop', '1', '-i', file(`ov-${i}.png`),
      '-filter_complex',
      `[0:v]${pts},scale=${r.w}:${r.h}:flags=lanczos,fps=${FPS}[v];[1:v][v]overlay=${r.x}:${r.y}:eof_action=endall[b];[b][2:v]overlay=0:0,format=yuv420p`,
      '-t', dur.toFixed(3), ...ENC, out])
  } else {
    const [a, b] = SPLIT
    ffmpeg(['-ss', (s.from - host.t0).toFixed(3), '-t', (s.to - s.from).toFixed(3), '-i', host.raw,
      '-ss', Math.max(0, s.from - joiner.t0).toFixed(3), '-t', (s.to - s.from).toFixed(3), '-i', joiner.raw,
      '-loop', '1', '-i', file('base-split.png'), '-loop', '1', '-i', file(`ov-${i}.png`),
      '-filter_complex',
      `[0:v]${pts},scale=${a.w}:${a.h}:flags=lanczos,fps=${FPS}[h];[1:v]${pts},scale=${b.w}:${b.h}:flags=lanczos,fps=${FPS},tpad=stop_mode=clone:stop_duration=5[j];` +
        `[2:v][h]overlay=${a.x}:${a.y}:eof_action=endall[s1];[s1][j]overlay=${b.x}:${b.y}[s2];[s2][3:v]overlay=0:0,format=yuv420p`,
      '-t', dur.toFixed(3), ...ENC, out])
  }
  console.log(`segment ${i}: ${dur.toFixed(1)}s ${s.text?.replace(/&amp;/g, '&') ?? ''}`)
})

// ---------------- 6. concat + silent audio track ----------------
fs.writeFileSync(file('segments.txt'), segs.map((s) => `file '${s}'`).join('\n'))
ffmpeg(['-f', 'concat', '-safe', '0', '-i', file('segments.txt'), '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
  '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', OUTPUT])
console.log('wrote', OUTPUT)
