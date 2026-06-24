import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: Request) {
  const { brandId, packageName, kcalRangeId } = await request.json()

  // Upsert package
  const { data: pkg } = await supabase
    .from('packages')
    .upsert({ name: packageName, brand_id: brandId }, { onConflict: 'name,brand_id' })
    .select('id')
    .single()

  if (!pkg) return Response.json({ error: 'Failed to create package' }, { status: 500 })

  // Upsert package_kcal_range
  const { data: pkr } = await supabase
    .from('package_kcal_ranges')
    .upsert(
      { package_id: pkg.id, kcal_range_id: kcalRangeId },
      { onConflict: 'package_id,kcal_range_id' },
    )
    .select('id')
    .single()

  if (!pkr) return Response.json({ error: 'Failed to create package_kcal_range' }, { status: 500 })

  return Response.json({ packageId: pkg.id, packageKcalRangeId: pkr.id })
}
