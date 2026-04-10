import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Auth users + profiles
  const [{ data: { users: authUsers } }, { data: profiles }] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 1000 }),
    service.from('profiles').select('user_id, full_name, avatar_url'),
  ])
  const profileMap: Record<string, { name: string; avatar: string }> = {}
  for (const p of (profiles || [])) profileMap[p.user_id] = { name: p.full_name || '', avatar: p.avatar_url || '' }
  const emailMap: Record<string, string> = {}
  for (const u of authUsers) emailMap[u.id] = u.email || ''

  // Per-user detail
  if (userId) {
    const { data: logs } = await (service as any).from('user_activity_log')
      .select('page, visited_at')
      .eq('user_id', userId)
      .gte('visited_at', sevenDaysAgo.toISOString())
      .order('visited_at', { ascending: false })
      .limit(200)

    const entries: { page: string; visited_at: string }[] = logs || []
    const TZ = 'Europe/Warsaw'

    // Group by day label
    const byDay: Record<string, { time: string; page: string }[]> = {}
    for (const e of entries) {
      const d = new Date(e.visited_at)
      const day = d.toLocaleDateString('pl-PL', { timeZone: TZ, day: 'numeric', month: 'short' })
      const time = d.toLocaleTimeString('pl-PL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
      if (!byDay[day]) byDay[day] = []
      byDay[day].push({ time, page: e.page })
    }

    // Top pages
    const pageCount: Record<string, number> = {}
    for (const e of entries) pageCount[e.page] = (pageCount[e.page] || 0) + 1
    const topPages = Object.entries(pageCount)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Hourly — use Warsaw hour
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
    for (const e of entries) {
      const h = parseInt(new Date(e.visited_at).toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }))
      hourly[h % 24].count++
    }

    return Response.json({
      totalVisits: entries.length,
      byDay,
      topPages,
      hourly,
      firstVisit: entries.length ? entries[entries.length - 1].visited_at : null,
      lastVisit: entries.length ? entries[0].visited_at : null,
    })
  }

  // Summary table: all users with 7-day activity
  const { data: allLogs } = await (service as any).from('user_activity_log')
    .select('user_id, page, visited_at')
    .gte('visited_at', sevenDaysAgo.toISOString())
    .order('visited_at', { ascending: true })

  const entries = allLogs || []

  const TZ = 'Europe/Warsaw'
  const toWarsawDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })

  const sparkDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('en-CA', { timeZone: TZ })
  })

  const stats: Record<string, { visits: number; pages: Record<string, number>; last: string; daily: Record<string, number> }> = {}
  for (const e of entries) {
    if (!stats[e.user_id]) stats[e.user_id] = { visits: 0, pages: {}, last: e.visited_at, daily: {} }
    const s = stats[e.user_id]
    s.visits++
    s.pages[e.page] = (s.pages[e.page] || 0) + 1
    if (e.visited_at > s.last) s.last = e.visited_at
    const day = toWarsawDate(e.visited_at)
    s.daily[day] = (s.daily[day] || 0) + 1
  }

  // All auth users — include ones with no activity
  const summary = authUsers.map(u => {
    const s = stats[u.id]
    return {
      userId: u.id,
      name: profileMap[u.id]?.name || u.email || u.id,
      email: u.email || '',
      avatar: profileMap[u.id]?.avatar || '',
      visits: s?.visits || 0,
      topPage: s ? (Object.entries(s.pages).sort((a, b) => b[1] - a[1])[0]?.[0] || '—') : '—',
      last: s?.last || null,
      spark: sparkDays.map(d => s?.daily[d] || 0),
    }
  }).sort((a, b) => {
    if (!a.last && !b.last) return 0
    if (!a.last) return 1
    if (!b.last) return -1
    return b.last.localeCompare(a.last)
  })

  return Response.json({ summary })
}
