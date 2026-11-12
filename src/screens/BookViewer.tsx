import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { playerById } from '../game/logic'
import type { Game, Page } from '../game/types'
import { useStore } from '../store/store'

export interface ViewerPos {
  book: number
  /** -1 = cover, 0..pages-1 = pages, pages = summary */
  page: number
}

interface Props {
  game: Game
  onExit: () => void
  exitLabel: string
  onPlayAgain?: () => void
  playAgainLabel?: string
  /** controlled position (online reveal). Omit for local navigation. */
  position?: ViewerPos
  onNavigate?: (pos: ViewerPos) => void
  /** follower in an online reveal: no navigation controls */
  readOnly?: boolean
  /** shown instead of the controls when readOnly */
  readOnlyNote?: ReactNode
}

const cmp = (a: ViewerPos, b: ViewerPos) => (a.book - b.book) * 10000 + (a.page - b.page)

export function BookViewer({
  game,
  onExit,
  exitLabel,
  onPlayAgain,
  playAgainLabel,
  position,
  onNavigate,
  readOnly,
  readOnlyNote,
}: Props) {
  const t = useStore((s) => s.t)
  const [internal, setInternal] = useState<ViewerPos>({ book: 0, page: -1 })
  const pos = position ?? internal
  const setPos = (p: ViewerPos) => (position ? onNavigate?.(p) : setInternal(p))

  // flip direction derived from previous position
  const prevPos = useRef(pos)
  const dir = cmp(pos, prevPos.current) >= 0 ? 1 : -1
  useEffect(() => {
    prevPos.current = pos
  })

  const bookIdx = Math.min(pos.book, game.books.length - 1)
  const book = game.books[bookIdx]
  const pageIdx = Math.min(pos.page, book.pages.length)
  const owner = playerById(game, book.ownerId)
  const lastBook = bookIdx === game.books.length - 1
  const atSummary = pageIdx === book.pages.length
  const atStart = bookIdx === 0 && pageIdx === -1

  const next = () => {
    if (!atSummary) setPos({ book: bookIdx, page: pageIdx + 1 })
    else if (!lastBook) setPos({ book: bookIdx + 1, page: -1 })
  }
  const prev = () => {
    if (pageIdx > -1) setPos({ book: bookIdx, page: pageIdx - 1 })
    else if (bookIdx > 0) setPos({ book: bookIdx - 1, page: game.books[bookIdx - 1].pages.length })
  }

  const nav = useRef({ next, prev, readOnly })
  nav.current = { next, prev, readOnly }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (nav.current.readOnly || tag === 'INPUT') return
      // Space on a focused button already clicks it: handling it here too would flip twice
      if (e.key === ' ' && tag === 'BUTTON') return
      if (e.key === 'ArrowRight' || e.key === ' ') nav.current.next()
      if (e.key === 'ArrowLeft') nav.current.prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const swipe = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s || readOnly) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)()
  }

  const firstText = book.pages[0]?.text ?? ''
  const lastText = [...book.pages].reverse().find((p) => p.kind !== 'drawing')?.text
  const lastPage = book.pages[book.pages.length - 1]

  return (
    <div className="screen viewer">
      <header className="topbar">
        <button className="btn btn-icon" onClick={onExit} aria-label={exitLabel}>
          <Icon name="close" />
        </button>
        <div className="book-dots">
          {game.books.map((b, i) => (
            <button
              key={b.ownerId}
              className={`book-dot ${i === bookIdx ? 'book-dot-on' : ''}`}
              style={{ background: playerById(game, b.ownerId)?.color }}
              disabled={readOnly}
              onClick={() => setPos({ book: i, page: -1 })}
              aria-label={t('bookOf', { name: playerById(game, b.ownerId)?.name ?? '' })}
            />
          ))}
        </div>
        <span />
      </header>

      <div className="viewer-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div key={`${bookIdx}:${pageIdx}`} className={`book-page card ${dir === 1 ? 'flip-next' : 'flip-prev'}`}>
          {pageIdx === -1 && (
            <div className="book-cover" style={{ ['--owner' as string]: owner?.color }}>
              <div className="big-emoji">📖</div>
              <h1>{t('bookOf', { name: owner?.name ?? '?' })}</h1>
              <p className="muted">{book.pages.length} ✏️</p>
            </div>
          )}
          {pageIdx >= 0 && !atSummary && <PageView game={game} page={book.pages[pageIdx]} />}
          {atSummary && (
            <div className="book-summary">
              <p className="muted">{t('startedAs')}</p>
              <p className="summary-word">{firstText}</p>
              <div className="summary-arrow">⬇</div>
              <p className="muted">{t('endedAs')}</p>
              {lastPage?.kind === 'drawing' && lastPage.image ? (
                <img className="summary-img" src={lastPage.image} alt="" />
              ) : (
                <p className="summary-word">{lastText || t('nothing')}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="bottombar viewer-controls">
        {readOnly ? (
          <p className="viewer-note">{readOnlyNote}</p>
        ) : (
          <>
            <button className="btn" onClick={prev} disabled={atStart}>
              <Icon name="back" /> {t('prevPage')}
            </button>
            {atSummary && lastBook ? (
              <div className="viewer-end">
                {onPlayAgain && (
                  <button className="btn" onClick={onPlayAgain}>
                    {playAgainLabel ?? t('playAgain')}
                  </button>
                )}
                <button className="btn btn-primary" onClick={onExit}>
                  {exitLabel}
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={next}>
                {atSummary ? t('nextBook') : t('nextPage')} <Icon name="next" />
              </button>
            )}
          </>
        )}
      </footer>
    </div>
  )
}

function PageView({ game, page }: { game: Game; page: Page }) {
  const t = useStore((s) => s.t)
  const author = playerById(game, page.authorId)
  const name = author?.name ?? '?'
  const label =
    page.kind === 'word' ? t('chose', { name }) : page.kind === 'drawing' ? t('drewThis', { name }) : t('guessedThis', { name })
  return (
    <div className={`page-view page-${page.kind}`}>
      <p className="page-author" style={{ color: author?.color }}>
        {label}
      </p>
      {page.kind === 'drawing' && page.image ? (
        <img className="page-img" src={page.image} alt="" draggable={false} />
      ) : (
        <p className="page-text">{page.text || t('nothing')}</p>
      )}
      {page.timedOut && <p className="muted small">{t('timedOut')}</p>}
    </div>
  )
}
