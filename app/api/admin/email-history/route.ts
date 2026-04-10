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

  const [{ data: reports }, { data: { users: authUsers } }] = await Promise.all([
    (service as any).from('custom_reports')
      .select('id, user_id, brand_name, brand_id, date_from, date_to, title, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailMap: Record<string, string> = {}
  for (const u of authUsers) emailMap[u.id] = u.email || ''

  const rows = (reports || []).map((r: any) => ({
    id: r.id,
    brandName: r.brand_name,
    brandId: r.brand_id,
    dateFrom: r.date_from,
    dateTo: r.date_to,
    recipientEmail: r.recipient_email || (r.user_id ? emailMap[r.user_id] : null) || '—',
    sentAt: r.created_at,
  }))

  return Response.json({ rows })
}
