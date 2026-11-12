import { useState } from 'react'
import { BookLengthPicker } from '../components/BookLengthPicker'
import { Icon } from '../components/Icon'
import { StylePicker } from '../components/StylePicker'
import { timerLabel } from '../components/TimerBadge'
import { MIN_PLAYERS, PLAYER_COLORS, uid } from '../game/logic'
import type { GameStyle, Player } from '../game/types'
import { useStore } from '../store/store'
import { TIMER_OPTIONS, resolveTotalSteps } from '../shared/protocol'


export function Setup() {
  const { t, lang, go, setup, saveSetup, startGame } = useStore()
  const [names, setNames] = useState<string[]>(setup.names.length >= MIN_PLAYERS ? setup.names : ['', '', ''])
  const [timer, setTimer] = useState(setup.timer)
  const [turns, setTurns] = useState<number | 'full'>(setup.turns)
  const [style, setStyle] = useState<GameStyle>(setup.style ?? 'books')
  const [error, setError] = useState('')

  const resolved = names.map((n, i) => n.trim() || t('playerPlaceholder', { n: i + 1 }))
  const n = names.length
  const effectiveTurns = resolveTotalSteps(turns === 'full' ? 0 : turns, n)

  const update = (i: number, v: string) => setNames((arr) => arr.map((x, j) => (j === i ? v : x)))
  const remove = (i: number) => setNames((arr) => arr.filter((_, j) => j !== i))
  const move = (i: number, d: -1 | 1) =>
    setNames((arr) => {
      const j = i + d
      if (j < 0 || j >= arr.length) return arr
      const c = [...arr]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })

  const start = () => {
    if (n < MIN_PLAYERS) return setError(t('needPlayers'))
    const lower = resolved.map((x) => x.toLowerCase())
    if (new Set(lower).size !== lower.length) return setError(t('duplicateNames'))
    saveSetup({ names, timer, turns, style })
    const players: Player[] = resolved.map((name, i) => ({
      id: uid(),
      name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    }))
    startGame(players, { timer, turns: effectiveTurns, lang, style })
  }

  return (
    <div className="screen setup">
      <header className="topbar">
        <button className="btn btn-icon" onClick={() => go('home')} aria-label={t('back')}>
          <Icon name="back" />
        </button>
        <h1>{t('newGame')}</h1>
        <span />
      </header>

      <div className="scroll">
        <section className="card section">
          <h2>{t('gameStyle')}</h2>
          <StylePicker value={style} onChange={setStyle} firstName={resolved[0]} />
        </section>

        <section className="card section">
          <h2>
            {t('players')} <span className="muted">({n})</span>
          </h2>
          <p className="hint">{t('seatingHint')}</p>
          <ol className="player-list">
            {names.map((name, i) => (
              <li key={i} className="player-row">
                <span className="seat" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}>
                  {i + 1}
                </span>
                <input
                  className="input"
                  value={name}
                  placeholder={t('playerPlaceholder', { n: i + 1 })}
                  maxLength={20}
                  enterKeyHint="next"
                  autoCapitalize="words"
                  autoComplete="off"
                  onChange={(e) => {
                    setError('')
                    update(i, e.target.value)
                  }}
                />
                <button className="btn btn-icon btn-small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="up">
                  <Icon name="up" size={18} />
                </button>
                <button
                  className="btn btn-icon btn-small"
                  onClick={() => move(i, 1)}
                  disabled={i === n - 1}
                  aria-label="down"
                >
                  <Icon name="down" size={18} />
                </button>
                <button
                  className="btn btn-icon btn-small"
                  onClick={() => remove(i)}
                  disabled={n <= MIN_PLAYERS}
                  aria-label={t('delete')}
                >
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ol>
          <button className="btn" onClick={() => setNames((a) => [...a, ''])}>
            <Icon name="plus" /> {t('addPlayer')}
          </button>
        </section>

        <section className="card section">
          <h2>{t('timer')}</h2>
          <div className="chips">
            {TIMER_OPTIONS.map((s) => (
              <button key={s} className={`chip ${timer === s ? 'chip-on' : ''}`} onClick={() => setTimer(s)}>
                {timerLabel(s, t('timerOff'))}
              </button>
            ))}
          </div>
        </section>

        <section className="card section">
          <h2>{t('bookLength')}</h2>
          <BookLengthPicker
            n={n}
            turns={turns === 'full' ? 0 : turns}
            onChange={(v) => setTurns(v === 0 ? 'full' : v)}
          />
          <p className="hint">{t('bookLengthHint')}</p>
        </section>
      </div>

      <footer className="bottombar">
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-big btn-wide" onClick={start}>
          {t('start')} <Icon name="next" />
        </button>
      </footer>
    </div>
  )
}
