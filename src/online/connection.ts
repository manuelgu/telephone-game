import type { ClientMsg, ServerMsg } from '../shared/protocol'

const PING_MS = 25_000
/** no message (not even a pong) for this long = the socket is dead even if it still reports OPEN */
const STALE_MS = 2 * PING_MS + 5_000

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

interface Handlers {
  onOpen: () => void
  onMessage: (msg: ServerMsg) => void
  onStatus: (s: ConnStatus) => void
}

/** WebSocket with automatic reconnect (incl. when iOS resumes a suspended tab). */
export class RoomConnection {
  private ws: WebSocket | null = null
  private retry = 0
  private timer = 0
  private pingTimer = 0
  private lastSeen = 0
  private stopped = false
  private readonly url: string
  private readonly onVisible = () => {
    if (document.visibilityState !== 'visible' || this.stopped) return
    const state = this.ws?.readyState
    // a resumed tab's socket can still report OPEN while it is dead: reconnect once it has gone quiet
    const alive = state === WebSocket.OPEN && Date.now() - this.lastSeen <= STALE_MS
    if (alive || state === WebSocket.CONNECTING) return
    window.clearTimeout(this.timer)
    this.connect()
  }

  constructor(code: string, private readonly h: Handlers) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    this.url = `${proto}://${location.host}/api/rooms/${code}/ws`
    document.addEventListener('visibilitychange', this.onVisible)
    window.addEventListener('online', this.onVisible)
    this.connect()
  }

  private connect() {
    if (this.stopped) return
    this.cleanupSocket()
    this.h.onStatus(this.retry === 0 ? 'connecting' : 'reconnecting')
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this.retry = 0
      this.lastSeen = Date.now()
      this.h.onStatus('open')
      this.h.onOpen()
      this.pingTimer = window.setInterval(() => {
        if (Date.now() - this.lastSeen > STALE_MS) {
          // half-open socket (network switch, resumed tab): sends would vanish silently
          this.retry++
          this.connect()
          return
        }
        this.send({ t: 'ping' })
      }, PING_MS)
    }
    ws.onmessage = (e) => {
      this.lastSeen = Date.now()
      try {
        this.h.onMessage(JSON.parse(e.data as string) as ServerMsg)
      } catch {
        /* ignore malformed */
      }
    }
    ws.onclose = () => {
      window.clearInterval(this.pingTimer)
      if (this.stopped || this.ws !== ws) return
      this.h.onStatus('reconnecting')
      const delay = Math.min(10_000, 400 * 2 ** this.retry++)
      this.timer = window.setTimeout(() => this.connect(), delay)
    }
  }

  private cleanupSocket() {
    window.clearInterval(this.pingTimer)
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onmessage = null
      this.ws.onopen = null
      try {
        this.ws.close()
      } catch {
        /* ignore */
      }
    }
    this.ws = null
  }

  send(msg: ClientMsg): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify(msg))
    return true
  }

  close() {
    this.stopped = true
    window.clearTimeout(this.timer)
    document.removeEventListener('visibilitychange', this.onVisible)
    window.removeEventListener('online', this.onVisible)
    this.cleanupSocket()
    this.h.onStatus('closed')
  }
}
