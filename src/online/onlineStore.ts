import { create } from 'zustand'
import type { Game } from '../game/types'
import type { ClientMsg, ErrorCode, PublicRoom, TurnInfo } from '../shared/protocol'
import { useStore } from '../store/store'
import { RoomConnection, type ConnStatus } from './connection'

interface Creds {
  playerId: string
  token: string
}

const credKey = (code: string) => `tg:room:${code}`
const LAST_ROOM_KEY = 'tg:lastRoom'
const NAME_KEY = 'tg:myName'

const ls = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k)
      return v ? (JSON.parse(v) as T) : null
    } catch {
      return null
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}

export const savedName = () => ls.get<string>(NAME_KEY) ?? ''
export const lastRoom = (): string | null => {
  const code = ls.get<string>(LAST_ROOM_KEY)
  return code && ls.get<Creds>(credKey(code)) ? code : null
}

export type OnlineError = ErrorCode | 'network'

/**
 * Image URL for a revealed page. Book/page indices repeat on every round in the same room and the
 * server marks images immutable, so the page's createdAt is added to keep rounds from sharing a cache entry.
 */
export const roomImageUrl = (code: string, book: number, page: number, createdAt: number) =>
  `/api/rooms/${code}/img/${book}/${page}?v=${createdAt}`

interface OnlineState {
  code: string | null
  conn: ConnStatus
  room: PublicRoom | null
  you: string | null
  turn: TurnInfo | null
  /** serverNow - Date.now() */
  clockOffset: number
  error: OnlineError | null

  host: (name: string, lang: string) => Promise<boolean>
  join: (code: string, name?: string) => Promise<boolean>
  retryWithName: (name: string) => void
  send: (msg: ClientMsg) => void
  /** submit a page; kept and re-sent after a reconnect if the socket is down */
  submit: (msg: Extract<ClientMsg, { t: 'submit' }>) => void
  leave: () => void
  clearError: () => void
}

let connection: RoomConnection | null = null
let pendingName: string | undefined
let pendingSubmit: Extract<ClientMsg, { t: 'submit' }> | null = null
/** bumped on every join/leave so a slower, superseded join never opens a second connection */
let joinGen = 0
const savedGames = new Set<string>()

/** Build a viewer-compatible Game from a revealed room, with images served by the room. */
export function roomToGame(room: PublicRoom): Game {
  return {
    id: room.code,
    createdAt: room.createdAt,
    updatedAt: room.createdAt,
    players: room.players.map(({ id, name, color }) => ({ id, name, color })),
    settings: { timer: room.settings.timer, turns: room.totalSteps, lang: room.settings.lang, style: room.settings.style },
    books: (room.books ?? []).map((b, bi) => ({
      ownerId: b.ownerId,
      pages: b.pages.map((p, pi) => ({
        kind: p.kind,
        authorId: p.authorId,
        text: p.text,
        timedOut: p.timedOut,
        createdAt: p.createdAt,
        image: p.hasImage ? roomImageUrl(room.code, bi, pi, p.createdAt) : undefined,
      })),
    })),
    step: 0,
    cursor: 0,
    status: 'done',
    dealt: [],
  }
}

async function saveRoomToHistory(room: PublicRoom) {
  if (!room.books?.length) return
  const firstPage = room.books[0].pages[0]
  const id = `online-${room.code}-${firstPage?.createdAt ?? room.createdAt}`
  if (savedGames.has(id)) return
  savedGames.add(id)

  const toDataUrl = async (url: string): Promise<string | undefined> => {
    try {
      const res = await fetch(url)
      if (!res.ok) return undefined
      const blob = await res.blob()
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = reject
        r.readAsDataURL(blob)
      })
    } catch {
      return undefined
    }
  }

  const base = roomToGame(room)
  // one book at a time: every player saves at the same moment, and all of it is served by one room object
  const books: Game['books'] = []
  for (const b of base.books) {
    books.push({
      ...b,
      pages: await Promise.all(b.pages.map(async (p) => ({ ...p, image: p.image ? await toDataUrl(p.image) : undefined }))),
    })
  }
  const game: Game = {
    ...base,
    id,
    createdAt: firstPage?.createdAt ?? room.createdAt,
    updatedAt: Date.now(),
    books,
    step: room.totalSteps + 1,
  }
  // a drawing that failed to download (network blip) would otherwise be missing from history for good:
  // save what we have, but let a later state message retry and overwrite this entry
  const incomplete = base.books.some((b, bi) => b.pages.some((p, pi) => p.image && !books[bi].pages[pi].image))
  try {
    await useStore.getState().saveToHistory(game)
    if (incomplete) savedGames.delete(id)
  } catch {
    // e.g. IndexedDB quota: let a later state message retry instead of giving up for good
    savedGames.delete(id)
  }
}

export const useOnline = create<OnlineState>((set, get) => ({
  code: null,
  conn: 'closed',
  room: null,
  you: null,
  turn: null,
  clockOffset: 0,
  error: null,

  host: async (name, lang) => {
    try {
      const res = await fetch(`/api/rooms?lang=${encodeURIComponent(lang)}`, { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      const { code } = (await res.json()) as { code: string }
      return get().join(code, name)
    } catch {
      set({ error: 'network' })
      return false
    }
  },

  join: async (code, name) => {
    const gen = ++joinGen
    connection?.close()
    connection = null
    pendingSubmit = null
    set({ error: null })
    try {
      const res = await fetch(`/api/rooms/${code}`)
      if (gen !== joinGen) return false
      if (res.status === 404) {
        ls.del(credKey(code))
        set({ error: 'room_not_found' })
        return false
      }
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      if (gen !== joinGen) return false
      set({ error: 'network' })
      return false
    }
    if (name) {
      pendingName = name.trim()
      ls.set(NAME_KEY, pendingName)
    } else {
      pendingName = undefined
    }
    ls.set(LAST_ROOM_KEY, code)
    set({ code, room: null, turn: null, you: null })

    connection = new RoomConnection(code, {
      onStatus: (conn) => set({ conn }),
      onOpen: () => {
        const creds = ls.get<Creds>(credKey(code))
        connection?.send({ t: 'hello', playerId: creds?.playerId, token: creds?.token, name: pendingName ?? savedName() })
      },
      onMessage: (msg) => {
        switch (msg.t) {
          case 'welcome':
            ls.set(credKey(code), { playerId: msg.playerId, token: msg.token })
            set({ you: msg.playerId, error: null })
            break
          case 'state':
            set({ room: msg.room, clockOffset: msg.serverNow - Date.now() })
            if (msg.room.status === 'reveal' || msg.room.status === 'done') void saveRoomToHistory(msg.room)
            break
          case 'turn':
            if (pendingSubmit && msg.turn?.step === pendingSubmit.step) {
              // the server never got it: re-send, and keep it pending until the next turn message
              connection?.send(pendingSubmit)
              set({ turn: null })
            } else {
              pendingSubmit = null
              set({ turn: msg.turn })
            }
            break
          case 'error':
            // the server didn't admit this socket (e.g. the seat was taken over on another device while
            // this one was offline): drop the old seat so the room screen asks for a name again
            if (msg.code === 'name_taken' || msg.code === 'name_required') set({ error: msg.code, you: null })
            else set({ error: msg.code })
            if (msg.fatal) {
              ls.del(credKey(code))
              ls.del(LAST_ROOM_KEY)
              connection?.close()
              connection = null
            }
            break
        }
      },
    })
    return true
  },

  retryWithName: (name) => {
    pendingName = name.trim()
    ls.set(NAME_KEY, pendingName)
    set({ error: null })
    connection?.send({ t: 'hello', name: pendingName })
  },

  send: (msg) => {
    connection?.send(msg)
  },

  submit: (msg) => {
    // Kept until the server's next turn message: a send on a dying socket can be lost even when it
    // "succeeds", and after the reconnect the same-step turn comes back and the page is re-sent.
    pendingSubmit = msg
    connection?.send(msg)
    set({ turn: null })
  },

  leave: () => {
    const { code } = get()
    joinGen++
    pendingSubmit = null
    connection?.send({ t: 'leave' })
    connection?.close()
    connection = null
    if (code) ls.del(credKey(code))
    ls.del(LAST_ROOM_KEY)
    set({ code: null, room: null, you: null, turn: null, error: null, conn: 'closed' })
  },

  clearError: () => set({ error: null }),
}))

/** Server-synchronised "now". */
export const serverNow = () => Date.now() + useOnline.getState().clockOffset
