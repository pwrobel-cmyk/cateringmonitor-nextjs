import { createClient } from '@supabase/supabase-js'
import { fal } from '@fal-ai/client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { prompt, type, model, userId, brandId, referenceUrls } = await request.json()

  if (!prompt || !type || !userId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  fal.config({ credentials: process.env.FAL_KEY! })

  try {
    let result: any

    if (type === 'image') {
      const modelId = model || 'fal-ai/flux/schnell'
      result = await fal.run(modelId, {
        input: {
          prompt,
          image_size: 'landscape_16_9',
          num_inference_steps: 4,
          num_images: 1,
          ...(referenceUrls?.length ? { image_url: referenceUrls[0] } : {}),
        },
      })
    } else if (type === 'video') {
      const modelId = model || 'fal-ai/kling-video/v1.6/standard/text-to-video'
      result = await fal.run(modelId, {
        input: {
          prompt,
          duration: '5',
          aspect_ratio: '16:9',
        },
      })
    }

    const outputUrl = type === 'image'
      ? result?.images?.[0]?.url
      : result?.video?.url

    if (!outputUrl) {
      return Response.json({ error: 'No output from model' }, { status: 500 })
    }

    // Pobierz plik i zapisz do Supabase Storage
    const fileRes = await fetch(outputUrl)
    const buffer = await fileRes.arrayBuffer()
    const ext = type === 'image' ? 'jpg' : 'mp4'
    const filename = `${userId}/${Date.now()}.${ext}`
    const contentType = type === 'image' ? 'image/jpeg' : 'video/mp4'

    const { error: uploadError } = await supabase.storage
      .from('ai-assets')
      .upload(filename, buffer, { contentType, upsert: false })

    if (uploadError) {
      return Response.json({ error: 'Storage upload failed', detail: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('ai-assets').getPublicUrl(filename)

    // Zapisz do tabeli ai_assets
    const { data: asset, error: dbError } = await supabase.from('ai_assets').insert({
      user_id: userId,
      brand_id: brandId || null,
      type,
      prompt,
      model: model || (type === 'image' ? 'fal-ai/flux/schnell' : 'fal-ai/kling-video/v1.6/standard/text-to-video'),
      url: publicUrl,
      storage_path: filename,
      width: type === 'image' ? result?.images?.[0]?.width : null,
      height: type === 'image' ? result?.images?.[0]?.height : null,
      source: 'generated',
    }).select().single()

    if (dbError) return Response.json({ error: dbError.message }, { status: 500 })

    return Response.json({ asset })

  } catch (err: any) {
    console.error('[ai/generate] error:', err)
    return Response.json({ error: err.message || 'Generation failed' }, { status: 500 })
  }
}
