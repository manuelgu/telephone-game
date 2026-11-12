import { Icon } from './Icon'

/** Label for a timer setting in seconds (0 = off). */
export function timerLabel(s: number, off: string) {
  if (s === 0) return off
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}${s % 60 ? `:${String(s % 60).padStart(2, '0')}` : ''} min`
}

export function TimerBadge({ remaining }: { remaining: number | null }) {
  if (remaining === null) return null
  const m = Math.floor(remaining / 60)
  const s = String(remaining % 60).padStart(2, '0')
  const urgent = remaining <= 10
  return (
    <div className={`timer ${urgent ? 'timer-urgent' : ''}`} role="timer" aria-live={urgent ? 'polite' : 'off'}>
      <Icon name="clock" size={18} />
      <span>
        {m}:{s}
      </span>
    </div>
  )
}
