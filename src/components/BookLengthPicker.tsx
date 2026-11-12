import { resolveTotalSteps } from '../shared/protocol'
import { useStore } from '../store/store'

interface Props {
  /** player count */
  n: number
  /** passes after the starting word, 0 = full circle */
  turns: number
  onChange: (turns: number) => void
  /** read-only (online, not the host): only shows the current setting */
  disabled?: boolean
}

/** "Full circle" chip plus a −/+ stepper for a shorter book. */
export function BookLengthPicker({ n, turns, onChange, disabled }: Props) {
  const t = useStore((s) => s.t)
  const effective = resolveTotalSteps(turns, n)
  // a stored length at or above the player count (e.g. after players left) is a full circle too
  const full = turns === 0 || effective >= n
  return (
    <div className="chips">
      <button className={`chip ${full ? 'chip-on' : ''}`} disabled={disabled} onClick={() => onChange(0)}>
        {t('fullCircle')} ({n})
      </button>
      {/* hidden for 2 players only while it is unused: a shorter length that is still set must stay visible */}
      {!disabled && (n > 2 || !full) && (
        <div className="stepper">
          <button className="btn btn-icon btn-small" onClick={() => onChange(Math.max(1, effective - 1))} aria-label="-">
            −
          </button>
          <span className={`chip ${!full ? 'chip-on' : ''}`}>{t('pagesAfterWord', { n: effective })}</span>
          <button
            className="btn btn-icon btn-small"
            onClick={() => {
              const v = effective + 1
              onChange(v >= n ? 0 : v)
            }}
            aria-label="+"
          >
            +
          </button>
        </div>
      )}
      {disabled && !full && <span className="chip chip-on">{t('pagesAfterWord', { n: effective })}</span>}
    </div>
  )
}
