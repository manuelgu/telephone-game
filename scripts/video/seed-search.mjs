// Finds Math.random seeds whose first word-card deal contains words we have drawings for.
// The app consumes some random numbers before dealing, so we first detect that offset from a known deal.
import { dealWords } from '../../src/i18n/words.ts'
import { DRAWINGS } from './drawings.mjs'
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const seeded = (seed, skip) => { const r = mulberry32(seed); for (let i = 0; i < skip; i++) r(); Math.random = r }
const findSkip = (seed, cards) => {
  for (let k = 0; k < 2000; k++) { seeded(seed, k); if (dealWords('en', 4, []).join('|') === cards) return k }
  return -1
}
const kPass = findSkip(34, 'smartphone addiction|skiing|snowball fight|alien abduction')
const kOnline = findSkip(1, 'swimming pool|lemonade stand|mime|sleepwalking')
console.log({ kPass, kOnline })
const drawable = (cards, not = []) => cards.find((c) => DRAWINGS[c] && !not.includes(c))
// online: each device deals once; want 3 different drawable words
const out = []
for (let seed = 1; seed < 50000 && out.length < 3; seed++) {
  seeded(seed, kOnline)
  const d = dealWords('en', 4, [])
  const w = drawable(d, out.map((o) => o.word))
  if (w) out.push({ seed, word: w, d })
}
console.log('online', JSON.stringify(out))
// pass & play: one device, 3 sequential deals
for (let seed = 1; seed < 200000; seed++) {
  seeded(seed, kPass)
  const d1 = dealWords('en', 4, []), d2 = dealWords('en', 4, d1), d3 = dealWords('en', 4, [...d1, ...d2])
  const a = drawable(d1), b = drawable(d2, [a]), c = drawable(d3, [a, b])
  if (a && b && c) { console.log('pass', seed, a, b, c); break }
}
