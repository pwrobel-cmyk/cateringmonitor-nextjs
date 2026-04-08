import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { reviews } = await request.json()
  const duplicateIds: string[] = []
  let savedResponses = 0

  for (const review of reviews) {
    const { data } = await supabase
      .from('reviews')
      .select('id')
      .eq('brand_id', review.brand_id)
      .ilike('author_name', review.author_name.trim())
      .ilike('content', review.content.slice(0, 40).replace(/[%_\\]/g, '').trim() + '%')
      .limit(1)

    if (data && data.length > 0) {
      duplicateIds.push(review._fp)

      // If the duplicate review has an owner_response, save it if not already present
      if (review.owner_response && data[0]?.id) {
        const { data: existingResponse } = await supabase
          .from('review_responses')
          .select('id')
          .eq('review_id', data[0].id)
          .eq('source', 'manual')
          .limit(1)

        if (!existingResponse || existingResponse.length === 0) {
          await supabase.from('review_responses').insert({
            review_id: data[0].id,
            brand_id: review.brand_id,
            body: review.owner_response,
            tone: 'professional',
            source: 'manual',
            status: 'published',
          })
          savedResponses++
        }
      }
    }
  }

  return Response.json({ duplicateIds, savedResponses })
}
