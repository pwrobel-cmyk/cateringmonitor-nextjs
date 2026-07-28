import { getAdminUser, getService } from '@/lib/adminAuth'

export async function GET() {
  const user = await getAdminUser()
  if (!user) { return Response.json({ error: 'Unauthorized' }, { status: 403 }) }

  const service = getService()

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
