import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { roomToGame, useOnline } from '../../online/onlineStore'
import { useStore } from '../../store/store'
import { BookViewer } from '../BookViewer'
import { Lobby } from './Lobby'
import { OnlinePlay } from './OnlinePlay'

const FATAL_BEFORE_JOIN = new Set(['room_not_found', 'game_started', 'room_full', 'kicked', 'network'])

export function RoomScreen() {
  const { t, go } = useStore()
  const { room, you, conn, error, leave, send, retryWithName, clearError, code } = useOnline()
  const [name, setName] = useState('')

  const exit = () => {
    leave()
    go('home')
  }

  // transient errors (e.g. not_host) fade away; fatal ones (e.g. kicked) must stay on screen
  useEffect(() => {
    if (!error || !you || FATAL_BEFORE_JOIN.has(error)) return
    const id = setTimeout(clearError, 3000)
    return () => clearTimeout(id)
  }, [error, you, clearError])

  const game = useMemo(() => (room?.books ? roomToGame(room) : null), [room])

  if (!code) {
    return (
      <div className="screen center">
        <button className="btn btn-primary" onClick={() => go('home')}>
          {t('home')}
        </button>
      </div>
    )
  }

  // Fatal / pre-join errors
  if (error && (!you || FATAL_BEFORE_JOIN.has(error))) {
    const needsName = error === 'name_required' || error === 'name_taken'
    return (
      <div className="screen center">
        <div className="card section all-done">
          <div className="big-emoji">{needsName ? '👋' : '😕'}</div>
          <p className="error">{t.dict.errors[error] ?? error}</p>
          {needsName && (
            <form
              className="own-word"
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim()) retryWithName(name)
              }}
            >
              <input
                className="input"
                value={name}
                maxLength={20}
                placeholder={t('yourName')}
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
                {t('join')}
              </button>
            </form>
          )}
          <button className="btn" onClick={exit}>
            <Icon name="home" /> {t('home')}
          </button>
        </div>
      </div>
    )
  }

  if (!room || !you) {
    return (
      <div className="screen center">
        <div className="big-emoji bounce">📡</div>
        <p>{conn === 'reconnecting' ? t('reconnecting') : t('connecting')}</p>
        <button className="btn" onClick={exit}>
          {t('cancel')}
        </button>
      </div>
    )
  }

  const isHost = room.effectiveHostId === you
  const hostName = room.players.find((p) => p.id === room.effectiveHostId)?.name ?? ''

  let content
  if (room.status === 'lobby') content = <Lobby room={room} you={you} onLeave={exit} />
  else if (room.status === 'playing') content = <OnlinePlay room={room} you={you} onLeave={exit} />
  else if (room.status === 'reveal' && game)
    content = (
      <BookViewer
        game={game}
        position={room.reveal}
        onNavigate={(pos) => send({ t: 'reveal', pos })}
        readOnly={!isHost}
        readOnlyNote={<>📖 {t('hostFlipping', { name: hostName })}</>}
        onExit={isHost ? () => send({ t: 'finish' }) : exit}
        exitLabel={isHost ? t('finish') : t('leaveRoom')}
        onPlayAgain={isHost ? () => send({ t: 'playAgain' }) : undefined}
        playAgainLabel={t('backToLobby')}
      />
    )
  else if (game)
    content = (
      <BookViewer
        key="done"
        game={game}
        onExit={exit}
        exitLabel={t('home')}
        onPlayAgain={isHost ? () => send({ t: 'playAgain' }) : undefined}
        playAgainLabel={t('backToLobby')}
      />
    )

  return (
    <>
      {content}
      {conn !== 'open' && <div className="conn-banner">📡 {t('reconnecting')}</div>}
      {error && you && <div className="toast">{t.dict.errors[error] ?? error}</div>}
    </>
  )
}
