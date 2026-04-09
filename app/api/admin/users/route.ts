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

  // Auth users list
  const { data: { users: authUsers } } = await service.auth.admin.listUsers({ perPage: 1000 })

  // Profiles
  const { data: profiles } = await service.from('profiles').select('user_id, full_name, avatar_url, status, trial_ends_at, company_name, role')

  // Brand assignments
  const { data: assignments } = await service.from('user_brand_assignments').select('user_id, brand_id, brands(name)')

  // Activity log: last visit per user
  const { data: activity } = await (service as any).from('user_activity_log')
    .select('user_id, visited_at')
    .order('visited_at', { ascending: false })

  const lastVisit: Record<string, string> = {}
  for (const a of (activity || [])) {
    if (!lastVisit[a.user_id]) lastVisit[a.user_id] = a.visited_at
  }

  const profileMap: Record<string, any> = {}
  for (const p of (profiles || [])) profileMap[p.user_id] = p

  const assignMap: Record<string, { id: string; name: string }> = {}
  for (const a of (assignments || [])) assignMap[a.user_id] = { id: (a as any).brand_id || '', name: (a.brands as any)?.name || '' }

  const users = authUsers.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    full_name: profileMap[u.id]?.full_name || '',
    avatar_url: profileMap[u.id]?.avatar_url || '',
    status: profileMap[u.id]?.status || 'active',
    trial_ends_at: profileMap[u.id]?.trial_ends_at || null,
    company_name: profileMap[u.id]?.company_name || '',
    brand_id: assignMap[u.id]?.id || '',
    brand_name: assignMap[u.id]?.name || '',
    role: profileMap[u.id]?.role || 'user',
    last_activity: lastVisit[u.id] || null,
  }))

  return Response.json({ users })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, full_name, status, trial_ends_at } = await request.json()

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await service.from('profiles').update({ full_name, status, trial_ends_at }).eq('user_id', userId)

  return Response.json({ ok: true })
}
