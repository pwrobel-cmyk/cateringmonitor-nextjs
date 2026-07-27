import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const token = request.headers.get('x-import-token')
  if (!token || token !== process.env.DISCOUNT_IMPORT_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const url = new URL(request.url)
  const platform = url.searchParams.get('platform')

  let query = service
    .from('social_sources')
    .select('id, brand_id, platform, source_type, source_name, url, is_official, brands(name)')
    .eq('active', true)
    .order('source_name')

  if (platform) {
    query = query.eq('platform', platform)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const sources = (data || []).map((s: any) => ({
    id: s.id,
    brand_id: s.brand_id,
    brand_name: s.brands?.name || null,
    platform: s.platform,
    source_type: s.source_type,
    source_name: s.source_name,
    url: s.url,
    is_official: s.is_official,
  }))

  return Response.json({ sources })
}
