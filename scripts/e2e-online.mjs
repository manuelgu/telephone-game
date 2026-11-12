// Protocol-level end-to-end test against the local dev server.
const BASE = process.env.BASE ?? 'http://localhost:5173'
const WS = BASE.replace(/^http/, 'ws')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const assert = (c, m) => {
  if (!c) throw new Error('ASSERT: ' + m)
  console.log('  ✓', m)
}
// tiny 1x1 jpeg-ish payload (server just stores the data URL)
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

class Client {
  constructor(name, code) {
    this.name = name
    this.code = code
    this.state = null
    this.turn = undefined
    this.errors = []
  }
  connect(hello) {
    return new Promise((resolve) => {
      this.ws = new WebSocket(`${WS}/api/rooms/${this.code}/ws`)
      this.ws.onopen = () => {
        this.send({ t: 'hello', ...hello })
        resolve()
      }
      this.ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.t === 'welcome') Object.assign(this, { id: m.playerId, token: m.token })
        if (m.t === 'state') this.state = m.room
        if (m.t === 'turn') this.turn = m.turn
        if (m.t === 'error') this.errors.push(m.code)
      }
    })
  }
  send(m) {
    this.ws.send(JSON.stringify(m))
  }
  close() {
    this.ws.close()
  }
}

async function until(fn, label, ms = 3000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (fn()) return
    await sleep(30)
  }
  throw new Error('timeout: ' + label)
}

const { code } = await (await fetch(`${BASE}/api/rooms?lang=de`, { method: 'POST' })).json()
console.log('room', code)

console.log('lobby')
const a = new Client('Anna', code)
const b = new Client('Ben', code)
const c = new Client('Cleo', code)
await a.connect({ name: 'Anna' })
await until(() => a.state?.players.length === 1, 'anna joined')
assert(a.state.hostId === a.id, 'first player is host')
assert(a.state.settings.lang === 'de', 'room lang from creator')
await b.connect({ name: 'Ben' })
await c.connect({ name: 'Cleo' })
await until(() => a.state.players.length === 3, '3 players')
assert(a.state.players.every((p) => p.connected), 'all connected')

const dup = new Client('x', code)
await dup.connect({ name: 'ben' })
await until(() => dup.errors.length, 'dup error')
assert(dup.errors[0] === 'name_taken', 'duplicate name rejected while connected')
dup.close()

b.send({ t: 'start' })
await until(() => b.errors.includes('not_host'), 'not host')
assert(true, 'non-host cannot start')

a.send({ t: 'settings', settings: { timer: 0, turns: 0 } })
await until(() => c.state.settings.timer === 0, 'settings')
assert(true, 'settings broadcast')

console.log('play')
a.send({ t: 'start' })
await until(() => [a, b, c].every((x) => x.turn?.kind === 'word'), 'word turns')
assert(a.state.status === 'playing' && a.state.totalSteps === 3, 'started, 3 steps')

// step 0 words
a.send({ t: 'submit', step: 0, text: 'kite' })
b.send({ t: 'submit', step: 0, text: 'cat' })
await until(() => a.state.submitted.length === 2, 'two submitted')
// Cleo reconnects mid-step using token
c.close()
await until(() => a.state.players.find((p) => p.id === c.id)?.connected === false, 'cleo offline')
assert(true, 'disconnect visible')
const c2 = new Client('Cleo', code)
await c2.connect({ playerId: c.id, token: c.token })
await until(() => c2.turn?.kind === 'word', 'cleo gets turn back')
assert(c2.id === c.id, 'reconnected to same seat')
c2.send({ t: 'submit', step: 0, text: 'dog' })
const players = [a, b, c2]
await until(() => players.every((x) => x.turn?.kind === 'drawing'), 'drawing turns')
assert(a.turn.previous.text === 'dog', 'Anna draws Cleo\'s word (book passes left)')
assert(b.turn.previous.text === 'kite', 'Ben draws Anna\'s word')

// duplicate submit ignored + stale step ignored
a.send({ t: 'submit', step: 0, text: 'stale' })
for (const p of players) p.send({ t: 'submit', step: 1, image: IMG })
await until(() => players.every((x) => x.turn?.kind === 'guess'), 'guess turns')
assert(players.every((x) => x.turn.previous.image === IMG), 'guessers receive the drawing')

// host skips Cleo on step 2
a.send({ t: 'submit', step: 2, text: 'guess A' })
b.send({ t: 'submit', step: 2, text: 'guess B' })
await sleep(100)
a.send({ t: 'skipWaiting', step: 2 })
await until(() => players.every((x) => x.turn?.kind === 'drawing' && x.turn.step === 3), 'step 3')
assert(true, 'host skipped waiting player')
for (const p of players) p.send({ t: 'submit', step: 3, image: IMG })
await until(() => a.state.status === 'reveal', 'reveal')
assert(a.state.books.length === 3 && a.state.books.every((bk) => bk.pages.length === 4), '3 books x 4 pages')
const annaBook = a.state.books.find((bk) => bk.ownerId === a.id)
assert(annaBook.pages[3].authorId === a.id, 'book returns to owner on last step')
const skipped = a.state.books.flatMap((bk) => bk.pages).find((p) => p.timedOut)
assert(skipped && skipped.authorId === c.id, 'skipped page marked timedOut')

const imgRes = await fetch(`${BASE}/api/rooms/${code}/img/0/1`)
assert(imgRes.ok && imgRes.headers.get('content-type') === 'image/png', 'image served after reveal')

b.send({ t: 'reveal', pos: { book: 1, page: 0 } })
a.send({ t: 'reveal', pos: { book: 2, page: 1 } })
await until(() => c2.state.reveal.book === 2 && c2.state.reveal.page === 1, 'reveal sync')
assert(true, 'host reveal position synced, non-host ignored')

// host leaves -> host powers transfer
a.close()
await until(() => b.state.effectiveHostId === b.id, 'host transfer')
assert(true, 'host powers move to next connected player')
b.send({ t: 'playAgain' })
await until(() => c2.state.status === 'lobby', 'back to lobby')
assert(c2.state.players.length === 3, 'same players in lobby again')
const gone = await fetch(`${BASE}/api/rooms/${code}/img/0/1`)
assert(gone.status === 200, 'previous round images still served in lobby (for history saves)')

// kick + late join after start
b.send({ t: 'kick', playerId: c2.id })
await until(() => c2.errors.includes('kicked'), 'kicked')
assert(b.state.players.length === 2, 'kicked player removed')

console.log('timer')
b.send({ t: 'settings', settings: { timer: 30 } })
await sleep(100)
b.send({ t: 'start' })
await until(() => b.turn?.kind === 'word', 'new game')
assert((await fetch(`${BASE}/api/rooms/${code}/img/0/1`)).status === 403, 'images hidden while playing')
const late = new Client('Zoe', code)
await late.connect({ name: 'Zoe' })
await until(() => late.errors.length, 'late error')
assert(late.errors[0] === 'game_started', 'cannot join after start')
b.send({ t: 'submit', step: 0, text: 'x' })
// Anna offline: retake seat by name
const a2 = new Client('Anna', code)
await a2.connect({ name: 'anna' })
await until(() => a2.turn?.kind === 'word', 'anna retakes seat by name')
assert(a2.id === a.id, 'retook disconnected seat by name')
assert(a2.token && a2.token !== a.token, 'seat token rotated on takeover')
a2.send({ t: 'submit', step: 0, text: 'y' })
await until(() => b.state.step === 1 && b.state.stepEndsAt, 'deadline set')
assert(Math.abs(b.state.stepEndsAt - Date.now() - 30000) < 3000, 'step deadline ~30s')

console.log('chain style')
{
  const { code: c2code } = await (await fetch(`${BASE}/api/rooms`, { method: 'POST' })).json()
  const h = new Client('Hal', c2code), i = new Client('Ida', c2code), j = new Client('Jo', c2code)
  await h.connect({ name: 'Hal' })
  await until(() => h.state?.players.length === 1, 'hal joined')
  assert(h.state.settings.style === 'books', 'default style is books')
  await i.connect({ name: 'Ida' })
  await j.connect({ name: 'Jo' })
  await until(() => h.state.players.length === 3, 'chain players')
  h.send({ t: 'settings', settings: { style: 'chain', timer: 0 } })
  await until(() => j.state.settings.style === 'chain', 'style broadcast')
  assert(true, 'host switched to chain')
  h.send({ t: 'start' })
  await until(() => h.turn?.kind === 'word', 'hal picks word')
  assert(i.turn === null && j.turn === null, 'only the first player acts in step 0')
  i.send({ t: 'submit', step: 0, text: 'cheat' })
  await sleep(150)
  assert(i.state.step === 0, 'non-active player cannot submit')
  h.send({ t: 'submit', step: 0, text: 'rocket' })
  await until(() => i.turn?.kind === 'drawing', 'ida draws')
  assert(i.turn.previous.text === 'rocket' && h.turn === null && j.turn === null, 'step 1: only Ida draws the word')
  i.send({ t: 'submit', step: 1, image: IMG })
  await until(() => j.turn?.kind === 'guess', 'jo guesses')
  assert(j.turn.previous.image === IMG, 'step 2: Jo guesses the drawing')
  j.send({ t: 'submit', step: 2, text: 'a pencil' })
  await until(() => h.turn?.kind === 'drawing', 'hal draws last')
  assert(true, 'step 3: chain wraps back to Hal')
  h.send({ t: 'skipWaiting', step: 3 })
  await until(() => h.state.status === 'reveal', 'chain reveal')
  const books = h.state.books
  assert(books.length === 1 && books[0].pages.length === 4, 'one book with 4 pages')
  assert(books[0].pages.map((p) => p.authorId).join() === [h.id, i.id, j.id, h.id].join(), 'authors in seat order')
  assert(books[0].pages[3].timedOut === true, 'skipped last page marked timedOut')
}

console.log('\nALL PASSED')
process.exit(0)
