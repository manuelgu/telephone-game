import { useState } from 'react'
import { Icon } from '../components/Icon'
import { useStore } from '../store/store'

type Mode = 'pass' | 'online'

const STEP_COLORS = ['#e8553d', '#3b82c4', '#f2b632', '#3fa66b', '#9b5fc0']

export function HowTo() {
  const { t, go } = useStore()
  const [mode, setMode] = useState<Mode>('pass')

  return (
    <div className="screen">
      <header className="topbar">
        <button className="btn btn-icon" onClick={() => go('home')} aria-label={t('back')}>
          <Icon name="back" />
        </button>
        <h1>{t('howToPlay')}</h1>
        <span />
      </header>
      <div className="scroll">
        <div className="chips howto-modes" role="tablist" aria-label={t('howToPlay')}>
          {(['pass', 'online'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={`chip ${mode === m ? 'chip-on' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'pass' ? `📱 ${t('passAndPlay')}` : `🌐 ${t('playOnline')}`}
            </button>
          ))}
        </div>
        <p className="hint howto-mode-sub">{mode === 'pass' ? t('passAndPlaySub') : t('playOnlineSub')}</p>
        <ol className="howto card section" role="tabpanel">
          {t.dict.howToSteps[mode].map((s, i) => (
            <li key={i}>
              <span className="seat" style={{ background: STEP_COLORS[i % STEP_COLORS.length] }}>
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <p className="card section hint">✏️ {t('tipPencil')}</p>
      </div>
      <footer className="bottombar">
        <button className="btn btn-primary btn-big btn-wide" onClick={() => go(mode === 'pass' ? 'setup' : 'online')}>
          {mode === 'pass' ? t('newGame') : t('playOnline')}
        </button>
      </footer>
    </div>
  )
}
