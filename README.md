# Telephone Sketchbook

Drawing telephone game for phones and iPad (with Apple Pencil). Installable PWA in **English, Deutsch, Svenska**.

Two modes:

- **Play online:** everyone uses their own device. The host creates a room and shares a 5-letter code or QR code. Everyone plays at the same time.
- **Pass & play:** one device is handed around the table. Works fully offline and needs no server.

## Game styles

Pick a style in both modes. The default is the first one.

- **Everyone has a book:** every player picks their own word, and the books move one seat on after every round, like turning pages in the board game. The reveal has one story per player. Online, everyone works on their book at the same time.
- **One chain:** the first player in the list picks a single word. Then players take turns in seat order, alternating drawing and guessing on one book; on a full circle it comes back to the first player. Only one person plays at a time, so games are short (N+1 turns), which suits pass & play and small groups.

## How a game works (everyone has a book)

1. Step 0: each player picks a secret starting word for their own book (4 suggested cards, one reshuffle, or their own).
2. Steps 1…N: player `p` works on book `(p − step) mod N`. Odd steps are drawings, even steps are guesses. On a full circle each book comes back to its owner for the last guess.
3. Reveal: the books are flipped through page by page, ending each book with "started as → ended as". Finished games are saved to the device's history, drawings included.

### Online specifics

- Each room is a Cloudflare **Durable Object** (`worker/room.ts`) that keeps the game state and drawings and handles every player's WebSocket.
- Each player receives only the page they need to respond to, so nobody can peek at other books.
- The server controls the timer. Clients auto-submit at the deadline. After an 8s grace period the server fills in anything still missing: a random word, a blank drawing or an empty guess.
- With the timer off, the host can **skip waiting players**.
- **Reconnects:** credentials are stored per room on the device, so a reload, a network drop or iOS suspending the tab rejoins the same seat. The home screen offers "Rejoin room".
- A player on a new device can retake their seat by entering the same name, as long as the old one is offline.
- If the host goes offline, host controls pass to the next connected player.
- **Reveal:** the host flips pages and everyone's screen follows. After the host taps *Finish*, everyone can browse freely. *New round* returns the same room to the lobby.
- Late joins are blocked once a game has started. Rooms are deleted after 24h of inactivity.

### Drawing

- Strokes use `perfect-freehand`. Apple Pencil pressure sets the line width; fingers get simulated pressure.
- Tools: pen, eraser, fill bucket, 4 sizes, 12 colours, undo/redo/clear.
- Palm rejection: once a Pencil is detected, fingers don't draw. A two-finger tap undoes.

## Development

```bash
npm install
npm run dev          # Vite + local Worker/Durable Object (workerd) on http://localhost:5173, also on your LAN
npm test             # game-logic unit tests
npm run test:online  # protocol end-to-end test (needs `npm run dev` running; BASE=http://localhost:5173)
npm run build        # typecheck app + worker, build client and worker
npm run cf-typegen   # regenerate worker/worker-configuration.d.ts after editing wrangler.jsonc
```

**Testing online mode on real devices:** open the app on the host device at `http://<your-mac-ip>:5173`, not `localhost`. The QR code uses the host page's address, so it has to be one the other phones can reach.

**Testing with two players in one browser:** saved seats are stored per origin. Use `localhost` for one player and `127.0.0.1` for the other.

## Deploy (Cloudflare)

```bash
npx wrangler login
npm run deploy
```

`wrangler.jsonc` deploys the static app with SPA fallback. `/api/*` goes to the Worker, and the `Room` Durable Object (SQLite-backed) is created on first deploy through the `v1` migration.

## Structure

```
src/game/          pure game logic (rotation, page kinds) + tests — shared with the worker
src/shared/        online protocol types (client <-> server messages)
src/online/        WebSocket connection with auto-reconnect, online zustand store
src/store/         local game store, IndexedDB persistence (current game + history)
src/canvas/        drawing engine (strokes, flood fill, replay) + DrawingCanvas
src/screens/       Home, Setup, Game (pass & play), BookViewer, History, HowTo
src/screens/online OnlineEntry (host/join), Lobby (QR/code/settings), OnlinePlay, Room
src/i18n/          UI strings + word decks (en/de/sv)
worker/            Cloudflare Worker router + Room Durable Object
scripts/           online end-to-end test
```

## Walkthrough video

`media/telephone-sketchbook-walkthrough.mp4` is generated from real, scripted playthroughs:

```bash
npm run build && npx vite preview --port 4173           # production build incl. worker
node scripts/video/record.mjs /tmp/tg-rec               # records pass & play + online (host/joiner) as iPad screencasts
node scripts/video/compose.mjs /tmp/tg-rec media/telephone-sketchbook-walkthrough.mp4
```

- **Recording:** Playwright drives the installed Chrome. Strokes are sent as `pen` pointer events with pressure, as an Apple Pencil would send them, and the word cards are seeded so the drawings match the picked words (`scripts/video/seed-search.mjs`).
- **Composing:** title cards, iPad frames and captions are rendered from HTML, and ffmpeg cuts, speeds up and stitches the clips. Captions and timing live in the `TL` array in `compose.mjs`.
