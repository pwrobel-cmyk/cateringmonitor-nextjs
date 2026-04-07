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

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Auth users + profiles for user list
  const [{ data: { users: authUsers } }, { data: profiles }] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 1000 }),
    service.from('profiles').select('user_id, full_name'),
  ])
  const profileMap: Record<string, string> = {}
  for (const p of (profiles || [])) profileMap[p.user_id] = p.full_name || ''
  const emailMap: Record<string, string> = {}
  for (const u of authUsers) emailMap[u.id] = u.email || ''

  const userList = authUsers.map(u => ({
    id: u.id,
    email: u.email || '',
    name: profileMap[u.id] || u.email || u.id,
  }))

  // Per-user detail
  if (userId) {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: logs } = await (service as any).from('user_activity_log')
      .select('page, visited_at')
      .eq('user_id', userId)
      .gte('visited_at', sevenDaysAgo.toISOString())
      .order('visited_at', { ascending: false })
      .limit(200)

    const entries: { page: string; visited_at: string }[] = logs || []

    // Group by day
    const byDay: Record<string, { time: string; page: string }[]> = {}
    for (const e of entries) {
      const d = new Date(e.visited_at)
      const day = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
      const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
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

    // Hourly distribution
    const hourly: Record<number, number> = {}
    for (const e of entries) {
      const h = new Date(e.visited_at).getHours()
      hourly[h] = (hourly[h] || 0) + 1
    }
    const hourlyArr = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourly[h] || 0 }))

    return Response.json({
      userList,
      userDetail: {
        totalVisits: entries.length,
        byDay,
        topPages,
        hourly: hourlyArr,
        firstVisit: entries.length ? entries[entries.length - 1].visited_at : null,
        lastVisit: entries.length ? entries[0].visited_at : null,
      },
    })
  }

  // All-users comparison table
  const { data: allLogs } = await (service as any).from('user_activity_log')
    .select('user_id, page, visited_at')
    .gte('visited_at', thirtyDaysAgo.toISOString())
    .order('visited_at', { ascending: true })

  const entries = allLogs || []

  // Per-user stats
  const userStats: Record<string, { visits: number; pages: Record<string, number>; last: string; daily: Record<string, number> }> = {}
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  for (const e of entries) {
    if (!userStats[e.user_id]) userStats[e.user_id] = { visits: 0, pages: {}, last: e.visited_at, daily: {} }
    const s = userStats[e.user_id]
    s.visits++
    s.pages[e.page] = (s.pages[e.page] || 0) + 1
    if (e.visited_at > s.last) s.last = e.visited_at
    if (e.visited_at >= sevenDaysAgo.toISOString()) {
      const day = e.visited_at.slice(0, 10)
      s.daily[day] = (s.daily[day] || 0) + 1
    }
  }

  // Build 7-day sparkline keys
  const sparkDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().slice(0, 10)
  })

  const comparison = Object.entries(userStats).map(([uid, s]) => {
    const topPage = Object.entries(s.pages).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
    const spark = sparkDays.map(day => s.daily[day] || 0)
    return {
      userId: uid,
      name: profileMap[uid] || emailMap[uid] || uid,
      email: emailMap[uid] || '',
      visits: s.visits,
      topPage,
      last: s.last,
      spark,
    }
  }).sort((a, b) => b.visits - a.visits)

  return Response.json({ userList, comparison })
}
