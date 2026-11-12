import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Confirm } from '../../components/Modal'
import { TimerBadge } from '../../components/TimerBadge'
import { useCountdown, useWakeLock } from '../../components/hooks'
import { actorsForStep, isChain, pageKindForStep } from '../../game/logic'
import { serverNow, useOnline } from '../../online/onlineStore'
import type { PublicRoom, TurnInfo } from '../../shared/protocol'
import { useStore } from '../../store/store'
import { DrawTurn } from '../turns/DrawTurn'
import { GuessTurn } from '../turns/GuessTurn'
import { WordPick } from '../turns/WordPick'

const secondsLeft = (endsAt: number | null) =>
  endsAt ? Math.max(1, Math.ceil((endsAt - serverNow()) / 1000)) : 0

export function OnlinePlay({ room, you, onLeave }: { room: PublicRoom; you: string; onLeave: () => void }) {
  const t = useStore((s) => s.t)
  const { turn, submit: submitPage } = useOnline()
  const [confirmLeave, setConfirmLeave] = useState(false)
  useWakeLock(true)

  const me = room.players.find((p) => p.id === you)
  const activeTurn = turn && turn.step === room.step && !room.submitted.includes(you) ? turn : null
  const actors = actorsForStep(room.settings.style, room.step, room.players.length).length
  const progress = (room.step + Math.min(1, room.submitted.length / Math.max(1, actors))) / (room.totalSteps + 1)

  const submit = (turnInfo: TurnInfo, page: { text?: string; image?: string; timedOut?: boolean }) => {
    submitPage({ t: 'submit', step: turnInfo.step, ...page })
  }

  return (
    <div className="screen game">
      <header className="topbar game-top">
        <button className="btn btn-icon" onClick={() => setConfirmLeave(true)} aria-label={t('leaveRoom')}>
          <Icon name="close" />
        </button>
        <div className="progress" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        {me && (
          <span className="player-chip" style={{ background: me.color }}>
            {me.name}
          </span>
        )}
      </header>

      {activeTurn?.kind === 'word' && (
        <WordPick
          key={`s${activeTurn.step}`}
          lang={room.settings.lang}
          timer={secondsLeft(room.stepEndsAt)}
          onSubmit={(text, timedOut) => submit(activeTurn, { text, timedOut })}
        />
      )}
      {activeTurn?.kind === 'drawing' && (
        <DrawTurn
          key={`s${activeTurn.step}`}
          prompt={activeTurn.previous?.text ?? ''}
          timer={secondsLeft(room.stepEndsAt)}
          onSubmit={(image, timedOut) => submit(activeTurn, { image, timedOut })}
        />
      )}
      {activeTurn?.kind === 'guess' && (
        <GuessTurn
          key={`s${activeTurn.step}`}
          image={activeTurn.previous?.image}
          timer={secondsLeft(room.stepEndsAt)}
          onSubmit={(text, timedOut) => submit(activeTurn, { text, timedOut })}
        />
      )}
      {!activeTurn && <Waiting key={`w${room.step}`} room={room} you={you} />}

      {confirmLeave && (
        <Confirm
          title={t('leaveRoom')}
          confirmLabel={t('quit')}
          cancelLabel={t('cancel')}
          danger
          onCancel={() => setConfirmLeave(false)}
          onConfirm={onLeave}
        />
      )}
    </div>
  )
}

function Waiting({ room, you }: { room: PublicRoom; you: string }) {
  const t = useStore((s) => s.t)
  const send = useOnline((s) => s.send)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const remaining = useCountdown(secondsLeft(room.stepEndsAt), () => {})
  const isHost = room.effectiveHostId === you
  const n = room.players.length
  const chain = isChain(room.settings.style)
  const actorIds = actorsForStep(room.settings.style, room.step, n).map((i) => room.players[i].id)
  const waiting = room.players.filter((p) => actorIds.includes(p.id) && !room.submitted.includes(p.id))

  // chain mode: say who is playing right now and who's next
  const current = chain ? room.players[room.step % n] : undefined
  const next = chain && room.step + 1 <= room.totalSteps ? room.players[(room.step + 1) % n] : undefined
  const kind = pageKindForStep(room.step)
  const heading = current
    ? t(kind === 'word' ? 'waitWord' : kind === 'drawing' ? 'waitDraw' : 'waitGuess', { name: current.name })
    : t('submittedWait')

  return (
    <div className="handoff waiting">
      <p className="handoff-progress">{t('stepOf', { a: room.step + 1, b: room.totalSteps + 1 })}</p>
      <div className="big-emoji bounce">{chain && kind === 'drawing' ? '🎨' : chain ? '🤔' : '✏️'}</div>
      <h2>{heading}</h2>
      {next && <p className="hint">{next.id === you ? t('youreNext') : t('upNext', { name: next.name })}</p>}
      <TimerBadge remaining={remaining} />
      {!chain && waiting.length > 0 && (
        <>
          <p className="muted">{t('waitingFor')}</p>
          <ul className="waiting-list">
            {waiting.map((p) => (
              <li key={p.id} style={{ background: p.color }} className={p.connected ? '' : 'offline'}>
                {p.name}
                {!p.connected && ` · ${t('offline')}`}
              </li>
            ))}
          </ul>
        </>
      )}
      {isHost && waiting.length > 0 && (
        <button className="btn" onClick={() => setConfirmSkip(true)}>
          {t('skipWaiting')}
        </button>
      )}
      {confirmSkip && (
        <Confirm
          title={t('skipWaiting')}
          confirmLabel={t('skip')}
          cancelLabel={t('cancel')}
          danger
          onCancel={() => setConfirmSkip(false)}
          onConfirm={() => {
            setConfirmSkip(false)
            send({ t: 'skipWaiting', step: room.step })
          }}
        >
          {t('skipConfirm')}
        </Confirm>
      )}
    </div>
  )
}
