import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { BookLengthPicker } from '../../components/BookLengthPicker'
import { Icon } from '../../components/Icon'
import { StylePicker } from '../../components/StylePicker'
import { timerLabel } from '../../components/TimerBadge'
import type { Lang } from '../../game/types'
import { LANG_LABELS } from '../../i18n/strings'
import { useOnline } from '../../online/onlineStore'
import { TIMER_OPTIONS, type PublicRoom } from '../../shared/protocol'
import { useStore } from '../../store/store'

export function Lobby({ room, you, onLeave }: { room: PublicRoom; you: string; onLeave: () => void }) {
  const t = useStore((s) => s.t)
  const send = useOnline((s) => s.send)
  const isHost = room.effectiveHostId === you
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const joinUrl = `${location.origin}/?join=${room.code}`
  const n = room.players.length

  useEffect(() => {
    QRCode.toString(joinUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2b2118', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [joinUrl])

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: t('appName'), text: `${t('joinGame')}: ${room.code}`, url: joinUrl })
        return
      }
    } catch {
      return // user cancelled
    }
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const setSettings = (settings: Partial<PublicRoom['settings']>) => send({ t: 'settings', settings })

  return (
    <div className="screen">
      <header className="topbar">
        <button className="btn btn-icon" onClick={onLeave} aria-label={t('leaveRoom')}>
          <Icon name="back" />
        </button>
        <h1>{t('inviteTitle')}</h1>
        <span />
      </header>

      <div className="scroll lobby">
        <section className="card section invite">
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code" />
          <div className="invite-info">
            <p className="muted">{t('roomCode')}</p>
            <div className="room-code">{room.code}</div>
            <p className="hint">{t('scanToJoin', { host: location.host })}</p>
            <button className="btn" onClick={share}>
              <Icon name="share" /> {copied ? t('copied') : t('shareLink')}
            </button>
          </div>
        </section>

        <section className="card section">
          <h2>{t('gameStyle')}</h2>
          <StylePicker
            value={room.settings.style ?? 'books'}
            onChange={(style) => setSettings({ style })}
            firstName={room.players[0]?.name}
            disabled={!isHost}
          />
        </section>

        <section className="card section">
          <h2>
            {t('players')} <span className="muted">({n})</span>
          </h2>
          <ul className="lobby-players">
            {room.players.map((p) => (
              <li key={p.id} className={p.connected ? '' : 'offline'}>
                <span className="seat" style={{ background: p.color }}>
                  {(Array.from(p.name)[0] ?? '').toUpperCase()}
                </span>
                <span className="lobby-name">
                  {p.name}
                  {p.id === you && <span className="muted"> ({t('you')})</span>}
                </span>
                {p.id === room.effectiveHostId && <span className="badge">{t('hostBadge')}</span>}
                {!p.connected && <span className="badge badge-muted">{t('offline')}</span>}
                {isHost && p.id !== you && (
                  <button
                    className="btn btn-icon btn-small"
                    onClick={() => send({ t: 'kick', playerId: p.id })}
                    aria-label={t('delete')}
                  >
                    <Icon name="close" size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card section">
          <h2>{t('timer')}</h2>
          <div className="chips">
            {TIMER_OPTIONS.map((s) => (
              <button
                key={s}
                className={`chip ${room.settings.timer === s ? 'chip-on' : ''}`}
                disabled={!isHost}
                onClick={() => setSettings({ timer: s })}
              >
                {timerLabel(s, t('timerOff'))}
              </button>
            ))}
          </div>

          <h2 className="mt">{t('bookLength')}</h2>
          <BookLengthPicker n={n} turns={room.settings.turns} onChange={(turns) => setSettings({ turns })} disabled={!isHost} />

          <h2 className="mt">{t('wordLanguage')}</h2>
          <div className="chips">
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <button
                key={l}
                className={`chip ${room.settings.lang === l ? 'chip-on' : ''}`}
                disabled={!isHost}
                onClick={() => setSettings({ lang: l })}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </section>
      </div>

      <footer className="bottombar">
        {isHost ? (
          <button className="btn btn-primary btn-big btn-wide" disabled={n < 2} onClick={() => send({ t: 'start' })}>
            {n < 2 ? t('needTwo') : t('start')} <Icon name="next" />
          </button>
        ) : (
          <p className="waiting-host">⏳ {t('waitingForHost')}</p>
        )}
      </footer>
    </div>
  )
}
