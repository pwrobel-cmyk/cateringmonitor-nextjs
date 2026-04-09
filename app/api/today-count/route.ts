import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Get auth token from request
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  let brandId: string | null = null

  if (token) {
    // Get user from token
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      const { data: assignment } = await supabase
        .from('user_brand_assignments')
        .select('brand_id')
        .eq('user_id', user.id)
        .single()
      brandId = assignment?.brand_id || null
    }
  }

  let query = supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .lte('rating', 3)
    .gte('review_date', twoDaysAgo)
    .not('status', 'in', '("done","skipped")')
    .eq('is_approved', true)

  if (brandId) {
    query = query.eq('brand_id', brandId)
  }

  const { count } = await query

  return Response.json({ count: count || 0 })
}
