import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Confirm } from '../components/Modal'
import { useWakeLock } from '../components/hooks'
import { currentTurn, totalTurns, turnNumber } from '../game/logic'
import { useStore } from '../store/store'
import { BookViewer } from './BookViewer'
import { DrawTurn } from './turns/DrawTurn'
import { GuessTurn } from './turns/GuessTurn'
import { Handoff } from './turns/Handoff'
import { WordPick } from './turns/WordPick'

export function GameScreen() {
  const { t, game, submit, go, quitGame, finishGame, startGame, markDealt } = useStore()
  const [phase, setPhase] = useState<'handoff' | 'turn' | 'reveal'>('handoff')
  const [confirmQuit, setConfirmQuit] = useState(false)
  useWakeLock(true)

  if (!game) return null

  if (game.status !== 'playing') {
    if (phase !== 'reveal') {
      return (
        <div className="screen center">
          <div className="card section all-done">
            <div className="big-emoji">📚</div>
            <h1>{t('allDone')}</h1>
            <p className="hint">{t('revealIntro')}</p>
            <button className="btn btn-primary btn-big" onClick={() => setPhase('reveal')}>
              {t('startReveal')}
            </button>
          </div>
        </div>
      )
    }
    return (
      <BookViewer
        game={game}
        onExit={finishGame}
        exitLabel={t('finish')}
        onPlayAgain={() => {
          const { players, settings } = game
          finishGame()
          startGame(players, settings)
          setPhase('handoff')
        }}
      />
    )
  }

  const turn = currentTurn(game)!
  const doneTurns = turnNumber(game)
  const total = totalTurns(game)
  const key = `${game.step}-${game.cursor}`

  const handleSubmit = (page: { text?: string; image?: string; timedOut?: boolean }) => {
    submit(page)
    setPhase('handoff')
  }

  return (
    <div className="screen game">
      <header className="topbar game-top">
        <button className="btn btn-icon" onClick={() => setConfirmQuit(true)} aria-label={t('menu')}>
          <Icon name="close" />
        </button>
        <div className="progress" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${(doneTurns / total) * 100}%` }} />
        </div>
        {phase === 'turn' ? (
          <span className="player-chip" style={{ background: turn.player.color }}>
            {turn.player.name}
          </span>
        ) : (
          <button className="btn btn-icon" onClick={() => go('home')} aria-label={t('home')}>
            <Icon name="home" />
          </button>
        )}
      </header>

      {phase === 'handoff' && (
        <Handoff player={turn.player} turn={doneTurns + 1} total={total} onReady={() => setPhase('turn')} />
      )}

      {phase === 'turn' && turn.kind === 'word' && (
        <WordPick
          key={key}
          lang={game.settings.lang}
          exclude={game.dealt}
          onDealt={markDealt}
          onSubmit={(w) => handleSubmit({ text: w })}
        />
      )}
      {phase === 'turn' && turn.kind === 'drawing' && (
        <DrawTurn
          key={key}
          prompt={turn.previous?.text ?? ''}
          timer={game.settings.timer}
          onSubmit={(image, timedOut) => handleSubmit({ image, timedOut })}
        />
      )}
      {phase === 'turn' && turn.kind === 'guess' && (
        <GuessTurn
          key={key}
          image={turn.previous?.image}
          timer={game.settings.timer}
          onSubmit={(text, timedOut) => handleSubmit({ text, timedOut })}
        />
      )}

      {confirmQuit && (
        <Confirm
          title={t('abandonGame')}
          confirmLabel={t('quit')}
          cancelLabel={t('cancel')}
          danger
          onCancel={() => setConfirmQuit(false)}
          onConfirm={quitGame}
        >
          {t('abandonHint')}
        </Confirm>
      )}
    </div>
  )
}
