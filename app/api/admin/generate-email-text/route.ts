import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { prompt } = await request.json()
  if (!prompt?.trim()) {
    return Response.json({ error: 'No prompt provided' }, { status: 400 })
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Jesteś copywriterem piszącym emaile dla platformy Catering Monitor — narzędzia do monitorowania rynku cateringowego. Piszesz do klientów/subskrybentów platformy.
Styl: profesjonalny ale przyjazny, po polsku.
Zwracaj TYLKO JSON w formacie: {"subject": "...", "paragraphs": ["...", "..."]}
Paragraphs to tablica akapitów (każdy to jeden akapit tekstu, bez HTML). Nie dodawaj powitania ani podpisu — te są generowane automatycznie.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: `OpenAI error: ${err}` }, { status: 500 })
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) return Response.json({ error: 'No response from AI' }, { status: 500 })

  try {
    const parsed = JSON.parse(content)
    return Response.json(parsed)
  } catch {
    return Response.json({ error: 'Invalid AI response format' }, { status: 500 })
  }
}
