import { getAdminUser, getService } from '@/lib/adminAuth'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { data, error } = await (getService() as any)
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ templates: data || [] })
}

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { name, subject, paragraphs } = await request.json()
  if (!name?.trim() || !subject?.trim() || !paragraphs?.trim()) {
    return Response.json({ error: 'name, subject and paragraphs are required' }, { status: 400 })
  }

  const { data, error } = await (getService() as any)
    .from('email_templates')
    .insert({ name: name.trim(), subject: subject.trim(), paragraphs: paragraphs.trim(), created_by: user.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ template: data })
}

export async function DELETE(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { error } = await (getService() as any)
    .from('email_templates')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
