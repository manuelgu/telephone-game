import { DurableObject } from 'cloudflare:workers'
import { PLAYER_COLORS, actorsForStep, bookFor as bookForSeat, createBooks, pageKindForStep } from '../src/game/logic'
import type { Lang } from '../src/game/types'
import { WORDS } from '../src/i18n/words'
import {
  DEADLINE_GRACE_MS,
  MAX_IMAGE_CHARS,
  MAX_ONLINE_PLAYERS,
  TIMER_OPTIONS,
  resolveTotalSteps,
  type ClientMsg,
  type ErrorCode,
  type PageMeta,
  type PublicRoom,
  type RevealPos,
  type RoomSettings,
  type RoomStatus,
  type ServerMsg,
  type TurnInfo,
} from '../src/shared/protocol'

interface Seat {
  id: string
  name: string
  color: string
  token: string
  /** left the room mid-game: removed when the room returns to the lobby */
  left?: boolean
}

interface Stored {
  code: string
  createdAt: number
  lastActivity: number
  status: RoomStatus
  hostId: string
  players: Seat[]
  settings: RoomSettings
  step: number
  stepEndsAt: number | null
  submitted: string[]
  books: { ownerId: string; pages: PageMeta[] }[]
  reveal: RevealPos
  /** seats the host removed: their saved credentials must not silently rejoin as a new seat */
  kicked?: string[]
}

interface Attachment {
  playerId?: string
}

const IDLE_TTL_MS = 24 * 60 * 60 * 1000
const IDLE_RECHECK_MS = 60 * 60 * 1000
const LANGS: Lang[] = ['en', 'de', 'sv']

/** raster formats only: an SVG would be served from the app's origin and could run script */
const IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/

const imgKey = (book: number, page: number) => `img:${book}:${page}`
const randomId = () => crypto.randomUUID()

export class Room extends DurableObject<Env> {
  private s: Stored | undefined

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // answer keep-alive pings without waking the hibernated object
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'))
    ctx.blockConcurrencyWhile(async () => {
      this.s = await ctx.storage.get<Stored>('state')
    })
  }

  // ---------------- HTTP ----------------

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/init' && req.method === 'POST') {
      if (this.s) return new Response('exists', { status: 409 })
      const now = Date.now()
      this.s = {
        code: url.searchParams.get('code') ?? '',
        createdAt: now,
        lastActivity: now,
        status: 'lobby',
        hostId: '',
        players: [],
        settings: { timer: 90, turns: 0, lang: (url.searchParams.get('lang') as Lang) ?? 'en', style: 'books' },
        step: 0,
        stepEndsAt: null,
        submitted: [],
        books: [],
        reveal: { book: 0, page: -1 },
      }
      if (!LANGS.includes(this.s.settings.lang)) this.s.settings.lang = 'en'
      await this.save()
      return new Response('ok', { status: 201 })
    }

    if (!this.s) {
      // A client that was in this room before it expired would otherwise retry the upgrade forever:
      // accept it just long enough to say the room is gone.
      if (url.pathname === '/ws' && req.headers.get('Upgrade') === 'websocket') {
        const pair = new WebSocketPair()
        pair[1].accept()
        this.send(pair[1], { t: 'error', code: 'room_not_found', fatal: true })
        pair[1].close(4004, 'room not found')
        return new Response(null, { status: 101, webSocket: pair[0] })
      }
      return new Response('not found', { status: 404 })
    }

    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 })
      const pair = new WebSocketPair()
      this.ctx.acceptWebSocket(pair[1])
      pair[1].serializeAttachment({} satisfies Attachment)
      return new Response(null, { status: 101, webSocket: pair[0] })
    }

    if (url.pathname === '/info') {
      return Response.json({ code: this.s.code, status: this.s.status, players: this.s.players.length })
    }

    const img = url.pathname.match(/^\/img\/(\d+)\/(\d+)$/)
    if (img) {
      // hidden only while a round is being played; in the lobby the previous round's drawings stay
      // available so slow clients can finish saving that game to their history
      if (this.s.status === 'playing') return new Response('forbidden', { status: 403 })
      const data = await this.ctx.storage.get<string>(imgKey(Number(img[1]), Number(img[2])))
      if (!data) return new Response('not found', { status: 404 })
      const m = data.match(IMAGE_DATA_URL)
      if (!m) return new Response('bad image', { status: 500 })
      const bin = atob(m[2])
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return new Response(bytes, {
        headers: {
          'Content-Type': m[1],
          'Cache-Control': 'private, max-age=86400, immutable',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    return new Response('not found', { status: 404 })
  }

  // ---------------- WebSocket ----------------

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (!this.s || typeof raw !== 'string') return
    let msg: ClientMsg
    try {
      msg = JSON.parse(raw)
    } catch {
      return this.send(ws, { t: 'error', code: 'bad_request' })
    }
    if (!msg || typeof msg !== 'object') return this.send(ws, { t: 'error', code: 'bad_request' })
    const att = (ws.deserializeAttachment() ?? {}) as Attachment

    if (msg.t === 'ping') return this.send(ws, { t: 'pong' })
    if (msg.t === 'hello') return this.onHello(ws, msg)

    const me = att.playerId ? this.s.players.find((p) => p.id === att.playerId) : undefined
    if (!me) return this.send(ws, { t: 'error', code: 'bad_request' })
    // computed only for host-only messages: it walks every socket, and submits are the hot path
    const hostOnly = (): boolean => {
      const isHost = me.id === this.effectiveHostId()
      if (!isHost) this.send(ws, { t: 'error', code: 'not_host' })
      return isHost
    }

    switch (msg.t) {
      case 'settings': {
        if (this.s.status !== 'lobby' || !hostOnly()) return
        const next = { ...this.s.settings }
        const { timer, turns, lang, style } = msg.settings ?? {}
        if (style === 'books' || style === 'chain') next.style = style
        if (typeof timer === 'number' && TIMER_OPTIONS.includes(timer)) next.timer = timer
        if (typeof turns === 'number' && Number.isInteger(turns) && turns >= 0 && turns <= 100) next.turns = turns
        if (lang && LANGS.includes(lang)) next.lang = lang
        this.s.settings = next
        await this.commit()
        return
      }
      case 'kick': {
        if (this.s.status !== 'lobby' || !hostOnly() || msg.playerId === me.id) return
        if (!this.s.players.some((p) => p.id === msg.playerId)) return
        ;(this.s.kicked ??= []).push(msg.playerId)
        this.s.players = this.s.players.filter((p) => p.id !== msg.playerId)
        if (this.s.hostId === msg.playerId) this.s.hostId = me.id
        for (const other of this.ctx.getWebSockets()) {
          if ((other.deserializeAttachment() as Attachment)?.playerId === msg.playerId) {
            this.send(other, { t: 'error', code: 'kicked', fatal: true })
            other.serializeAttachment({})
            other.close(4001, 'kicked')
          }
        }
        await this.commit()
        return
      }
      case 'leave': {
        ws.serializeAttachment({})
        if (this.s.status === 'lobby') {
          this.s.players = this.s.players.filter((p) => p.id !== me.id)
          if (this.s.hostId === me.id) this.s.hostId = this.s.players[0]?.id ?? ''
        } else {
          // seat indices drive the book rotation, so the seat stays until the round is over
          me.left = true
        }
        ws.close(1000, 'left')
        if (this.s.status === 'playing') {
          // nobody is coming back for this seat: don't make the others wait for its pages
          this.fillMissing((id) => id === me.id)
          if (this.allSubmitted()) {
            await this.advance()
            return
          }
        }
        await this.commit(ws)
        return
      }
      case 'start': {
        if (this.s.status !== 'lobby' || !hostOnly()) return
        if (this.s.players.length < 2) return this.send(ws, { t: 'error', code: 'need_players' })
        await this.clearImages()
        this.s.status = 'playing'
        this.s.step = 0
        this.s.submitted = []
        // the word step is timed too, so an absent player can't stall the game
        this.s.stepEndsAt = this.stepDeadline()
        this.s.books = createBooks(this.s.settings.style, this.s.players)
        this.s.reveal = { book: 0, page: -1 }
        await this.commit()
        await this.sendTurns()
        return
      }
      case 'submit': {
        if (this.s.status !== 'playing' || msg.step !== this.s.step) return
        if (this.s.submitted.includes(me.id) || !this.actorIds().includes(me.id)) return
        const step = this.s.step
        const book = this.bookFor(me.id)
        const kind = pageKindForStep(step)
        const page: PageMeta = { kind, authorId: me.id, createdAt: Date.now(), timedOut: !!msg.timedOut }
        if (kind === 'drawing') {
          if (typeof msg.image === 'string' && msg.image.length < MAX_IMAGE_CHARS && IMAGE_DATA_URL.test(msg.image)) {
            await this.ctx.storage.put(imgKey(book, step), msg.image)
            page.hasImage = true
          }
        } else {
          page.text = String(msg.text ?? '').trim().slice(0, 80)
          if (kind === 'word' && !page.text) page.text = this.randomWord()
        }
        // the step may have been closed (deadline / skip) while the image was being stored
        if (this.s.status !== 'playing' || this.s.step !== step || this.s.submitted.includes(me.id)) return
        this.s.books[book].pages[step] = page
        this.s.submitted.push(me.id)
        if (this.allSubmitted()) await this.advance()
        else await this.commit()
        return
      }
      case 'skipWaiting': {
        // the step guards against a late tap skipping the step that just started
        if (this.s.status !== 'playing' || msg.step !== this.s.step || !hostOnly()) return
        this.fillMissing()
        await this.advance()
        return
      }
      case 'reveal': {
        if (this.s.status !== 'reveal' || !hostOnly()) return
        if (!Number.isFinite(msg.pos?.book) || !Number.isFinite(msg.pos?.page)) {
          return this.send(ws, { t: 'error', code: 'bad_request' })
        }
        const book = Math.max(0, Math.min(this.s.books.length - 1, Math.floor(msg.pos.book)))
        const page = Math.max(-1, Math.min(this.s.books[book].pages.length, Math.floor(msg.pos.page)))
        this.s.reveal = { book, page }
        await this.commit()
        return
      }
      case 'finish': {
        if (this.s.status !== 'reveal' || !hostOnly()) return
        this.s.status = 'done'
        await this.commit()
        return
      }
      case 'playAgain': {
        if ((this.s.status !== 'reveal' && this.s.status !== 'done') || !hostOnly()) return
        // images are cleared on 'start', not here (see /img)
        this.s.status = 'lobby'
        this.s.books = []
        this.s.step = 0
        this.s.submitted = []
        this.s.stepEndsAt = null
        // players who left mid-game keep their seat until the round ends; drop them before the next one
        this.s.players = this.s.players.filter((p) => !p.left)
        if (!this.s.players.some((p) => p.id === this.s!.hostId)) this.s.hostId = me.id
        await this.commit()
        await this.sendTurns()
        return
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'closed')
    } catch {
      /* already closed */
    }
    if (this.s) this.broadcastState(ws)
  }

  async webSocketError(ws: WebSocket) {
    if (this.s) this.broadcastState(ws)
  }

  async alarm() {
    if (!this.s) return
    const now = Date.now()
    if (this.s.status === 'playing' && this.s.stepEndsAt && now >= this.s.stepEndsAt + DEADLINE_GRACE_MS) {
      this.fillMissing()
      await this.advance()
      return
    }
    if (now - this.s.lastActivity > IDLE_TTL_MS && this.connectedIds().size === 0) {
      await this.ctx.storage.deleteAll()
      this.s = undefined
      return
    }
    await this.scheduleAlarm()
  }

  // ---------------- logic ----------------

  private async onHello(ws: WebSocket, msg: Extract<ClientMsg, { t: 'hello' }>) {
    const s = this.s!
    if (msg.playerId && s.kicked?.includes(msg.playerId)) return this.reject(ws, 'kicked')
    let seat = msg.playerId ? s.players.find((p) => p.id === msg.playerId && p.token === msg.token) : undefined
    // a socket that already holds a seat keeps it instead of creating another one
    const current = (ws.deserializeAttachment() as Attachment | null)?.playerId
    if (!seat && current) seat = s.players.find((p) => p.id === current)

    if (!seat) {
      const name = String(msg.name ?? '').trim().slice(0, 20)
      if (!name) return this.send(ws, { t: 'error', code: 'name_required' })
      const connected = this.connectedIds()
      const sameName = s.players.find((p) => p.name.toLowerCase() === name.toLowerCase())
      if (sameName) {
        // Allow retaking a seat whose device went away (lost session / new phone).
        if (connected.has(sameName.id)) return this.send(ws, { t: 'error', code: 'name_taken' })
        seat = sameName
        // new token: the device that lost the seat can no longer act for it
        seat.token = randomId()
      } else {
        if (s.status !== 'lobby') return this.reject(ws, 'game_started')
        if (s.players.length >= MAX_ONLINE_PLAYERS) return this.reject(ws, 'room_full')
        const used = new Set(s.players.map((p) => p.color))
        seat = {
          id: randomId(),
          name,
          token: randomId(),
          color: PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[s.players.length % PLAYER_COLORS.length],
        }
        s.players.push(seat)
        if (!s.hostId) s.hostId = seat.id
      }
    }

    delete seat.left
    ws.serializeAttachment({ playerId: seat.id } satisfies Attachment)
    this.send(ws, { t: 'welcome', playerId: seat.id, token: seat.token })
    await this.commit()
    this.send(ws, { t: 'turn', turn: await this.turnFor(seat.id) })
  }

  private bookFor(playerId: string): number {
    const idx = this.s!.players.findIndex((p) => p.id === playerId)
    return bookForSeat(this.s!.settings.style, idx, this.s!.step, this.s!.players.length)
  }

  /** players who act in the current step (everyone, or one player in chain mode) */
  private actorIds(): string[] {
    const s = this.s!
    return actorsForStep(s.settings.style, s.step, s.players.length).map((i) => s.players[i].id)
  }

  private stepDeadline(): number | null {
    const { timer } = this.s!.settings
    return timer ? Date.now() + timer * 1000 : null
  }

  private totalSteps(): number {
    return resolveTotalSteps(this.s!.settings.turns, this.s!.players.length)
  }

  private randomWord(): string {
    const list = WORDS[this.s!.settings.lang] ?? WORDS.en
    return list[Math.floor(Math.random() * list.length)]
  }

  private allSubmitted(): boolean {
    return this.actorIds().every((id) => this.s!.submitted.includes(id))
  }

  /** placeholder pages for actors that haven't submitted (optionally only those matching `only`) */
  private fillMissing(only?: (id: string) => boolean) {
    const s = this.s!
    const kind = pageKindForStep(s.step)
    for (const id of this.actorIds()) {
      if (s.submitted.includes(id) || (only && !only(id))) continue
      const page: PageMeta = { kind, authorId: id, createdAt: Date.now(), timedOut: true }
      if (kind === 'word') page.text = this.randomWord()
      else if (kind === 'guess') page.text = ''
      s.books[this.bookFor(id)].pages[s.step] = page
      s.submitted.push(id)
    }
  }

  private async advance() {
    const s = this.s!
    const left = new Set(s.players.filter((p) => p.left).map((p) => p.id))
    // steps where only players who left the room act are filled in and skipped right away
    for (;;) {
      s.step += 1
      s.submitted = []
      if (s.step > this.totalSteps()) {
        s.status = 'reveal'
        s.stepEndsAt = null
        s.reveal = { book: 0, page: -1 }
        break
      }
      s.stepEndsAt = this.stepDeadline()
      if (left.size === 0) break
      this.fillMissing((id) => left.has(id))
      if (!this.allSubmitted()) break
    }
    await this.commit()
    await this.sendTurns()
  }

  private async turnFor(playerId: string): Promise<TurnInfo | null> {
    const s = this.s!
    if (s.status !== 'playing' || s.submitted.includes(playerId)) return null
    if (!this.actorIds().includes(playerId)) return null
    const bookIndex = this.bookFor(playerId)
    const turn: TurnInfo = { step: s.step, kind: pageKindForStep(s.step), bookIndex }
    if (s.step > 0) {
      const prev = s.books[bookIndex].pages[s.step - 1]
      if (prev) {
        turn.previous = { kind: prev.kind, text: prev.text }
        if (prev.hasImage) turn.previous.image = await this.ctx.storage.get<string>(imgKey(bookIndex, s.step - 1))
      }
    }
    return turn
  }

  private async sendTurns() {
    await Promise.all(
      this.ctx.getWebSockets().map(async (ws) => {
        const id = (ws.deserializeAttachment() as Attachment)?.playerId
        if (id) this.send(ws, { t: 'turn', turn: await this.turnFor(id) })
      }),
    )
  }

  private async clearImages() {
    // Enumerate every possible key instead of storage.list(), which would load each stored drawing
    // into memory (a full 30-player round holds hundreds of them). Missing keys are ignored.
    const keys: string[] = []
    for (let b = 0; b < MAX_ONLINE_PLAYERS; b++) {
      for (let p = 0; p <= MAX_ONLINE_PLAYERS; p++) keys.push(imgKey(b, p))
    }
    // storage.delete() accepts at most 128 keys per call
    const batches: Promise<number>[] = []
    for (let i = 0; i < keys.length; i += 128) batches.push(this.ctx.storage.delete(keys.slice(i, i + 128)))
    await Promise.all(batches)
  }

  private connectedIds(exclude?: WebSocket): Set<string> {
    const ids = new Set<string>()
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude || ws.readyState !== WebSocket.OPEN) continue
      const id = (ws.deserializeAttachment() as Attachment)?.playerId
      if (id) ids.add(id)
    }
    return ids
  }

  private effectiveHostId(connected = this.connectedIds()): string {
    const s = this.s!
    if (connected.has(s.hostId)) return s.hostId
    return s.players.find((p) => connected.has(p.id))?.id ?? s.hostId
  }

  private publicRoom(exclude?: WebSocket): PublicRoom {
    const s = this.s!
    const connected = this.connectedIds(exclude)
    const room: PublicRoom = {
      code: s.code,
      createdAt: s.createdAt,
      status: s.status,
      hostId: s.hostId,
      effectiveHostId: this.effectiveHostId(connected),
      players: s.players.map((p) => ({ id: p.id, name: p.name, color: p.color, connected: connected.has(p.id) })),
      settings: s.settings,
      totalSteps: this.totalSteps(),
      step: s.step,
      stepEndsAt: s.stepEndsAt,
      submitted: s.submitted,
      reveal: s.reveal,
    }
    if (s.status === 'reveal' || s.status === 'done') room.books = s.books
    return room
  }

  private broadcastState(exclude?: WebSocket) {
    const msg: ServerMsg = { t: 'state', room: this.publicRoom(exclude), serverNow: Date.now() }
    const data = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) {
      // sockets without a seat (rejected hello, not yet admitted) must not follow the room
      if (ws === exclude || !(ws.deserializeAttachment() as Attachment | null)?.playerId) continue
      try {
        ws.send(data)
      } catch {
        /* socket gone */
      }
    }
  }

  /** fatal error for a socket that was not admitted: close it so it stops receiving room broadcasts */
  private reject(ws: WebSocket, code: ErrorCode) {
    this.send(ws, { t: 'error', code, fatal: true })
    ws.serializeAttachment({} satisfies Attachment)
    ws.close(4003, code)
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      /* socket gone */
    }
  }

  private async save() {
    this.s!.lastActivity = Date.now()
    await this.ctx.storage.put('state', this.s!)
    await this.scheduleAlarm()
  }

  private async commit(exclude?: WebSocket) {
    await this.save()
    this.broadcastState(exclude)
  }

  private async scheduleAlarm() {
    const s = this.s!
    // never in the past: an idle room that still has open sockets would otherwise re-fire immediately, forever.
    // Re-check such a room hourly rather than waking it every minute.
    let at = Math.max(s.lastActivity + IDLE_TTL_MS, Date.now() + IDLE_RECHECK_MS) + 60_000
    if (s.status === 'playing' && s.stepEndsAt) at = Math.min(at, s.stepEndsAt + DEADLINE_GRACE_MS)
    await this.ctx.storage.setAlarm(at)
  }
}

