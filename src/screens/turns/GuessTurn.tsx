import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { TimerBadge } from '../../components/TimerBadge'
import { useCountdown } from '../../components/hooks'
import { useStore } from '../../store/store'

interface Props {
  image?: string
  timer: number
  onSubmit: (text: string, timedOut: boolean) => void
}

export function GuessTurn({ image, timer, onSubmit }: Props) {
  const t = useStore((s) => s.t)
  const [text, setText] = useState('')
  const textRef = useRef(text)
  textRef.current = text
  const submitted = useRef(false)

  const finish = (timedOut: boolean) => {
    if (submitted.current) return
    submitted.current = true
    onSubmit(textRef.current.trim(), timedOut)
  }
  const remaining = useCountdown(timer, () => finish(true))

  return (
    <div className="turn-body guess-turn">
      <div className="guess-head">
        <h2 className="turn-title">{t('stepGuess')}</h2>
        <TimerBadge remaining={remaining} />
      </div>
      <div className="guess-image card">
        {image ? <img src={image} alt="" draggable={false} /> : <div className="empty">{t('nothing')}</div>}
      </div>
      <form
        className="own-word"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) finish(false)
        }}
      >
        <input
          className="input input-big"
          value={text}
          maxLength={80}
          placeholder={t('yourGuess')}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}>
          <Icon name="check" /> {t('submit')}
        </button>
      </form>
    </div>
  )
}
