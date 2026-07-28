import { getAdminUser, getService } from '@/lib/adminAuth'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { data, error } = await (getService() as any)
    .from('email_contacts')
    .select('*')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ contacts: data || [] })
}

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { first_name, last_name, company, email, notes } = body

  if (!first_name?.trim() || !email?.trim()) {
    return Response.json({ error: 'first_name and email are required' }, { status: 400 })
  }

  const { data, error } = await (getService() as any)
    .from('email_contacts')
    .insert({ first_name: first_name.trim(), last_name: last_name?.trim() || null, company: company?.trim() || null, email: email.trim().toLowerCase(), notes: notes?.trim() || null, created_by: user.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ contact: data })
}

export async function DELETE(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { error } = await (getService() as any)
    .from('email_contacts')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function PATCH(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { id, first_name, last_name, company, email, notes } = await request.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await (getService() as any)
    .from('email_contacts')
    .update({ first_name: first_name?.trim(), last_name: last_name?.trim() || null, company: company?.trim() || null, email: email?.trim().toLowerCase(), notes: notes?.trim() || null })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ contact: data })
}
