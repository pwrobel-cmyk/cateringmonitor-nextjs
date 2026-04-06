
export async function POST(request: Request) {
  const { brandId, email, brandName: clientBrandName, userName: clientUserName } = await request.json()

  if (!brandId || !email) {
    return Response.json({ error: 'Missing brandId or email' }, { status: 400 })
  }

  const brandName = clientBrandName || 'Twoja marka'
  const userName = clientUserName || 'Pawle'
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const headers = {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
  }

  // 1. Opinie z ostatnich 7 dni (negatywne — alerty + KPI)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const negativeRes = await fetch(
    `${SUPABASE_URL}/rest/v1/reviews?select=id,author_name,rating,content,source,review_date,status&brand_id=eq.${brandId}&rating=lte.3&review_date=gte.${sevenDaysAgo.toISOString()}&order=review_date.desc&limit=10`,
    { headers }
  )
  const negativeReviews: any[] = await negativeRes.json().then(d => Array.isArray(d) ? d : [])

  // 2. Opinie z ostatnich 7 dni (wszystkie — dla trendu)
  const reviews7dRes = await fetch(
    `${SUPABASE_URL}/rest/v1/reviews?select=rating,content&brand_id=eq.${brandId}&review_date=gte.${sevenDaysAgo.toISOString()}`,
    { headers }
  )
  const reviews7d: any[] = await reviews7dRes.json().then(d => Array.isArray(d) ? d : [])

  // 3. Liczba bez odpowiedzi (z ostatnich 7 dni, status != done/skipped)
  const unansweredCount = negativeReviews.filter((r: any) => r.status !== 'done' && r.status !== 'skipped').length

  // 4. Oblicz metryki
  const newCount = negativeReviews.length
  const avgRating7d = reviews7d.length > 0
    ? (reviews7d.reduce((s: number, r: any) => s + r.rating, 0) / reviews7d.length).toFixed(1)
    : 'brak'
  const positivePct = reviews7d.length > 0
    ? Math.round(reviews7d.filter((r: any) => r.rating >= 4).length / reviews7d.length * 100)
    : 0

  // Główny problem w negatywnych opiniach
  const TOPICS: Record<string, string[]> = {
    dostawa: ['dostaw', 'kurier'],
    smak: ['smak', 'pyszn', 'smaczn'],
    porcje: ['porcj', 'ilość'],
    cena: ['cen', 'drogie'],
    obsługa: ['obsług', 'kontakt'],
    jakość: ['jakość', 'quality'],
  }
  function getTopics(content: string | null): string[] {
    if (!content) return []
    const lower = content.toLowerCase()
    return Object.entries(TOPICS)
      .filter(([, kws]) => kws.some(kw => lower.includes(kw)))
      .map(([k]) => k)
  }

  const allNegativeContent = negativeReviews.map((r: any) => r.content || '').join(' ')
  const topicCounts = Object.entries(TOPICS).map(([topic, kws]) => ({
    topic,
    count: kws.reduce((s, kw) => s + (allNegativeContent.toLowerCase().split(kw).length - 1), 0),
  }))
  const mainProblem = topicCounts.sort((a, b) => b.count - a.count)[0]

  // 5. HTML szablonu
  const dateStr = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const reviewCards = negativeReviews.slice(0, 3).map((r: any) => {
    const color = r.rating === 1 ? '#ef4444' : r.rating === 2 ? '#f97316' : '#f59e0b'
    const bg = r.rating === 1 ? '#fff8f8' : r.rating === 2 ? '#fff7f3' : '#fffbf0'
    const border = r.rating === 1 ? '#fca5a5' : r.rating === 2 ? '#fdba74' : '#fcd34d'
    const topics = getTopics(r.content)
    const reviewDate = r.review_date ? new Date(r.review_date).toLocaleDateString('pl-PL') : ''
    const tagsHtml = topics.length > 0
      ? `<div style="margin-top:8px;">${topics.map(t => `<span style="display:inline-block;font-size:10px;background:#f3f4f6;color:#374151;border-radius:4px;padding:2px 6px;margin-right:4px;">${t}</span>`).join('')}</div>`
      : ''
    return `
      <div style="border:1px solid ${border};border-left:4px solid ${color};border-radius:8px;padding:12px 14px;margin-bottom:8px;background:${bg};">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
          <tr>
            <td>
              <span style="background:${color};color:#fff;font-size:11px;padding:2px 7px;border-radius:20px;margin-right:8px;">${r.rating}★</span>
              <span style="font-size:13px;font-weight:500;color:#111827;">${r.author_name || 'Anonim'}</span>
            </td>
            <td align="right" style="font-size:11px;color:#6b7280;">${r.source || ''}${reviewDate ? ' · ' + reviewDate : ''}</td>
          </tr>
        </table>
        <p style="font-size:13px;color:#374151;margin:0;line-height:1.5;">"${(r.content || '').slice(0, 150)}${(r.content || '').length > 150 ? '…' : ''}"</p>
        ${tagsHtml}
      </div>`
  }).join('')

  const attentionSection = negativeReviews.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:12px;font-weight:500;color:#6b7280;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;">Wymagają Twojej uwagi</div>
      ${reviewCards}
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="color:#166534;font-size:14px;margin:0;">Brak negatywnych opinii z ostatnich 7 dni</p>
    </div>`

  const trendSection = `
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:500;color:#6b7280;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;">Trend tygodniowy</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#374151;">Główny problem</td>
          <td align="right" style="font-size:13px;font-weight:500;color:#111827;">${mainProblem && mainProblem.count > 0 ? mainProblem.topic : '—'}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#374151;border-top:1px solid #e5e7eb;">Śr. ocena (7 dni)</td>
          <td align="right" style="font-size:13px;font-weight:500;color:#111827;border-top:1px solid #e5e7eb;">${avgRating7d}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#374151;border-top:1px solid #e5e7eb;">% pozytywnych (7 dni)</td>
          <td align="right" style="font-size:13px;font-weight:500;color:${positivePct >= 70 ? '#16a34a' : positivePct >= 50 ? '#d97706' : '#b91c1c'};border-top:1px solid #e5e7eb;">${reviews7d.length > 0 ? positivePct + '%' : '—'}</td>
        </tr>
      </table>
    </div>`

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:sans-serif;">
<div style="max-width:600px;margin:0 auto;">

  <div style="background:#1a3a5c;padding:20px 24px;border-radius:8px 8px 0 0;">
    <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:2px;">CATERINGMONITOR</div>
    <div style="font-size:16px;font-weight:500;color:#fff;">${brandName} — raport dzienny</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">${dateStr}</div>
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">

    <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">Dzień dobry ${userName}, oto przegląd opinii z ostatnich 7 dni.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td width="25%" style="padding:4px;">
          <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Negatywne (7d)</div>
            <div style="font-size:22px;font-weight:500;color:${newCount > 0 ? '#b91c1c' : '#16a34a'};">${newCount}</div>
          </div>
        </td>
        <td width="25%" style="padding:4px;">
          <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Śr. ocena (7d)</div>
            <div style="font-size:22px;font-weight:500;color:#111827;">${avgRating7d}</div>
          </div>
        </td>
        <td width="25%" style="padding:4px;">
          <div style="background:${negativeReviews.length > 0 ? '#fff0f0' : '#f0fdf4'};border:1px solid ${negativeReviews.length > 0 ? '#fca5a5' : '#86efac'};border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:${negativeReviews.length > 0 ? '#991b1b' : '#166534'};margin-bottom:4px;">Negatywne</div>
            <div style="font-size:22px;font-weight:500;color:${negativeReviews.length > 0 ? '#b91c1c' : '#16a34a'};">${negativeReviews.length}</div>
          </div>
        </td>
        <td width="25%" style="padding:4px;">
          <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Bez odpowiedzi</div>
            <div style="font-size:22px;font-weight:500;color:#d97706;">${unansweredCount}</div>
          </div>
        </td>
      </tr>
    </table>

    ${attentionSection}

    ${trendSection}

    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://cateringmonitor.pl/review-manager" style="display:inline-block;background:#1a3a5c;color:#fff;font-size:14px;font-weight:500;padding:12px 28px;border-radius:8px;text-decoration:none;">Otwórz Review Manager</a>
    </div>

    <div style="border-top:1px solid #e5e7eb;padding-top:14px;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">CateringMonitor · wysłany ręcznie z panelu ustawień</p>
    </div>

  </div>
</div>
</body>
</html>`

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'CateringMonitor <raporty@cateringmonitor.pl>',
      to: [email],
      subject: `[TEST] ${brandName} — testowy raport CateringMonitor`,
      html,
    }),
  })

  if (!resendRes.ok) {
    const err = await resendRes.text()
    return Response.json({ error: 'Resend error', detail: err }, { status: 502 })
  }

  return Response.json({ ok: true })
}
