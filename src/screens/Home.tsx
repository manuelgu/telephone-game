import { useState } from 'react'
import { Confirm } from '../components/Modal'
import { Icon } from '../components/Icon'
import type { Lang } from '../game/types'
import { LANG_LABELS } from '../i18n/strings'
import { lastRoom, useOnline } from '../online/onlineStore'
import { useStore } from '../store/store'

export function Home() {
  const { t, lang, setLang, go, game, quitGame } = useStore()
  const join = useOnline((s) => s.join)
  const [confirmNew, setConfirmNew] = useState(false)
  const rejoin = lastRoom()

  const startLocal = () => (game ? setConfirmNew(true) : go('setup'))

  return (
    <div className="screen home">
      <div className="home-hero">
        <img src="/icon.svg" alt="" className="home-logo" />
        <h1 className="title">{t('appName')}</h1>
        <p className="tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {rejoin && (
          <button
            className="btn btn-primary btn-big"
            onClick={async () => {
              if (await join(rejoin)) go('room')
              else go('online')
            }}
          >
            <Icon name="next" /> {t('rejoinRoom', { code: rejoin })}
          </button>
        )}
        {game && (
          <button className="btn btn-primary btn-big" onClick={() => go('game')}>
            <Icon name="book" /> {t('resumeGame')}
          </button>
        )}

        <button className="mode-card mode-online" onClick={() => go('online')}>
          <span className="mode-emoji">📱📱📱</span>
          <span className="mode-title">{t('playOnline')}</span>
          <span className="mode-sub">{t('playOnlineSub')}</span>
        </button>
        <button className="mode-card mode-local" onClick={startLocal}>
          <span className="mode-emoji">📱🔄</span>
          <span className="mode-title">{t('passAndPlay')}</span>
          <span className="mode-sub">{t('passAndPlaySub')}</span>
        </button>

        <div className="home-secondary">
          <button className="btn" onClick={() => go('history')}>
            <Icon name="book" /> {t('history')}
          </button>
          <button className="btn" onClick={() => go('howto')}>
            <Icon name="hand" /> {t('howToPlay')}
          </button>
        </div>
      </div>

      <div className="lang-switch" role="radiogroup" aria-label={t('language')}>
        {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
          <button
            key={l}
            role="radio"
            aria-checked={lang === l}
            className={`chip ${lang === l ? 'chip-on' : ''}`}
            onClick={() => setLang(l)}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      {confirmNew && (
        <Confirm
          title={t('abandonGame')}
          confirmLabel={t('newGame')}
          cancelLabel={t('cancel')}
          danger
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => {
            quitGame()
            go('setup')
          }}
        >
          {t('abandonHint')}
        </Confirm>
      )}
    </div>
  )
}
