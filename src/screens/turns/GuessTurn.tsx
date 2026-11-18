import { useRef, useState } from 'react'
import { DrawingCanvas, type DrawingHandle } from '../../canvas/DrawingCanvas'
import { Icon } from '../../components/Icon'
import { Confirm } from '../../components/Modal'
import { TimerBadge } from '../../components/TimerBadge'
import { useCountdown, useSquareFit } from '../../components/hooks'
import { useStore } from '../../store/store'

/** resolution of the handwriting pad (wide strip, 8:3) */
export const WRITE_PAD_W = 1024
export const WRITE_PAD_H = 384
const INK = '#1f1a17'
const INK_SIZE = 12

type Mode = 'type' | 'write'
/** last mode picked on this device, so a Pencil player doesn't have to switch every turn */
let lastMode: Mode = 'type'

export interface GuessResult {
  text: string
  /** handwritten guess as image data URL */
  image?: string
}

interface Props {
  image?: string
  timer: number
  onSubmit: (guess: GuessResult, timedOut: boolean) => void
}

export function GuessTurn({ image, timer, onSubmit }: Props) {
  const t = useStore((s) => s.t)
  const [mode, setModeState] = useState<Mode>(lastMode)
  const [text, setText] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const pad = useRef<DrawingHandle>(null)
  const view = useRef<HTMLDivElement>(null)
  const side = useSquareFit(view)
  const textRef = useRef(text)
  textRef.current = text
  const modeRef = useRef(mode)
  modeRef.current = mode
  const submitted = useRef(false)

  const setMode = (m: Mode) => {
    lastMode = m
    setModeState(m)
  }

  const finish = (timedOut: boolean) => {
    if (submitted.current) return
    const typed = textRef.current.trim()
    const ink = !!pad.current && !pad.current.isBlank()
    // the visible input wins; the hidden one is only a fallback (e.g. the timer runs out right after switching)
    const useInk = modeRef.current === 'write' ? ink || !typed : ink && !typed
    submitted.current = true
    onSubmit(useInk && ink ? { text: '', image: pad.current!.exportImage({ trim: true }) } : { text: typed }, timedOut)
  }
  const remaining = useCountdown(timer, () => finish(true))

  return (
    <div className="guess-turn">
      <div className="guess-head">
        <h2 className="turn-title">{t('stepGuess')}</h2>
        <TimerBadge remaining={remaining} />
      </div>
      {/* the drawing takes all the room the guess input leaves (beside it in landscape, above it in portrait) */}
      <div className="guess-view" ref={view}>
        <div className="guess-image card" style={{ width: side, height: side }}>
          {image ? <img src={image} alt="" draggable={false} /> : <div className="empty">{t('nothing')}</div>}
        </div>
      </div>

      <div className="guess-input">
        <div className="chips guess-modes" role="tablist">
          {(['type', 'write'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={`chip ${mode === m ? 'chip-on' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'type' ? `⌨️ ${t('guessType')}` : `✍️ ${t('guessWrite')}`}
            </button>
          ))}
        </div>

        {/* both stay mounted so switching back and forth keeps what was typed or written */}
        <form
          hidden={mode !== 'type'}
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
        <div className="write-pad-wrap" hidden={mode !== 'write'}>
          <div className="write-pad card">
            <DrawingCanvas
              ref={pad}
              tool="pen"
              color={INK}
              size={INK_SIZE}
              fingerDraw={false}
              width={WRITE_PAD_W}
              height={WRITE_PAD_H}
              onPenDetected={() => {}}
              onHistoryChange={(u) => setHasInk(u && !pad.current?.isBlank())}
            />
            {!hasInk && <span className="write-pad-hint">{t('writeHere')}</span>}
          </div>
          <div className="write-pad-actions">
            <button className="tool" onClick={() => pad.current?.undo()} disabled={!hasInk} aria-label={t('undo')}>
              <Icon name="undo" />
            </button>
            <button className="tool" onClick={() => setConfirmClear(true)} disabled={!hasInk} aria-label={t('clear')}>
              <Icon name="trash" />
            </button>
            <button className="btn btn-primary" onClick={() => finish(false)} disabled={!hasInk}>
              <Icon name="check" /> {t('submit')}
            </button>
          </div>
        </div>
      </div>

      {confirmClear && (
        <Confirm
          title={t('clearConfirm')}
          confirmLabel={t('clear')}
          cancelLabel={t('cancel')}
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            pad.current?.clear()
            setConfirmClear(false)
          }}
        />
      )}
    </div>
  )
}
