import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { count } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .lte('rating', 3)
    .gte('review_date', twoDaysAgo)
    .not('status', 'in', '("done","skipped")')
    .eq('is_approved', true)

  return Response.json({ count: count || 0 })
}
