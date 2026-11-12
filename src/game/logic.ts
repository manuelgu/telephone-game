import type { Book, Game, GameSettings, GameStyle, Page, PageKind, Player } from './types'

export const MIN_PLAYERS = 2

export const PLAYER_COLORS = [
  '#e8553d', '#3b82c4', '#f2b632', '#3fa66b', '#9b5fc0', '#e07bb0',
  '#2bb3b1', '#f08a24', '#6b7f2a', '#c0392b', '#4b5bd6', '#8d6e4c',
]

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/** Which book does player `p` work on during `step`? Books move one seat to the left each step. */
export function bookIndexFor(playerIndex: number, step: number, playerCount: number): number {
  return mod(playerIndex - step, playerCount)
}

/** Step 0 = starting word, odd steps = draw, even steps = guess. */
export function pageKindForStep(step: number): PageKind {
  if (step === 0) return 'word'
  return step % 2 === 1 ? 'drawing' : 'guess'
}

export const isChain = (style?: GameStyle) => style === 'chain'

/**
 * Seat indices that act during `step`.
 * books: everyone. chain: one player — seat 0 picks the word, then seats 1, 2, … (wrapping back to seat 0).
 */
export function actorsForStep(style: GameStyle | undefined, step: number, playerCount: number): number[] {
  if (isChain(style)) return [mod(step, playerCount)]
  return Array.from({ length: playerCount }, (_, i) => i)
}

/** Book a seat works on during `step` (chain mode only has book 0). */
export function bookFor(style: GameStyle | undefined, playerIndex: number, step: number, playerCount: number): number {
  return isChain(style) ? 0 : bookIndexFor(playerIndex, step, playerCount)
}

export function totalTurns(game: Pick<Game, 'players' | 'settings'>): number {
  const perStep = isChain(game.settings.style) ? 1 : game.players.length
  return perStep * (game.settings.turns + 1)
}

export function turnNumber(game: Pick<Game, 'players' | 'step' | 'cursor' | 'settings'>): number {
  if (isChain(game.settings.style)) return game.step
  return game.step * game.players.length + game.cursor
}

/** Empty books for a new round: one per player, or a single book owned by seat 0 in chain mode. */
export function createBooks<P>(style: GameStyle | undefined, players: { id: string }[]): { ownerId: string; pages: P[] }[] {
  return isChain(style) ? [{ ownerId: players[0].id, pages: [] }] : players.map((p) => ({ ownerId: p.id, pages: [] }))
}

export function createGame(players: Player[], settings: GameSettings): Game {
  if (players.length < MIN_PLAYERS) throw new Error('Need at least 2 players')
  const turns = Math.max(1, Math.min(settings.turns, players.length))
  const now = Date.now()
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    players,
    settings: { ...settings, turns },
    books: createBooks(settings.style, players),
    step: 0,
    cursor: 0,
    status: 'playing',
    dealt: [],
  }
}

export interface CurrentTurn {
  player: Player
  playerIndex: number
  bookIndex: number
  book: Book
  kind: PageKind
  /** the page the player must react to (undefined on step 0) */
  previous?: Page
}

export function currentTurn(game: Game): CurrentTurn | null {
  if (game.status !== 'playing') return null
  const n = game.players.length
  const playerIndex = isChain(game.settings.style) ? mod(game.step, n) : game.cursor
  const bookIndex = bookFor(game.settings.style, playerIndex, game.step, n)
  const book = game.books[bookIndex]
  return {
    player: game.players[playerIndex],
    playerIndex,
    bookIndex,
    book,
    kind: pageKindForStep(game.step),
    previous: book.pages[book.pages.length - 1],
  }
}

/** Pure: returns a new game with the page added and the cursor advanced. */
export function submitPage(game: Game, page: Omit<Page, 'kind' | 'authorId' | 'createdAt'>): Game {
  const turn = currentTurn(game)
  if (!turn) return game
  const newPage: Page = {
    ...page,
    kind: turn.kind,
    authorId: turn.player.id,
    createdAt: Date.now(),
  }
  const books = game.books.map((b, i) =>
    i === turn.bookIndex ? { ...b, pages: [...b.pages, newPage] } : b,
  )
  let { step, cursor, status } = game
  cursor += 1
  if (isChain(game.settings.style) || cursor >= game.players.length) {
    cursor = 0
    step += 1
    if (step > game.settings.turns) status = 'reveal'
  }
  return { ...game, books, step, cursor, status, updatedAt: Date.now() }
}

export function playerById(game: Pick<Game, 'players'>, id: string): Player | undefined {
  return game.players.find((p) => p.id === id)
}
