export type Lang = 'en' | 'de' | 'sv'

/** books: everyone has a book, all pass at once (default). chain: one book, one player at a time. */
export type GameStyle = 'books' | 'chain'

export interface Player {
  id: string
  name: string
  color: string
}

export type PageKind = 'word' | 'drawing' | 'guess'

export interface Page {
  kind: PageKind
  authorId: string
  /** word / guess text */
  text?: string
  /** drawing as image data URL */
  image?: string
  /** true when the timer ran out before the player submitted */
  timedOut?: boolean
  createdAt: number
}

export interface Book {
  ownerId: string
  pages: Page[]
}

export interface GameSettings {
  /** seconds per drawing/guess turn, 0 = no timer */
  timer: number
  /** number of passes after the starting word. Full circle = players.length */
  turns: number
  lang: Lang
  /** missing in games saved before styles existed = 'books' */
  style?: GameStyle
}

export type GameStatus = 'playing' | 'reveal' | 'done'

export interface Game {
  id: string
  createdAt: number
  updatedAt: number
  players: Player[]
  settings: GameSettings
  books: Book[]
  /** 0 = choose starting word, 1..turns = drawing/guess passes */
  step: number
  /** index of the player whose turn it is within the current step */
  cursor: number
  status: GameStatus
  /** word suggestions already dealt in this game (avoid duplicates) */
  dealt: string[]
}
