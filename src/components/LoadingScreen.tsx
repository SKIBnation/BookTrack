import { useEffect, useRef } from 'react'

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => onDoneRef.current(), reduce ? 300 : 1400)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="app-frame mx-auto flex max-w-[480px] flex-col items-center justify-center bg-black text-white">
      <div className="book-mark" aria-hidden="true" />
      <p className="mt-6 text-[28px] font-semibold tracking-tight">BookTrack</p>
    </div>
  )
}
