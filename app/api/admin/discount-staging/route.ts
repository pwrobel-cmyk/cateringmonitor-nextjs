import { getAdminUser, getService } from '@/lib/adminAuth'

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) { return Response.json({ error: 'Unauthorized' }, { status: 403 }) }

  const { action, stagingId, brandId, overrides } = await request.json()

  if (!stagingId || !['accept', 'reject', 'restore', 'assign-brand'].includes(action)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = getService()

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

  // Use overrides from form if provided, fall back to staging values
  const o = overrides || {}
  const brandIdFinal = o.brand_id || staging.brand_id
  if (!brandIdFinal) {
    return Response.json({ error: 'Przypisz markę przed akceptacją' }, { status: 400 })
  }

  // INSERT into discounts
  const { data: inserted, error: insertErr } = await service
    .from('discounts')
    .insert({
      brand_id: brandIdFinal,
      code: o.code ?? staging.code ?? '',
      percentage: o.percentage !== undefined ? o.percentage : staging.percentage,
      fixed_amount: o.fixed_amount !== undefined ? o.fixed_amount : staging.fixed_amount,
      valid_from: o.valid_from !== undefined ? o.valid_from : staging.valid_from,
      valid_until: o.valid_until !== undefined ? o.valid_until : staging.valid_until,
      description: o.description !== undefined ? o.description : staging.description,
      min_days: o.min_days !== undefined ? o.min_days : staging.min_days,
      max_days: o.max_days !== undefined ? o.max_days : staging.max_days,
      min_order_value: o.min_order_value !== undefined ? o.min_order_value : staging.min_order_value,
      requirements: o.requirements !== undefined ? o.requirements : staging.requirements,
      exclusions_limits: o.exclusions_limits !== undefined ? o.exclusions_limits : staging.exclusions_limits,
      communication_channels: o.communication_channels !== undefined ? o.communication_channels : staging.communication_channels,
      additional_notes: o.additional_notes !== undefined ? o.additional_notes : staging.additional_notes,
      code_source: o.code_source !== undefined ? o.code_source : staging.code_source,
      is_cashback: o.is_cashback !== undefined ? o.is_cashback : (staging.is_cashback || false),
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
