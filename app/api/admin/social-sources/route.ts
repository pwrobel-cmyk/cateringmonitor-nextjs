import { getAdminUser, getService } from '@/lib/adminAuth'

export async function GET(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const service = getService()
  const { data, error } = await service
    .from('social_sources')
    .select('*, brands(name, logo_url)')
    .order('source_name')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { brand_id, platform, source_type, source_name, url, is_official, active } = body

  if (!brand_id || !source_name?.trim() || !url?.trim()) {
    return Response.json({ error: 'brand_id, source_name i url wymagane' }, { status: 400 })
  }

  const service = getService()
  const { data, error } = await service
    .from('social_sources')
    .insert({
      brand_id,
      platform: platform || 'facebook',
      source_type: source_type || 'profile',
      source_name: source_name.trim(),
      url: url.trim(),
      is_official: is_official || false,
      active: active !== false,
    })
    .select('id')
    .single()

  if (error) {
    const msg = error.message.includes('duplicate') ? 'Źródło o takim URL już istnieje' : error.message
    return Response.json({ error: msg }, { status: 500 })
  }
  return Response.json({ ok: true, id: data.id })
}

export async function PATCH(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  if (updates.source_name) updates.source_name = updates.source_name.trim()
  if (updates.url) updates.url = updates.url.trim()

  const service = getService()
  const { error } = await service
    .from('social_sources')
    .update(updates)
    .eq('id', id)

  if (error) {
    const msg = error.message.includes('duplicate') ? 'Źródło o takim URL już istnieje' : error.message
    return Response.json({ error: msg }, { status: 500 })
  }
  return Response.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const service = getService()
  const { error } = await service
    .from('social_sources')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
