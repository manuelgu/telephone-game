// Scripted sketches in normalized canvas coordinates (0..1).
// Ops: { size }, { color }, { stroke: [[x,y],...] }, { fill: [x,y], color }

const arc = (cx, cy, r, a0, a1, n = 36, ry = r) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return [cx + r * Math.cos(a), cy + ry * Math.sin(a)]
  })
const circle = (cx, cy, r, ry = r) => arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5 + 0.25, 48, ry)
const closed = (pts) => [...pts, pts[0], pts[1]]
const PI = Math.PI

const INK = '#1f1a17'
const RED = '#e8553d'
const ORANGE = '#f08a24'
const YELLOW = '#f2c632'
const GREEN = '#3fa66b'
const BLUE = '#3b82c4'
const PURPLE = '#6a4fc9'
const BROWN = '#8d5a3b'
const GRAY = '#7a746e'

export const DRAWINGS = {
  crown: [
    { size: '22px', color: INK },
    {
      stroke: closed([
        [0.2, 0.72], [0.2, 0.36], [0.35, 0.55], [0.5, 0.26], [0.65, 0.55], [0.8, 0.36], [0.8, 0.72],
      ]),
    },
    { stroke: [[0.19, 0.62], [0.81, 0.62]] },
    { fill: [0.5, 0.5], color: YELLOW },
    { fill: [0.5, 0.67], color: YELLOW },
    { size: '44px', color: RED },
    { stroke: [[0.36, 0.67], [0.362, 0.672]] },
    { stroke: [[0.64, 0.67], [0.642, 0.672]] },
    { color: BLUE },
    { stroke: [[0.5, 0.67], [0.502, 0.672]] },
    { size: '22px', color: PURPLE },
    { stroke: circle(0.2, 0.33, 0.03) },
    { stroke: circle(0.5, 0.23, 0.03) },
    { stroke: circle(0.8, 0.33, 0.03) },
  ],

  igloo: [
    { size: '22px', color: INK },
    { stroke: [[-0.02, 0.74], [1.02, 0.74]] },
    { stroke: arc(0.5, 0.74, 0.32, PI - 0.12, 2 * PI + 0.12, 40) },
    { stroke: arc(0.5, 0.74, 0.1, PI - 0.3, 2 * PI + 0.3, 20) },
    { size: '10px' },
    { stroke: [[0.205, 0.63], [0.4, 0.63]] },
    { stroke: [[0.6, 0.63], [0.795, 0.63]] },
    { stroke: [[0.26, 0.53], [0.74, 0.53]] },
    { stroke: [[0.36, 0.45], [0.64, 0.45]] },
    { stroke: [[0.3, 0.63], [0.3, 0.74]] },
    { stroke: [[0.7, 0.63], [0.7, 0.74]] },
    { stroke: [[0.4, 0.53], [0.4, 0.63]] },
    { stroke: [[0.6, 0.53], [0.6, 0.63]] },
    { stroke: [[0.5, 0.45], [0.5, 0.53]] },
    { fill: [0.5, 0.69], color: INK },
    { fill: [0.08, 0.1], color: BLUE },
  ],

  ufo: [
    { size: '22px', color: INK },
    { stroke: circle(0.5, 0.48, 0.33, 0.09) },
    { stroke: arc(0.5, 0.46, 0.15, PI + 0.05, 2 * PI - 0.05, 28) },
    { stroke: [[0.41, 0.56], [0.27, 0.9], [0.73, 0.9], [0.59, 0.56]] },
    { fill: [0.5, 0.37], color: BLUE },
    { fill: [0.5, 0.52], color: GRAY },
    { fill: [0.5, 0.75], color: YELLOW },
    { size: '44px', color: YELLOW },
    { stroke: [[0.28, 0.49], [0.282, 0.492]] },
    { stroke: [[0.72, 0.49], [0.722, 0.492]] },
    { color: RED },
    { stroke: [[0.5, 0.51], [0.502, 0.512]] },
  ],

  'hot air balloon': [
    { size: '22px', color: INK },
    { stroke: circle(0.5, 0.36, 0.25) },
    { stroke: [[0.5, 0.08], [0.5, 0.64]] },
    { stroke: [[0.33, 0.55], [0.43, 0.7]] },
    { stroke: [[0.67, 0.55], [0.57, 0.7]] },
    { stroke: closed([[0.42, 0.7], [0.58, 0.7], [0.58, 0.85], [0.42, 0.85]]) },
    { fill: [0.38, 0.33], color: RED },
    { fill: [0.62, 0.33], color: YELLOW },
    { fill: [0.5, 0.78], color: BROWN },
    { fill: [0.06, 0.08], color: BLUE },
  ],

  rainbow: [
    { size: '22px', color: INK },
    { stroke: [[-0.02, 0.78], [1.02, 0.78]] },
    { stroke: arc(0.5, 0.78, 0.4, PI - 0.12, 2 * PI + 0.12, 44) },
    { stroke: arc(0.5, 0.78, 0.32, PI - 0.12, 2 * PI + 0.12, 40) },
    { stroke: arc(0.5, 0.78, 0.24, PI - 0.12, 2 * PI + 0.12, 34) },
    { stroke: arc(0.5, 0.78, 0.16, PI - 0.12, 2 * PI + 0.12, 28) },
    { fill: [0.5, 0.42], color: RED },
    { fill: [0.5, 0.5], color: YELLOW },
    { fill: [0.5, 0.58], color: GREEN },
    { fill: [0.5, 0.66], color: BLUE },
  ],

  campfire: [
    { size: '22px', color: INK },
    {
      stroke: closed([
        [0.36, 0.74], [0.32, 0.58], [0.41, 0.5], [0.44, 0.3], [0.52, 0.44], [0.58, 0.22], [0.64, 0.46], [0.69, 0.6], [0.65, 0.74],
      ]),
    },
    { stroke: closed([[0.44, 0.73], [0.43, 0.62], [0.5, 0.5], [0.57, 0.62], [0.56, 0.73]]) },
    { fill: [0.38, 0.6], color: RED },
    { fill: [0.5, 0.66], color: YELLOW },
    { size: '44px', color: BROWN },
    { stroke: [[0.26, 0.86], [0.74, 0.74]] },
    { stroke: [[0.26, 0.74], [0.74, 0.86]] },
  ],

  kite: [
    { size: '22px', color: INK },
    { stroke: closed([[0.5, 0.1], [0.73, 0.38], [0.5, 0.66], [0.27, 0.38]]) },
    { stroke: [[0.5, 0.08], [0.5, 0.68]] },
    { stroke: [[0.25, 0.38], [0.75, 0.38]] },
    { fill: [0.43, 0.3], color: RED },
    { fill: [0.57, 0.3], color: YELLOW },
    { fill: [0.43, 0.46], color: YELLOW },
    { fill: [0.57, 0.46], color: RED },
    { size: '10px', color: INK },
    { stroke: [[0.5, 0.66], [0.45, 0.74], [0.54, 0.81], [0.46, 0.88], [0.53, 0.95], [0.49, 1.01]] },
    { size: '22px', color: RED },
    { stroke: [[0.44, 0.71], [0.52, 0.77]] },
    { stroke: [[0.44, 0.77], [0.52, 0.71]] },
    { stroke: [[0.46, 0.85], [0.54, 0.91]] },
    { stroke: [[0.46, 0.91], [0.54, 0.85]] },
    { fill: [0.08, 0.08], color: BLUE },
  ],

  // fallback for unexpected prompts
  smiley: [
    { size: '22px', color: INK },
    { stroke: circle(0.5, 0.5, 0.3) },
    { fill: [0.5, 0.5], color: YELLOW },
    { stroke: arc(0.5, 0.52, 0.16, 0.2, PI - 0.2, 20) },
    { size: '44px' },
    { stroke: [[0.4, 0.42], [0.401, 0.421]] },
    { stroke: [[0.6, 0.42], [0.601, 0.421]] },
  ],
}

// Funny-but-plausible guesses for each original word.
export const GUESSES = {
  crown: 'spiky birthday hat',
  igloo: 'turtle at night',
  ufo: 'flying hamburger',
  'hot air balloon': 'giant lollipop',
  rainbow: 'slice of watermelon',
  campfire: 'angry carrot',
  kite: 'fancy jellyfish',
  smiley: 'happy pancake',
}
