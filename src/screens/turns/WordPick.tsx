import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { TimerBadge } from '../../components/TimerBadge'
import { useCountdown } from '../../components/hooks'
import { dealWords } from '../../i18n/words'
import type { Lang } from '../../game/types'
import { useStore } from '../../store/store'

const CARDS = 4

interface Props {
  lang: Lang
  exclude?: string[]
  onDealt?: (words: string[]) => void
  /** seconds left, 0 = untimed. On expiry the typed word (or the first card) is submitted. */
  timer?: number
  onSubmit: (word: string, timedOut: boolean) => void
}

export function WordPick({ lang, exclude = [], onDealt, timer = 0, onSubmit }: Props) {
  const t = useStore((s) => s.t)
  const [cards, setCards] = useState<string[]>([])
  const [own, setOwn] = useState('')
  const [reshuffled, setReshuffled] = useState(false)
  const submitted = useRef(false)

  const pick = (word: string, timedOut = false) => {
    if (submitted.current || !word) return
    submitted.current = true
    onSubmit(word, timedOut)
  }

  const deal = () => {
    const words = dealWords(lang, CARDS, exclude)
    setCards(words)
    onDealt?.(words)
  }

  // deal once per mount (the ref survives StrictMode's effect re-run, which would deal and mark twice)
  const dealtOnce = useRef(false)
  useEffect(() => {
    if (dealtOnce.current) return
    dealtOnce.current = true
    deal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitOwn = () => pick(own.trim())

  const remaining = useCountdown(timer, () => pick(own.trim() || cards[0], true))

  return (
    <div className="turn-body word-pick">
      <h2 className="turn-title">{t('stepWord')}</h2>
      <TimerBadge remaining={remaining} />
      <p className="hint">{t('pickOne')}</p>
      <div className="word-cards">
        {cards.map((w, i) => (
          <button key={w} className="word-card" style={{ ['--tilt' as string]: `${(i % 2 ? 1 : -1) * (1 + i * 0.4)}deg` }} onClick={() => pick(w)}>
            {w}
          </button>
        ))}
      </div>
      {!reshuffled && (
        <button
          className="btn"
          onClick={() => {
            setReshuffled(true)
            deal()
          }}
        >
          <Icon name="shuffle" /> {t('shuffle')}
        </button>
      )}
      <form
        className="own-word"
        onSubmit={(e) => {
          e.preventDefault()
          submitOwn()
        }}
      >
        <input
          className="input"
          value={own}
          maxLength={60}
          placeholder={t('ownWord')}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setOwn(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={!own.trim()}>
          {t('use')}
        </button>
      </form>
    </div>
  )
}
