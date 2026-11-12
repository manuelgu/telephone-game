import type { GameStyle, Lang, PageKind } from '../game/types'

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 5
export const MAX_ONLINE_PLAYERS = 30
/** extra time the server waits after a deadline for late uploads */
export const DEADLINE_GRACE_MS = 8000
/** largest drawing data URL the server stores; larger submissions are dropped */
export const MAX_IMAGE_CHARS = 1_400_000

/** allowed timer settings in seconds, 0 = off */
export const TIMER_OPTIONS = [0, 30, 60, 90, 120, 180]

/** Resolved number of passes after the starting word (`turns` 0 or above the player count = full circle). */
export function resolveTotalSteps(turns: number, playerCount: number): number {
  return turns <= 0 || turns > playerCount ? playerCount : turns
}

export type RoomStatus = 'lobby' | 'playing' | 'reveal' | 'done'

export interface RoomSettings {
  timer: number
  /** 0 = full circle */
  turns: number
  lang: Lang
  style: GameStyle
}

export interface PublicPlayer {
  id: string
  name: string
  color: string
  connected: boolean
}

export interface PageMeta {
  kind: PageKind
  authorId: string
  text?: string
  /** true when the page has an image (fetch via /api/rooms/:code/img/:book/:page) */
  hasImage?: boolean
  timedOut?: boolean
  createdAt: number
}

export interface RevealPos {
  book: number
  /** -1 = cover, pages.length = summary */
  page: number
}

export interface PublicRoom {
  code: string
  createdAt: number
  status: RoomStatus
  hostId: string
  /** host, or first connected player when the host is offline */
  effectiveHostId: string
  players: PublicPlayer[]
  settings: RoomSettings
  /** resolved number of passes after the starting word */
  totalSteps: number
  step: number
  stepEndsAt: number | null
  submitted: string[]
  reveal: RevealPos
  /** only included once status is reveal/done */
  books?: { ownerId: string; pages: PageMeta[] }[]
}

export interface TurnInfo {
  step: number
  kind: PageKind
  bookIndex: number
  previous?: { kind: PageKind; text?: string; image?: string }
}

// ---------- client -> server ----------
export type ClientMsg =
  | { t: 'hello'; playerId?: string; token?: string; name?: string }
  | { t: 'settings'; settings: Partial<RoomSettings> }
  | { t: 'kick'; playerId: string }
  | { t: 'start' }
  | { t: 'submit'; step: number; text?: string; image?: string; timedOut?: boolean }
  /** step the host saw: a skip that arrives after the step already advanced is ignored */
  | { t: 'skipWaiting'; step: number }
  | { t: 'reveal'; pos: RevealPos }
  | { t: 'finish' }
  | { t: 'playAgain' }
  | { t: 'leave' }
  | { t: 'ping' }

// ---------- server -> client ----------
export type ErrorCode =
  | 'room_not_found'
  | 'game_started'
  | 'room_full'
  | 'name_taken'
  | 'name_required'
  | 'not_host'
  | 'need_players'
  | 'kicked'
  | 'bad_request'

export type ServerMsg =
  | { t: 'welcome'; playerId: string; token: string }
  | { t: 'state'; room: PublicRoom; serverNow: number }
  | { t: 'turn'; turn: TurnInfo | null }
  | { t: 'error'; code: ErrorCode; fatal?: boolean }
  | { t: 'pong' }

export function isValidCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false
  for (const c of code) if (!ROOM_CODE_ALPHABET.includes(c)) return false
  return true
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH)
}
