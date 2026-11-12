import { useEffect } from 'react'
import { isValidCode, normalizeCode } from './shared/protocol'
import { useStore } from './store/store'
import { BookViewer } from './screens/BookViewer'
import { GameScreen } from './screens/Game'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { HowTo } from './screens/HowTo'
import { Setup } from './screens/Setup'
import { OnlineEntry } from './screens/online/OnlineEntry'
import { RoomScreen } from './screens/online/Room'

export function App() {
  const { ready, screen, init, viewing, go, t, lang, setJoinCode } = useStore()

  useEffect(() => {
    void init()
    // Invite link: /?join=CODE
    const params = new URLSearchParams(location.search)
    const join = params.get('join')
    if (join) {
      const code = normalizeCode(join)
      if (isValidCode(code)) {
        setJoinCode(code)
        go('online')
      }
      history.replaceState(null, '', location.pathname)
    }
  }, [init, go, setJoinCode])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('appName')
  }, [lang, t])

  if (!ready) return null

  switch (screen) {
    case 'setup':
      return <Setup />
    case 'game':
      return <GameScreen />
    case 'history':
      return <History />
    case 'howto':
      return <HowTo />
    case 'online':
      return <OnlineEntry />
    case 'room':
      return <RoomScreen />
    case 'viewer':
      return viewing ? (
        <BookViewer key={viewing.id} game={viewing} onExit={() => go('history')} exitLabel={t('back')} />
      ) : (
        <History />
      )
    default:
      return <Home />
  }
}
