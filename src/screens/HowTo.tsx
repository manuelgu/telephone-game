import { Icon } from '../components/Icon'
import { useStore } from '../store/store'

export function HowTo() {
  const { t, go } = useStore()
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
        <ol className="howto card section">
          {t.dict.howToSteps.map((s, i) => (
            <li key={i}>
              <span className="seat" style={{ background: ['#e8553d', '#3b82c4', '#f2b632', '#3fa66b', '#9b5fc0'][i] }}>
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <p className="card section hint">✏️ {t('tipPencil')}</p>
      </div>
      <footer className="bottombar">
        <button className="btn btn-primary btn-big btn-wide" onClick={() => go('setup')}>
          {t('newGame')}
        </button>
      </footer>
    </div>
  )
}
