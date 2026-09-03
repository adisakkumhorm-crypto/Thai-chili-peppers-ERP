"use client"

import { useEffect, useState } from "react"

export function LiveStatusIndicator({ userId }: { userId: string }) {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const state = (window as any).__presenceState
      if (state && state[userId]) {
        setIsOnline(true)
      }
    }
    const handleSync = (e: any) => {
      const state = e.detail
      if (state[userId]) {
        setIsOnline(true)
      } else {
        setIsOnline(false)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('presence_sync', handleSync)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('presence_sync', handleSync)
      }
    }
  }, [userId])

  if (!isOnline) return null

  return (
    <span className="relative flex size-3 h-3 w-3 ml-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] border-2 border-slate-900"></span>
    </span>
  )
}
