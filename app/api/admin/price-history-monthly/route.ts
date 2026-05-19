import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')!
  const to = searchParams.get('to')!

  const { data, error } = await supabase.rpc('get_price_history_monthly', {
    p_from: from,
    p_to: to,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}
