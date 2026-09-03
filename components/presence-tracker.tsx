"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export function PresenceTracker({ 
  userId, 
  email, 
  role,
  employeeRole
}: { 
  userId: string, 
  email: string | null,
  role: string,
  employeeRole: string | null
}) {

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient()
    const topic = 'global-presence'
    
    // Check if channel already exists
    let channel = supabase.getChannels().find(c => c.topic === 'realtime:' + topic || c.topic === topic)

    if (!channel) {
      // Create new channel
      channel = supabase.channel(topic, {
        config: {
          presence: { key: userId },
        },
      })

      // MUST call .on BEFORE .subscribe
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel!.presenceState()
        if (typeof window !== 'undefined') {
          (window as any).__presenceState = state;
          window.dispatchEvent(new CustomEvent('presence_sync', { detail: state }))
        }
      })

      channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel!.track({
              online_at: new Date().toISOString(),
              email: email,
              role: role,
              employeeRole: employeeRole
            })
          } catch (e) {
            console.error("Presence track error:", e)
          }
        }
      })
    } else {
      // If already exists, just update track and fire sync (if it's already subscribed)
      // We don't call .subscribe() or .on() again.
      try {
        channel.track({
          online_at: new Date().toISOString(),
          email: email,
          role: role,
          employeeRole: employeeRole
        }).catch(() => {})
      } catch(e) {}
      
      try {
        const state = channel.presenceState()
        if (typeof window !== 'undefined') {
          (window as any).__presenceState = state;
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('presence_sync', { detail: state }))
          }, 100)
        }
      } catch(e) {}
    }

    return () => {
      // Clean up on unmount by untracking (appears offline), 
      // but do NOT remove channel to avoid StrictMode re-subscription bugs
      if (channel) {
        try {
          channel.untrack().catch(() => {})
        } catch(e) {}
      }
    }
  }, [userId, email, role, employeeRole])

  return null
}
