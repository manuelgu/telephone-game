import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { ROOM_CODE_LENGTH, normalizeCode } from '../../shared/protocol'
import { savedName, useOnline } from '../../online/onlineStore'
import { useStore } from '../../store/store'

export function OnlineEntry() {
  const { t, go, lang, joinCode, setJoinCode } = useStore()
  const { host, join, error, clearError } = useOnline()
  const [name, setName] = useState(savedName())
  const [code, setCode] = useState(joinCode)
  const [busy, setBusy] = useState(false)
  const [nameMissing, setNameMissing] = useState(false)

  const run = async (fn: () => Promise<boolean>) => {
    if (!name.trim()) {
      setNameMissing(true)
      return
    }
    setBusy(true)
    const ok = await fn()
    setBusy(false)
    if (ok) {
      setJoinCode('')
      go('room')
    }
  }

  const joinFirst = !!joinCode
  const codeOk = code.length === ROOM_CODE_LENGTH

  const hostCard = (
    <section className="card section">
      <h2>{t('hostGame')}</h2>
      <p className="hint">{t('hostGameSub')}</p>
      <button className="btn btn-primary btn-wide" disabled={busy} onClick={() => run(() => host(name, lang))}>
        <Icon name="plus" /> {t('createRoom')}
      </button>
    </section>
  )

  const joinCard = (
    <section className="card section">
      <h2>{t('joinGame')}</h2>
      <p className="hint">{t('joinGameSub')}</p>
      <form
        className="own-word"
        onSubmit={(e) => {
          e.preventDefault()
          if (codeOk && !busy) void run(() => join(code, name))
        }}
      >
        <input
          className="input code-input"
          value={code}
          placeholder="ABCDE"
          aria-label={t('roomCode')}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          onChange={(e) => {
            clearError()
            setCode(normalizeCode(e.target.value))
          }}
        />
        <button className={`btn ${joinFirst ? 'btn-primary' : ''}`} type="submit" disabled={busy || !codeOk}>
          {t('join')}
        </button>
      </form>
    </section>
  )

  return (
    <div className="screen">
      <header className="topbar">
        <button
          className="btn btn-icon"
          onClick={() => {
            clearError()
            setJoinCode('')
            go('home')
          }}
          aria-label={t('back')}
        >
          <Icon name="back" />
        </button>
        <h1>{t('playOnline')}</h1>
        <span />
      </header>
      <div className="scroll">
        <section className="card section">
          <h2>{t('yourName')}</h2>
          <input
            className={`input input-big ${nameMissing && !name.trim() ? 'input-error' : ''}`}
            value={name}
            maxLength={20}
            placeholder={t('yourName')}
            autoComplete="nickname"
            autoCapitalize="words"
            onChange={(e) => {
              setNameMissing(false)
              clearError()
              setName(e.target.value)
            }}
          />
          {nameMissing && !name.trim() && <p className="error">{t.dict.errors.name_required}</p>}
        </section>
        {error && <p className="error card section">{t.dict.errors[error] ?? error}</p>}
        {joinFirst ? (
          <>
            {joinCard}
            {hostCard}
          </>
        ) : (
          <>
            {hostCard}
            {joinCard}
          </>
        )}
      </div>
    </div>
  )
}
