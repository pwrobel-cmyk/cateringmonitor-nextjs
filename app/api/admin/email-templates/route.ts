import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const service = () => createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) return null
  return user
}

export async function GET() {
  const user = await assertAdmin()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { data, error } = await (service() as any)
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ templates: data || [] })
}

export async function POST(request: Request) {
  const user = await assertAdmin()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { name, subject, paragraphs } = await request.json()
  if (!name?.trim() || !subject?.trim() || !paragraphs?.trim()) {
    return Response.json({ error: 'name, subject and paragraphs are required' }, { status: 400 })
  }

  const { data, error } = await (service() as any)
    .from('email_templates')
    .insert({ name: name.trim(), subject: subject.trim(), paragraphs: paragraphs.trim(), created_by: user.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ template: data })
}

export async function DELETE(request: Request) {
  const user = await assertAdmin()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { error } = await (service() as any)
    .from('email_templates')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
