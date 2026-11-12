import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isValidCode } from '../src/shared/protocol'

export { Room } from './room'

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH))
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('')
}

const roomStub = (env: Env, code: string) => env.ROOM.get(env.ROOM.idFromName(code))

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      const lang = url.searchParams.get('lang') ?? 'en'
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = randomCode()
        const res = await roomStub(env, code).fetch(
          `https://room/init?code=${code}&lang=${encodeURIComponent(lang)}`,
          { method: 'POST' },
        )
        if (res.status === 201) return Response.json({ code }, { status: 201 })
      }
      return new Response('could not allocate room', { status: 503 })
    }

    const m = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)(\/.*)?$/)
    if (m) {
      const code = m[1].toUpperCase()
      if (!isValidCode(code)) return new Response('not found', { status: 404 })
      const rest = m[2] ?? '/info'
      // /init is internal (room allocation goes through POST /api/rooms)
      if (rest === '/init') return new Response('not found', { status: 404 })
      return roomStub(env, code).fetch(new Request(`https://room${rest}${url.search}`, req))
    }

    if (url.pathname.startsWith('/api/')) return new Response('not found', { status: 404 })
    return env.ASSETS.fetch(req)
  },
} satisfies ExportedHandler<Env>
