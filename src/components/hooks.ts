import { useEffect, useRef, useState, type RefObject } from 'react'

/** Countdown in whole seconds. `seconds` = 0 disables the timer. Calls onExpire once. */
export function useCountdown(seconds: number, onExpire: () => void): number | null {
  const [remaining, setRemaining] = useState(seconds)
  const cb = useRef(onExpire)
  cb.current = onExpire

  useEffect(() => {
    if (!seconds) return
    const end = performance.now() + seconds * 1000
    let fired = false
    setRemaining(seconds)
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((end - performance.now()) / 1000))
      setRemaining(left)
      if (left === 0 && !fired) {
        fired = true
        window.clearInterval(id)
        cb.current()
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [seconds])

  return seconds ? remaining : null
}

/** Keep the screen awake while playing (supported in iOS 16.4+). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
      } catch {
        /* denied or unsupported */
      }
    }
    void request()
    const onVis = () => {
      if (document.visibilityState === 'visible') void request()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release()
    }
  }, [active])
}

/** Largest square that fits in the element. */
export function useSquareFit(ref: RefObject<HTMLElement | null>): number {
  const [side, setSide] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSide(Math.floor(Math.min(width, height)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return side
}
