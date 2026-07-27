import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { action, stagingId, brandId } = await request.json()

  if (!stagingId || !['accept', 'reject', 'restore', 'assign-brand'].includes(action)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (action === 'assign-brand') {
    if (!brandId) {
      return Response.json({ error: 'Missing brandId' }, { status: 400 })
    }
    const { error } = await service
      .from('discount_staging')
      .update({ brand_id: brandId })
      .eq('id', stagingId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'reject') {
    const { error } = await service
      .from('discount_staging')
      .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', stagingId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'restore') {
    const { error } = await service
      .from('discount_staging')
      .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
      .eq('id', stagingId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // action === 'accept'
  const { data: staging, error: fetchErr } = await service
    .from('discount_staging')
    .select('*')
    .eq('id', stagingId)
    .single()

  if (fetchErr || !staging) {
    return Response.json({ error: 'Staging record not found' }, { status: 404 })
  }

  if (!staging.brand_id) {
    return Response.json({ error: 'Przypisz markę przed akceptacją' }, { status: 400 })
  }

  // INSERT into discounts
  const { data: inserted, error: insertErr } = await service
    .from('discounts')
    .insert({
      brand_id: staging.brand_id,
      code: staging.code || '',
      percentage: staging.percentage,
      valid_from: staging.valid_from,
      valid_until: staging.valid_until,
      description: staging.description,
      min_days: staging.min_days,
      requirements: staging.requirements,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertErr) {
    return Response.json({ error: insertErr.message }, { status: 500 })
  }

  // UPDATE staging record
  const { error: updateErr } = await service
    .from('discount_staging')
    .update({
      status: 'accepted',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      accepted_discount_id: inserted.id,
    })
    .eq('id', stagingId)

  if (updateErr) {
    return Response.json({ error: updateErr.message }, { status: 500 })
  }

  return Response.json({ ok: true, discountId: inserted.id })
}
