import { useRef, useState } from 'react'
import { DrawingCanvas, type DrawingHandle } from '../../canvas/DrawingCanvas'
import type { Tool } from '../../canvas/engine'
import { Icon } from '../../components/Icon'
import { Confirm } from '../../components/Modal'
import { TimerBadge } from '../../components/TimerBadge'
import { useCountdown, useSquareFit } from '../../components/hooks'
import { useStore } from '../../store/store'

export const COLORS = [
  '#1f1a17', '#7a746e', '#ffffff', '#e8553d', '#f08a24', '#f2c632',
  '#3fa66b', '#3b82c4', '#6a4fc9', '#e07bb0', '#8d5a3b', '#f2c9a0',
]
export const SIZES = [4, 10, 22, 44]

interface Props {
  prompt: string
  timer: number
  onSubmit: (image: string, timedOut: boolean) => void
}

export function DrawTurn({ prompt, timer, onSubmit }: Props) {
  const t = useStore((s) => s.t)
  const canvas = useRef<DrawingHandle>(null)
  const area = useRef<HTMLDivElement>(null)
  const side = useSquareFit(area)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [penDetected, setPenDetected] = useState(false)
  const [fingerDraw, setFingerDraw] = useState(false)
  const [confirm, setConfirm] = useState<null | 'clear' | 'empty'>(null)
  const submitted = useRef(false)

  const finish = (timedOut: boolean) => {
    if (submitted.current || !canvas.current) return
    submitted.current = true
    onSubmit(canvas.current.exportImage(), timedOut)
  }

  const remaining = useCountdown(timer, () => finish(true))

  const done = () => {
    if (canvas.current?.isBlank()) setConfirm('empty')
    else finish(false)
  }

  const pickColor = (c: string) => {
    setColor(c)
    if (tool === 'eraser') setTool('pen')
  }

  return (
    <div className="draw-turn">
      <div className="prompt-bar">
        <div className="prompt">
          <span className="prompt-label">{t('stepDraw')}</span>
          <span className="prompt-text">{prompt || t('nothing')}</span>
        </div>
        <TimerBadge remaining={remaining} />
        <button className="btn btn-primary" onClick={done}>
          <Icon name="check" /> {t('done')}
        </button>
      </div>

      <div className="draw-main">
        <div className="canvas-area" ref={area}>
          <div className="canvas-frame" style={{ width: side, height: side }}>
            <DrawingCanvas
              ref={canvas}
              tool={tool}
              color={color}
              size={size}
              fingerDraw={fingerDraw}
              onPenDetected={() => setPenDetected(true)}
              onHistoryChange={(u, r) => {
                setCanUndo(u)
                setCanRedo(r)
              }}
            />
          </div>
        </div>

        <div className="toolbar">
          <div className="tool-group">
            {(['pen', 'eraser', 'fill'] as Tool[]).map((k) => (
              <button
                key={k}
                className={`tool ${tool === k ? 'tool-on' : ''}`}
                onClick={() => setTool(k)}
                aria-label={t(k)}
                aria-pressed={tool === k}
              >
                <Icon name={k} />
              </button>
            ))}
            <span className="tool-sep" />
            <button className="tool" onClick={() => canvas.current?.undo()} disabled={!canUndo} aria-label={t('undo')}>
              <Icon name="undo" />
            </button>
            <button className="tool" onClick={() => canvas.current?.redo()} disabled={!canRedo} aria-label={t('redo')}>
              <Icon name="redo" />
            </button>
            <button className="tool" onClick={() => setConfirm('clear')} disabled={!canUndo} aria-label={t('clear')}>
              <Icon name="trash" />
            </button>
          </div>

          <div className="tool-group sizes">
            {SIZES.map((s) => (
              <button
                key={s}
                className={`tool size ${size === s ? 'tool-on' : ''}`}
                onClick={() => setSize(s)}
                aria-label={`${s}px`}
              >
                <span
                  className="size-dot"
                  style={{
                    width: Math.max(4, s * 0.6),
                    height: Math.max(4, s * 0.6),
                    background: tool === 'eraser' || color === '#ffffff' ? '#bbb' : color,
                  }}
                />
              </button>
            ))}
          </div>

          <div className="tool-group colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${color === c && tool !== 'eraser' ? 'swatch-on' : ''}`}
                style={{ background: c }}
                onClick={() => pickColor(c)}
                aria-label={c}
              />
            ))}
          </div>

          {penDetected && (
            <label className="finger-toggle">
              <input type="checkbox" checked={fingerDraw} onChange={(e) => setFingerDraw(e.target.checked)} />
              {t('fingerDrawing')}
            </label>
          )}
        </div>
      </div>

      {confirm === 'clear' && (
        <Confirm
          title={t('clearConfirm')}
          confirmLabel={t('clear')}
          cancelLabel={t('cancel')}
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            canvas.current?.clear()
            setConfirm(null)
          }}
        />
      )}
      {confirm === 'empty' && (
        <Confirm
          title={t('emptyDrawingWarn')}
          confirmLabel={t('submit')}
          cancelLabel={t('cancel')}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            finish(false)
          }}
        />
      )}
    </div>
  )
}
