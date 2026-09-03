"use client"

import { useEffect, useState } from "react"
import { Users, Loader2 } from "lucide-react"

export function LiveUsersWidget() {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleSync = (e: any) => {
      const state = e.detail
      const users: any[] = []
      
      for (const [key, presences] of Object.entries(state)) {
        if ((presences as any[]).length > 0) {
          users.push({
            id: key,
            ...((presences as any[])[0] as any)
          })
        }
      }
      // Sort by email for stable rendering
      users.sort((a, b) => (a.email || "").localeCompare(b.email || ""))
      setOnlineUsers(users)
      setLoading(false)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('presence_sync', handleSync)
      
      // If state already exists globally (set by PresenceTracker), use it
      if ((window as any).__presenceState) {
        handleSync({ detail: (window as any).__presenceState })
      }
      
      // Stop loading after a timeout just in case
      setTimeout(() => setLoading(false), 3000)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('presence_sync', handleSync)
      }
    }
  }, [])

  return (
    <div className="space-y-4 pt-6 border-t border-white/[0.06]">
      <div className="flex items-center justify-between">
        <h3 className="text-white/80 font-bold text-sm flex items-center gap-2">
          <Users size={16} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" /> 
          Online Users
        </h3>
        <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-mono border border-emerald-500/30">
          {onlineUsers.length}
        </span>
      </div>
      
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="size-4 animate-spin text-white/40" />
          </div>
        ) : onlineUsers.length === 0 ? (
          <p className="text-xs text-white/40 text-center">ไม่มีผู้ใช้ออนไลน์</p>
        ) : (
          onlineUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold text-white border border-white/10 shadow-inner uppercase">
                  {u.email ? u.email.substring(0, 2) : "U"}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-white/90 truncate">{u.email}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">{u.role || "staff"} {u.employeeRole ? `(${u.employeeRole})` : ""}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
