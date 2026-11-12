import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { MAX_IMAGE_CHARS } from '../shared/protocol'
import { CANVAS_SIZE, PAPER, applyOp, clearCanvas, drawStroke, isBlank, replay, type Op, type StrokeOp, type Tool } from './engine'

export interface DrawingHandle {
  undo: () => void
  redo: () => void
  clear: () => void
  isBlank: () => boolean
  exportImage: () => string
}

interface Props {
  tool: Tool
  color: string
  size: number
  /** allow finger drawing even when a pen was detected */
  fingerDraw: boolean
  onPenDetected: () => void
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void
}

interface ActiveStroke {
  pointerId: number
  op: StrokeOp
}

const TWO_FINGER_TAP_MS = 300
const TAP_MOVE_TOLERANCE = 12

export const DrawingCanvas = forwardRef<DrawingHandle, Props>(function DrawingCanvas(
  { tool, color, size, fingerDraw, onPenDetected, onHistoryChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const committedRef = useRef<HTMLCanvasElement | null>(null)
  const ops = useRef<Op[]>([])
  const redoStack = useRef<Op[]>([])
  const active = useRef<ActiveStroke | null>(null)
  const penSeen = useRef(false)
  const frame = useRef(0)
  const touches = useRef(new Map<number, { x: number; y: number; t: number; moved: boolean }>())
  const gesture = useRef<{ start: number; maxTouches: number; moved: boolean } | null>(null)

  // keep latest props in refs for event handlers
  const props = useRef({ tool, color, size, fingerDraw, onPenDetected, onHistoryChange })
  props.current = { tool, color, size, fingerDraw, onPenDetected, onHistoryChange }

  const committedCtx = () => committedRef.current!.getContext('2d', { willReadFrequently: true })!

  const render = useCallback(() => {
    frame.current = 0
    const c = canvasRef.current
    if (!c || !committedRef.current) return
    const ctx = c.getContext('2d')!
    ctx.drawImage(committedRef.current, 0, 0)
    if (active.current) drawStroke(ctx, active.current.op, false)
  }, [])

  const scheduleRender = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(render)
  }, [render])

  const notify = () => props.current.onHistoryChange(ops.current.length > 0, redoStack.current.length > 0)

  const commit = (op: Op) => {
    ops.current.push(op)
    redoStack.current = []
    applyOp(committedCtx(), op)
    notify()
    scheduleRender()
  }

  useEffect(() => {
    const off = document.createElement('canvas')
    off.width = off.height = CANVAS_SIZE
    committedRef.current = off
    clearCanvas(off.getContext('2d', { willReadFrequently: true })!)
    render()
  }, [render])

  const undo = () => {
    const op = ops.current.pop()
    if (!op) return
    redoStack.current.push(op)
    replay(committedCtx(), ops.current)
    notify()
    scheduleRender()
  }

  useImperativeHandle(ref, () => ({
    undo,
    redo() {
      const op = redoStack.current.pop()
      if (!op) return
      ops.current.push(op)
      applyOp(committedCtx(), op)
      notify()
      scheduleRender()
    },
    clear() {
      if (isBlank(ops.current)) return
      commit({ kind: 'clear' })
    },
    isBlank: () => isBlank(ops.current),
    exportImage() {
      // finish any in-progress stroke first (e.g. timer ran out mid-line)
      if (active.current) {
        const op = active.current.op
        active.current = null
        commit(op)
      }
      // the server drops drawings above MAX_IMAGE_CHARS: step the quality down until it fits
      let url = ''
      for (const q of [0.85, 0.7, 0.55, 0.4, 0.25]) {
        url = committedRef.current!.toDataURL('image/jpeg', q)
        if (url.length < MAX_IMAGE_CHARS) break
      }
      return url
    },
  }))

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [
      ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    ]
  }

  const pressureOf = (e: PointerEvent) => (e.pointerType === 'pen' ? Math.max(0.05, e.pressure || 0.5) : 0.5)

  const cancelActive = () => {
    active.current = null
    scheduleRender()
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ne = e.nativeEvent
    const { tool, color, size, fingerDraw } = props.current

    if (ne.pointerType === 'pen') {
      if (!penSeen.current) {
        penSeen.current = true
        props.current.onPenDetected()
      }
      // a palm/finger stroke already in progress must not block the Pencil (or leave a stray mark)
      if (active.current && !active.current.op.pen) cancelActive()
    }

    if (ne.pointerType === 'touch') {
      touches.current.set(ne.pointerId, { x: ne.clientX, y: ne.clientY, t: performance.now(), moved: false })
      if (touches.current.size >= 2) {
        // multi-touch gesture: abort a finger stroke started a moment ago
        if (active.current && active.current.op.pen === false) cancelActive()
        fillPending.current = null
        gesture.current ??= { start: performance.now(), maxTouches: 0, moved: false }
        gesture.current.maxTouches = Math.max(gesture.current.maxTouches, touches.current.size)
        return
      }
      gesture.current = { start: performance.now(), maxTouches: 1, moved: false }
      if (penSeen.current && !fingerDraw) return
    }

    if (active.current) return
    canvasRef.current!.setPointerCapture(ne.pointerId)
    const [x, y] = toCanvas(ne)

    if (tool === 'fill') {
      // fill fires on pointer up so a two-finger tap doesn't trigger it
      active.current = null
      fillPending.current = { pointerId: ne.pointerId, x, y, color }
      return
    }

    active.current = {
      pointerId: ne.pointerId,
      op: {
        kind: 'stroke',
        color: tool === 'eraser' ? PAPER : color,
        size: tool === 'eraser' ? size * 2.2 : size,
        points: [[x, y, pressureOf(ne)]],
        pen: ne.pointerType === 'pen',
        eraser: tool === 'eraser',
      },
    }
    scheduleRender()
  }

  const fillPending = useRef<{ pointerId: number; x: number; y: number; color: string } | null>(null)

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ne = e.nativeEvent
    const tp = touches.current.get(ne.pointerId)
    if (tp && !tp.moved && Math.hypot(ne.clientX - tp.x, ne.clientY - tp.y) > TAP_MOVE_TOLERANCE) {
      tp.moved = true
      if (gesture.current) gesture.current.moved = true
    }
    const a = active.current
    if (!a || a.pointerId !== ne.pointerId) return
    const events = typeof ne.getCoalescedEvents === 'function' ? ne.getCoalescedEvents() : []
    const list = events.length ? events : [ne]
    for (const ev of list) {
      const [x, y] = toCanvas(ev)
      a.op.points.push([x, y, pressureOf(ev)])
    }
    scheduleRender()
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ne = e.nativeEvent
    if (ne.pointerType === 'touch') {
      touches.current.delete(ne.pointerId)
      const g = gesture.current
      if (g && touches.current.size === 0) {
        gesture.current = null
        if (g.maxTouches === 2 && !g.moved && performance.now() - g.start < TWO_FINGER_TAP_MS) {
          fillPending.current = null
          undo()
          return
        }
      }
    }
    const fp = fillPending.current
    if (fp && fp.pointerId === ne.pointerId) {
      fillPending.current = null
      commit({ kind: 'fill', x: fp.x, y: fp.y, color: fp.color })
      return
    }
    const a = active.current
    if (!a || a.pointerId !== ne.pointerId) return
    active.current = null
    commit(a.op)
  }

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    touches.current.delete(e.nativeEvent.pointerId)
    if (fillPending.current?.pointerId === e.nativeEvent.pointerId) fillPending.current = null
    if (active.current?.pointerId === e.nativeEvent.pointerId) cancelActive()
  }

  return (
    <canvas
      ref={canvasRef}
      className="drawing-canvas"
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
})
