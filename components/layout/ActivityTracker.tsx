'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ActivityTracker() {
  const pathname = usePathname()
  const sessionId = useRef<string>('')

  useEffect(() => {
    const stored = sessionStorage.getItem('_sid')
    if (stored) {
      sessionId.current = stored
    } else {
      const id = Math.random().toString(36).slice(2)
      sessionStorage.setItem('_sid', id)
      sessionId.current = id
    }
  }, [])

  useEffect(() => {
    if (!pathname) return
    const sid = sessionId.current || sessionStorage.getItem('_sid') || ''
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      ;(supabase as any).from('user_activity_log').insert({
        user_id: data.user.id,
        page: pathname,
        session_id: sid,
        visited_at: new Date().toISOString(),
      })
    })
  }, [pathname])

  return null
}
