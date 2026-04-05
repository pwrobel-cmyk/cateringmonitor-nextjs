export async function POST(request: Request) {
  const { brandName, rating, content } = await request.json()

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_KEY || '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: `Jesteś customer success managerem marki ${brandName}. Klient zostawił negatywną opinię. Napisz profesjonalną, empatyczną odpowiedź po polsku. Przyznaj się do problemu, przeproś, zaproponuj rozwiązanie. Max 4 zdania.`,
      messages: [{ role: 'user', content: `Opinia (${rating}★): ${content}` }],
    }),
  })

  if (!res.ok) {
    return Response.json({ error: 'Anthropic API error', status: res.status }, { status: 502 })
  }

  const json = await res.json()
  const text = json.content?.[0]?.text || ''
  return Response.json({ text })
}
