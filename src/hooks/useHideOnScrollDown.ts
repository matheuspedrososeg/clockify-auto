import { useEffect, useRef, useState } from 'react'

const REVEAL_AT = 64
const THRESHOLD = 8

export function useHideOnScrollDown(): boolean {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const frame = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY

    function evaluate() {
      frame.current = 0
      const y = window.scrollY
      const delta = y - lastY.current
      if (Math.abs(delta) < THRESHOLD) return
      lastY.current = y
      setHidden(y > REVEAL_AT && delta > 0)
    }

    function onScroll() {
      if (frame.current) return
      frame.current = requestAnimationFrame(evaluate)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [])

  return hidden
}
