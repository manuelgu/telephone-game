import { create } from 'zustand'
import { del, get, set } from 'idb-keyval'
import { createGame, submitPage } from '../game/logic'
import type { Game, GameSettings, GameStyle, Lang, Page, Player } from '../game/types'
import { makeT, type T } from '../i18n/strings'

export type Screen = 'home' | 'setup' | 'game' | 'history' | 'viewer' | 'howto' | 'online' | 'room'

export interface HistoryEntry {
  id: string
  createdAt: number
  players: string[]
  /** first word -> final page text for a quick preview */
  preview: { start: string; end: string }[]
}

const CURRENT_KEY = 'tg:current'
const HISTORY_KEY = 'tg:history'
const gameKey = (id: string) => `tg:game:${id}`
const LANG_KEY = 'tg:lang'
const SETUP_KEY = 'tg:setup'

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null
    if (saved === 'en' || saved === 'de' || saved === 'sv') return saved
  } catch {
    /* storage unavailable */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase()
  if (nav.startsWith('de')) return 'de'
  if (nav.startsWith('sv')) return 'sv'
  return 'en'
}

export interface SetupPrefs {
  names: string[]
  timer: number
  turns: number | 'full'
  style?: GameStyle
}

function loadSetup(): SetupPrefs {
  try {
    const raw = localStorage.getItem(SETUP_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { names: ['', '', ''], timer: 90, turns: 'full', style: 'books' }
}

interface State {
  ready: boolean
  lang: Lang
  t: T
  screen: Screen
  game: Game | null
  history: HistoryEntry[]
  viewing: Game | null
  setup: SetupPrefs
  /** room code prefilled from an invite link */
  joinCode: string

  init: () => Promise<void>
  setLang: (l: Lang) => void
  go: (s: Screen) => void
  saveSetup: (s: SetupPrefs) => void
  startGame: (players: Player[], settings: GameSettings) => void
  submit: (page: Omit<Page, 'kind' | 'authorId' | 'createdAt'>) => void
  markDealt: (words: string[]) => void
  quitGame: () => void
  finishGame: () => void
  openHistory: (id: string) => Promise<void>
  deleteHistory: (id: string) => Promise<void>
  saveToHistory: (game: Game) => Promise<void>
  setJoinCode: (code: string) => void
}

function summarize(game: Game): HistoryEntry {
  return {
    id: game.id,
    createdAt: game.createdAt,
    players: game.players.map((p) => p.name),
    preview: game.books.map((b) => ({
      start: b.pages[0]?.text ?? '',
      end: [...b.pages].reverse().find((p) => p.text)?.text ?? '',
    })),
  }
}

/**
 * History writes run one at a time and read the index when they run: two overlapping saves that both
 * started from the same snapshot would otherwise drop one of the entries from the stored index.
 */
let historyQueue: Promise<unknown> = Promise.resolve()
function queueHistory<R>(fn: () => Promise<R>): Promise<R> {
  const run = historyQueue.then(fn)
  historyQueue = run.catch(() => {})
  return run
}

function persistToHistory(game: Game): Promise<void> {
  return queueHistory(async () => {
    const next = [summarize(game), ...useStore.getState().history.filter((h) => h.id !== game.id)]
    await set(gameKey(game.id), game)
    await set(HISTORY_KEY, next)
    useStore.setState({ history: next })
  })
}

const initialLang = detectLang()

export const useStore = create<State>((setState, getState) => ({
  ready: false,
  lang: initialLang,
  t: makeT(initialLang),
  screen: 'home',
  game: null,
  history: [],
  viewing: null,
  setup: loadSetup(),
  joinCode: '',

  init: async () => {
    try {
      const [game, history] = await Promise.all([
        get<Game>(CURRENT_KEY),
        get<HistoryEntry[]>(HISTORY_KEY),
      ])
      setState({ game: game ?? null, history: history ?? [], ready: true })
    } catch {
      setState({ ready: true })
    }
  },

  setLang: (lang) => {
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang
    setState({ lang, t: makeT(lang) })
  },

  go: (screen) => setState({ screen }),

  saveSetup: (setup) => {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify(setup))
    } catch {
      /* ignore */
    }
    setState({ setup })
  },

  startGame: (players, settings) => {
    const game = createGame(players, settings)
    setState({ game, screen: 'game' })
    void set(CURRENT_KEY, game)
  },

  submit: (page) => {
    const { game } = getState()
    if (!game) return
    const next = submitPage(game, page)
    setState({ game: next })
    void set(CURRENT_KEY, next)
    if (next.status === 'reveal') {
      // Save to history as soon as all books are complete, so nothing is lost.
      void persistToHistory(next)
    }
  },

  markDealt: (words) => {
    const { game } = getState()
    if (!game) return
    const next = { ...game, dealt: [...game.dealt, ...words] }
    setState({ game: next })
    void set(CURRENT_KEY, next)
  },

  quitGame: () => {
    setState({ game: null, screen: 'home' })
    void del(CURRENT_KEY)
  },

  finishGame: () => {
    const { game } = getState()
    if (game) {
      const done: Game = { ...game, status: 'done', updatedAt: Date.now() }
      void persistToHistory(done)
    }
    setState({ game: null, screen: 'home' })
    void del(CURRENT_KEY)
  },

  openHistory: async (id) => {
    const g = await get<Game>(gameKey(id))
    if (g) setState({ viewing: g, screen: 'viewer' })
  },

  saveToHistory: (game) => persistToHistory(game),

  setJoinCode: (joinCode) => setState({ joinCode }),

  deleteHistory: async (id) => {
    setState({ history: getState().history.filter((h) => h.id !== id) })
    await queueHistory(async () => {
      await del(gameKey(id))
      await set(HISTORY_KEY, getState().history)
    })
  },
}))
