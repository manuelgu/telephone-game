import type { GameStyle } from '../game/types'
import { useStore } from '../store/store'

interface Props {
  value: GameStyle
  onChange: (s: GameStyle) => void
  /** name of the player who starts a chain (first in the list) */
  firstName?: string
  disabled?: boolean
}

export function StylePicker({ value, onChange, firstName, disabled }: Props) {
  const t = useStore((s) => s.t)
  const options: { key: GameStyle; emoji: string; title: string; sub: string }[] = [
    { key: 'books', emoji: '📚', title: t('styleBooks'), sub: t('styleBooksSub') },
    {
      key: 'chain',
      emoji: '⛓️',
      title: t('styleChain'),
      sub: t('styleChainSub', { name: firstName?.trim() || t('firstPlayer') }),
    },
  ]
  return (
    <div className="style-picker" role="radiogroup" aria-label={t('gameStyle')}>
      {options.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={value === o.key}
          className={`style-option ${value === o.key ? 'style-on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(o.key)}
        >
          <span className="style-emoji">{o.emoji}</span>
          <span className="style-title">{o.title}</span>
          <span className="style-sub">{o.sub}</span>
        </button>
      ))}
    </div>
  )
}
