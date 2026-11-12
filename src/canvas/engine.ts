import { getStroke } from 'perfect-freehand'

export const CANVAS_SIZE = 1024
export const PAPER = '#ffffff'

export type Tool = 'pen' | 'eraser' | 'fill'

export interface StrokeOp {
  kind: 'stroke'
  color: string
  size: number
  /** [x, y, pressure] in canvas units */
  points: number[][]
  pen: boolean
  /** eraser stroke (paints PAPER); a white pen stroke is not an eraser */
  eraser?: boolean
}
export interface FillOp {
  kind: 'fill'
  x: number
  y: number
  color: string
}
export interface ClearOp {
  kind: 'clear'
}
export type Op = StrokeOp | FillOp | ClearOp

function svgPath(points: number[][]): string {
  const len = points.length
  if (len < 4) return ''
  const avg = (a: number, b: number) => (a + b) / 2
  let a = points[0]
  let b = points[1]
  const c = points[2]
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i]
    b = points[i + 1]
    d += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `
  }
  return d + 'Z'
}

export function drawStroke(ctx: CanvasRenderingContext2D, op: StrokeOp, complete = true) {
  const isEraser = !!op.eraser
  const outline = getStroke(op.points, {
    size: op.size,
    thinning: isEraser ? 0 : op.pen ? 0.7 : 0.25,
    smoothing: 0.5,
    streamline: op.pen ? 0.3 : 0.5,
    simulatePressure: !op.pen && !isEraser,
    easing: (t) => t,
    start: { cap: true, taper: 0 },
    end: { cap: true, taper: 0 },
    last: complete,
  })
  ctx.fillStyle = op.color
  if (outline.length < 4) {
    // degenerate: draw a dot
    const [x, y] = op.points[0]
    ctx.beginPath()
    ctx.arc(x, y, op.size / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.fill(new Path2D(svgPath(outline)))
}

function hexToRgba(hex: string): [number, number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
}

/**
 * Scanline flood fill with tolerance. The filled region is dilated by one pixel
 * to cover the anti-aliased seam next to strokes.
 */
export function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string): boolean {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const x0 = Math.floor(sx)
  const y0 = Math.floor(sy)
  if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return false
  const img = ctx.getImageData(0, 0, W, H)
  const data = img.data
  const start = (y0 * W + x0) * 4
  const sr = data[start], sg = data[start + 1], sb = data[start + 2], sa = data[start + 3]
  const [fr, fg, fb, fa] = hexToRgba(color)
  if (Math.abs(sr - fr) + Math.abs(sg - fg) + Math.abs(sb - fb) < 6 && sa === fa) return false

  const TOL = 110
  const matches = (p: number) => {
    const i = p * 4
    return (
      Math.abs(data[i] - sr) + Math.abs(data[i + 1] - sg) + Math.abs(data[i + 2] - sb) + Math.abs(data[i + 3] - sa) <= TOL
    )
  }

  const mask = new Uint8Array(W * H)
  const stack: number[] = [x0, y0]
  while (stack.length) {
    const y = stack.pop()!
    let x = stack.pop()!
    let p = y * W + x
    while (x >= 0 && !mask[p] && matches(p)) {
      x--
      p--
    }
    x++
    p++
    let up = false
    let down = false
    while (x < W && !mask[p] && matches(p)) {
      mask[p] = 1
      if (y > 0) {
        const q = p - W
        if (!mask[q] && matches(q)) {
          if (!up) {
            stack.push(x, y - 1)
            up = true
          }
        } else up = false
      }
      if (y < H - 1) {
        const q = p + W
        if (!mask[q] && matches(q)) {
          if (!down) {
            stack.push(x, y + 1)
            down = true
          }
        } else down = false
      }
      x++
      p++
    }
  }

  const paint = (p: number) => {
    const i = p * 4
    data[i] = fr
    data[i + 1] = fg
    data[i + 2] = fb
    data[i + 3] = fa
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      if (mask[p]) {
        paint(p)
      } else if (
        (x > 0 && mask[p - 1] === 1) ||
        (x < W - 1 && mask[p + 1] === 1) ||
        (y > 0 && mask[p - W] === 1) ||
        (y < H - 1 && mask[p + W] === 1)
      ) {
        paint(p)
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return true
}

export function clearCanvas(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()
}

export function applyOp(ctx: CanvasRenderingContext2D, op: Op) {
  if (op.kind === 'stroke') drawStroke(ctx, op)
  else if (op.kind === 'fill') floodFill(ctx, op.x, op.y, op.color)
  else clearCanvas(ctx)
}

export function replay(ctx: CanvasRenderingContext2D, ops: Op[]) {
  clearCanvas(ctx)
  // Only replay from the last clear on.
  let from = 0
  for (let i = ops.length - 1; i >= 0; i--) {
    if (ops[i].kind === 'clear') {
      from = i + 1
      break
    }
  }
  for (let i = from; i < ops.length; i++) applyOp(ctx, ops[i])
}

export function isBlank(ops: Op[]): boolean {
  return ops.length === 0 || ops[ops.length - 1].kind === 'clear'
}
