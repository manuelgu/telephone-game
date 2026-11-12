import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Confirm } from '../components/Modal'
import { useStore } from '../store/store'

export function History() {
  const { t, lang, go, history, openHistory, deleteHistory } = useStore()
  const [toDelete, setToDelete] = useState<string | null>(null)
  const fmt = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="screen">
      <header className="topbar">
        <button className="btn btn-icon" onClick={() => go('home')} aria-label={t('back')}>
          <Icon name="back" />
        </button>
        <h1>{t('history')}</h1>
        <span />
      </header>
      <div className="scroll">
        {history.length === 0 && <p className="card section empty">{t('noHistory')}</p>}
        {history.map((h) => (
          <div key={h.id} className="card section history-item">
            <button className="history-main" onClick={() => void openHistory(h.id)}>
              <div className="history-date">{fmt.format(h.createdAt)}</div>
              <div className="history-players">{h.players.join(' · ')}</div>
              <ul className="history-preview">
                {h.preview.slice(0, 3).map((p, i) => (
                  <li key={i}>
                    <strong>{p.start}</strong> → <em>{p.end || '…'}</em>
                  </li>
                ))}
                {h.preview.length > 3 && <li className="muted">+{h.preview.length - 3}</li>}
              </ul>
            </button>
            <button className="btn btn-icon" onClick={() => setToDelete(h.id)} aria-label={t('delete')}>
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </div>
      {toDelete && (
        <Confirm
          title={t('deleteConfirm')}
          confirmLabel={t('delete')}
          cancelLabel={t('cancel')}
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            void deleteHistory(toDelete)
            setToDelete(null)
          }}
        />
      )}
    </div>
  )
}
