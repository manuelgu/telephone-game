import { describe, expect, it } from 'vitest'
import { bookIndexFor, createGame, currentTurn, pageKindForStep, submitPage, totalTurns } from './logic'
import type { Player } from './types'

const players = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#000' }))

function playThrough(n: number, turns = n, style: 'books' | 'chain' = 'books') {
  let g = createGame(players(n), { timer: 0, turns, lang: 'en', style })
  let count = 0
  while (g.status === 'playing') {
    const t = currentTurn(g)!
    g = submitPage(g, t.kind === 'drawing' ? { image: `img-${count}` } : { text: `t-${count}` })
    count++
  }
  return { g, count }
}

describe('rotation', () => {
  it('each player touches each book exactly once per full circle (excluding the owner return)', () => {
    const n = 5
    for (let p = 0; p < n; p++) {
      const books = new Set<number>()
      for (let s = 0; s < n; s++) books.add(bookIndexFor(p, s, n))
      expect(books.size).toBe(n)
    }
  })

  it('step 0 is the owner, step n returns to the owner', () => {
    expect(bookIndexFor(3, 0, 6)).toBe(3)
    expect(bookIndexFor(3, 6, 6)).toBe(3)
  })

  it('page kinds alternate', () => {
    expect([0, 1, 2, 3, 4].map(pageKindForStep)).toEqual(['word', 'drawing', 'guess', 'drawing', 'guess'])
  })
})

describe('full game', () => {
  for (const n of [2, 3, 4, 7]) {
    it(`plays a ${n}-player game to the reveal`, () => {
      const { g, count } = playThrough(n)
      expect(g.status).toBe('reveal')
      expect(count).toBe(totalTurns(g))
      for (const [i, b] of g.books.entries()) {
        expect(b.pages).toHaveLength(n + 1)
        expect(b.pages[0].authorId).toBe(`p${i}`)
        // book ends with its owner
        expect(b.pages[n].authorId).toBe(`p${i}`)
        // no player appears twice in a book except the owner at start/end
        const middle = b.pages.slice(1, n).map((p) => p.authorId)
        expect(new Set(middle).size).toBe(middle.length)
      }
    })
  }

  it('respects a shorter book length', () => {
    const { g } = playThrough(6, 3)
    expect(g.books.every((b) => b.pages.length === 4)).toBe(true)
  })
})

describe('chain style', () => {
  for (const n of [2, 3, 5]) {
    it(`plays a ${n}-player single chain`, () => {
      const { g, count } = playThrough(n, n, 'chain')
      expect(g.status).toBe('reveal')
      expect(g.books).toHaveLength(1)
      expect(count).toBe(n + 1)
      expect(count).toBe(totalTurns(g))
      const authors = g.books[0].pages.map((p) => p.authorId)
      // seat 0 picks the word, everyone takes one turn in order, seat 0 gets the final page
      expect(authors).toEqual([...players(n).map((p) => p.id), 'p0'])
      expect(g.books[0].pages.map((p) => p.kind)).toEqual(
        Array.from({ length: n + 1 }, (_, i) => pageKindForStep(i)),
      )
    })
  }

  it('a shorter chain stops early', () => {
    const { g } = playThrough(6, 3, 'chain')
    expect(g.books[0].pages).toHaveLength(4)
  })

  it('defaults to books for games without a style', () => {
    const g = createGame(players(3), { timer: 0, turns: 3, lang: 'en' })
    expect(g.books).toHaveLength(3)
  })
})
