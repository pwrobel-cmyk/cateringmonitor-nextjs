import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { reviews } = await request.json()
  const duplicateIds: string[] = []

  for (const review of reviews) {
    const { data } = await supabase
      .from('reviews')
      .select('id')
      .eq('brand_id', review.brand_id)
      .eq('author_name', review.author_name)
      .ilike('content', review.content.slice(0, 80).replace(/[%_]/g, '') + '%')
      .limit(1)

    if (data && data.length > 0) {
      duplicateIds.push(review._fp)
    }
  }

  return Response.json({ duplicateIds })
}
