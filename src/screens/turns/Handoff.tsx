import type { Player } from '../../game/types'
import { useStore } from '../../store/store'

interface Props {
  player: Player
  turn: number
  total: number
  onReady: () => void
}

export function Handoff({ player, turn, total, onReady }: Props) {
  const t = useStore((s) => s.t)
  return (
    <div className="handoff">
      <p className="handoff-progress">{t('turnOf', { a: turn, b: total })}</p>
      <p className="handoff-label">{t('passTo')}</p>
      <div className="handoff-name" style={{ color: player.color }}>
        {player.name}
      </div>
      <p className="hint">🙈 {t('noPeeking', { name: player.name })}</p>
      <button className="btn btn-primary btn-big" style={{ background: player.color }} onClick={onReady}>
        {t('imReady', { name: player.name })}
      </button>
    </div>
  )
}
