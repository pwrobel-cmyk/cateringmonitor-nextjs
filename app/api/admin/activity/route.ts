import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: logs } = await (service as any).from('user_activity_log')
    .select('user_id, page, session_id, visited_at')
    .gte('visited_at', thirtyDaysAgo.toISOString())
    .order('visited_at', { ascending: true })

  const entries = logs || []

  // Daily activity
  const dailyMap: Record<string, number> = {}
  const pageMap: Record<string, { visits: number; users: Set<string> }> = {}
  const userMap: Record<string, { visits: number; last: string }> = {}
  const heatmap: Record<string, number> = {}

  for (const e of entries) {
    const day = e.visited_at.slice(0, 10)
    dailyMap[day] = (dailyMap[day] || 0) + 1

    if (!pageMap[e.page]) pageMap[e.page] = { visits: 0, users: new Set() }
    pageMap[e.page].visits++
    pageMap[e.page].users.add(e.user_id)

    if (!userMap[e.user_id]) userMap[e.user_id] = { visits: 0, last: e.visited_at }
    userMap[e.user_id].visits++
    if (e.visited_at > userMap[e.user_id].last) userMap[e.user_id].last = e.visited_at

    const d = new Date(e.visited_at)
    const key = `${d.getDay()}_${d.getUTCHours() + 1}`
    heatmap[key] = (heatmap[key] || 0) + 1
  }

  const daily = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

  const pages = Object.entries(pageMap)
    .map(([page, { visits, users }]) => ({ page, visits, uniqueUsers: users.size }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 20)

  const topUsers = Object.entries(userMap)
    .map(([userId, { visits, last }]) => ({ userId, visits, last }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 20)

  // Profiles for top users
  const { data: profiles } = await service.from('profiles')
    .select('user_id, full_name')
    .in('user_id', topUsers.map(u => u.userId))

  const profileMap: Record<string, string> = {}
  for (const p of (profiles || [])) profileMap[p.user_id] = p.full_name || ''

  // Auth emails for top users
  const { data: { users: authUsers } } = await service.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of authUsers) emailMap[u.id] = u.email || ''

  const topUsersWithInfo = topUsers.map(u => ({
    ...u,
    name: profileMap[u.userId] || emailMap[u.userId] || u.userId,
    email: emailMap[u.userId] || '',
  }))

  return Response.json({ daily, pages, topUsers: topUsersWithInfo, heatmap })
}
