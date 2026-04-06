
export async function POST(request: Request) {
  const { brandId, email, brandName: clientBrandName, fullName } = await request.json()

  if (!brandId || !email) {
    return Response.json({ error: 'Missing brandId or email' }, { status: 400 })
  }

  const brandName = clientBrandName || 'Twoja marka'
  const userName = fullName?.split(' ')[0] || 'Pawle'
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const headers = {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  // Fetch all in parallel
  const [negativeRes, positiveRes, reviews7dRes, prev7dRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/reviews?select=id,author_name,rating,content,source,review_date,status&brand_id=eq.${brandId}&rating=lte.3&review_date=gte.${sevenDaysAgo.toISOString()}&order=review_date.desc`,
      { headers }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/reviews?select=id,author_name,rating,content,source,review_date&brand_id=eq.${brandId}&rating=gte.4&review_date=gte.${sevenDaysAgo.toISOString()}&order=review_date.desc&limit=3`,
      { headers }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/reviews?select=rating,content&brand_id=eq.${brandId}&review_date=gte.${sevenDaysAgo.toISOString()}`,
      { headers }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/reviews?select=rating,content&brand_id=eq.${brandId}&review_date=gte.${fourteenDaysAgo.toISOString()}&review_date=lt.${sevenDaysAgo.toISOString()}`,
      { headers }
    ),
  ])

  const negativeReviews: any[] = await negativeRes.json().then(d => Array.isArray(d) ? d : [])
  const positiveReviews: any[] = await positiveRes.json().then(d => Array.isArray(d) ? d : [])
  const reviews7d: any[] = await reviews7dRes.json().then(d => Array.isArray(d) ? d : [])
  const prev7d: any[] = await prev7dRes.json().then(d => Array.isArray(d) ? d : [])

  // Metrics helper
  const calcMetrics = (reviews: any[]) => ({
    total: reviews.length,
    positive: reviews.filter(r => r.rating >= 4).length,
    negative: reviews.filter(r => r.rating <= 3).length,
    avgRating: reviews.length > 0 ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : 0,
    positivePct: reviews.length > 0 ? reviews.filter(r => r.rating >= 4).length / reviews.length * 100 : 0,
    negativePct: reviews.length > 0 ? reviews.filter(r => r.rating <= 3).length / reviews.length * 100 : 0,
  })
  const curr = calcMetrics(reviews7d)
  const prev = calcMetrics(prev7d)

  const unansweredCount = negativeReviews.filter((r: any) => r.status !== 'done' && r.status !== 'skipped').length

  // Topics for per-review tags
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

  // Problems with emoji (for problems section)
  const problemMap: Record<string, { emoji: string; keywords: string[] }> = {
    'Dostawa': { emoji: '🚚', keywords: ['dostaw', 'kurier', 'przesyłk'] },
    'Porcje':  { emoji: '🍽️', keywords: ['porcj', 'ilość', 'za mało'] },
    'Smak':    { emoji: '😋', keywords: ['smak', 'niesmaczn', 'bez smaku'] },
    'Cena':    { emoji: '💰', keywords: ['cen', 'drogie', 'za drogo'] },
    'Obsługa': { emoji: '🤝', keywords: ['obsług', 'kontakt', 'odpowied'] },
    'Jakość':  { emoji: '⭐', keywords: ['jakość', 'nieświeże', 'zepsut'] },
  }
  const allNegContent = negativeReviews.map((r: any) => r.content || '').join(' ').toLowerCase()
  const problems = Object.entries(problemMap)
    .map(([name, { emoji, keywords }]) => ({
      name, emoji,
      count: keywords.reduce((s, kw) => s + (allNegContent.match(new RegExp(kw, 'g')) || []).length, 0),
    }))
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  // HTML helpers
  const dateStr = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  function badge(curr: number, prev: number, higherIsBetter = true): string {
    if (prev === 0) return ''
    const better = higherIsBetter ? curr > prev : curr < prev
    const same = Math.abs(curr - prev) < 0.01
    if (same) return '<span style="font-size:10px;background:#f3f4f6;color:#6b7280;border-radius:4px;padding:1px 5px;margin-left:6px;">→</span>'
    const color = better ? '#16a34a' : '#b91c1c'
    const bg = better ? '#f0fdf4' : '#fff0f0'
    const arrow = better ? '↑' : '↓'
    return `<span style="font-size:10px;background:${bg};color:${color};border-radius:4px;padding:1px 5px;margin-left:6px;">${arrow}</span>`
  }

  const reviewCards = negativeReviews.map((r: any) => {
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

  const positiveCards = positiveReviews.map((r: any) => {
    const reviewDate = r.review_date ? new Date(r.review_date).toLocaleDateString('pl-PL') : ''
    return `
      <div style="border:1px solid #86efac;border-left:4px solid #16a34a;border-radius:8px;padding:12px 14px;margin-bottom:8px;background:#f0fdf4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
          <tr>
            <td>
              <span style="background:#16a34a;color:#fff;font-size:11px;padding:2px 7px;border-radius:20px;margin-right:8px;">${r.rating}★</span>
              <span style="font-size:13px;font-weight:500;color:#111827;">${r.author_name || 'Anonim'}</span>
            </td>
            <td align="right" style="font-size:11px;color:#6b7280;">${r.source || ''}${reviewDate ? ' · ' + reviewDate : ''}</td>
          </tr>
        </table>
        <p style="font-size:13px;color:#374151;margin:0;line-height:1.5;">"${(r.content || '').slice(0, 150)}${(r.content || '').length > 150 ? '…' : ''}"</p>
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

  const positiveSection = positiveReviews.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:12px;font-weight:500;color:#6b7280;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;">Pozytywne — warto podziękować</div>
      ${positiveCards}
    </div>` : ''

  const problemsSection = problems.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:12px;font-weight:500;color:#6b7280;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;">Główne problemy</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${problems.map((p, i) => {
            const bg = i === 0 ? '#fff0f0' : '#fffbf0'
            const border = i === 0 ? '#fca5a5' : '#fcd34d'
            const color = i === 0 ? '#b91c1c' : '#92400e'
            return `<td width="${Math.floor(100 / problems.length)}%" style="padding:4px;">
              <div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:18px;margin-bottom:4px;">${p.emoji}</div>
                <div style="font-size:12px;font-weight:500;color:${color};margin-bottom:2px;">${p.name}</div>
                <div style="font-size:11px;color:#6b7280;">${p.count} ${p.count === 1 ? 'wzmianka' : 'wzmianki'}</div>
              </div>
            </td>`
          }).join('')}
        </tr>
      </table>
    </div>` : ''

  const sentimentSection = `
    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:500;color:#6b7280;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;">Sentyment — ten tydzień vs poprzedni</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:7px 0;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">Pozytywne %</td>
          <td align="right" style="padding:7px 0;font-size:13px;font-weight:500;color:#111827;border-bottom:1px solid #e5e7eb;">
            <span style="color:#6b7280;font-weight:400;">${prev.total > 0 ? Math.round(prev.positivePct) + '%' : '—'}</span>
            <span style="color:#9ca3af;margin:0 4px;">→</span>
            ${Math.round(curr.positivePct)}%
            ${badge(curr.positivePct, prev.positivePct, true)}
          </td>
        </tr>
        <tr>
          <td style="padding:7px 0;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">Negatywne %</td>
          <td align="right" style="padding:7px 0;font-size:13px;font-weight:500;color:#111827;border-bottom:1px solid #e5e7eb;">
            <span style="color:#6b7280;font-weight:400;">${prev.total > 0 ? Math.round(prev.negativePct) + '%' : '—'}</span>
            <span style="color:#9ca3af;margin:0 4px;">→</span>
            ${Math.round(curr.negativePct)}%
            ${badge(curr.negativePct, prev.negativePct, false)}
          </td>
        </tr>
        <tr>
          <td style="padding:7px 0;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">Średnia ocena</td>
          <td align="right" style="padding:7px 0;font-size:13px;font-weight:500;color:#111827;border-bottom:1px solid #e5e7eb;">
            <span style="color:#6b7280;font-weight:400;">${prev.total > 0 ? prev.avgRating.toFixed(1) : '—'}</span>
            <span style="color:#9ca3af;margin:0 4px;">→</span>
            ${curr.total > 0 ? curr.avgRating.toFixed(1) : '—'}
            ${badge(curr.avgRating, prev.avgRating, true)}
          </td>
        </tr>
        <tr>
          <td style="padding:7px 0;font-size:13px;color:#374151;">Liczba opinii</td>
          <td align="right" style="padding:7px 0;font-size:13px;font-weight:500;color:#111827;">
            <span style="color:#6b7280;font-weight:400;">${prev.total}</span>
            <span style="color:#9ca3af;margin:0 4px;">→</span>
            ${curr.total}
            ${badge(curr.total, prev.total, true)}
          </td>
        </tr>
      </table>
    </div>`

  const summaryText = (() => {
    if (curr.total === 0) return 'Brak opinii w tym tygodniu.'
    if (prev.total === 0) return `W tym tygodniu zebrano ${curr.total} opinii. Brak danych z poprzedniego tygodnia do porównania.`
    if (curr.positivePct > prev.positivePct + 2) {
      return `Sentyment poprawił się — odsetek pozytywnych opinii wzrósł z ${Math.round(prev.positivePct)}% do ${Math.round(curr.positivePct)}%.${problems.length > 0 ? ` Główny obszar do poprawy: <strong>${problems[0].name}</strong>.` : ''}`
    }
    if (curr.positivePct < prev.positivePct - 2) {
      return `Uwaga: sentyment pogorszył się — odsetek pozytywnych spadł z ${Math.round(prev.positivePct)}% do ${Math.round(curr.positivePct)}%.${problems.length > 0 ? ` Najczęstszy problem: <strong>${problems[0].name}</strong>.` : ''}`
    }
    return `Sentyment stabilny. Odsetek pozytywnych opinii: ${Math.round(curr.positivePct)}%.${problems.length > 0 ? ` Główny obszar do uwagi: <strong>${problems[0].name}</strong>.` : ''}`
  })()

  const summarySection = `
    <div style="background:#1a3a5c;border-radius:8px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:500;color:rgba(255,255,255,0.6);letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">Podsumowanie tygodnia</div>
      <p style="font-size:13px;color:#e2e8f0;margin:0;line-height:1.6;">${summaryText}</p>
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
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Wszystkie (7d)</div>
            <div style="font-size:22px;font-weight:500;color:#111827;">${curr.total}</div>
          </div>
        </td>
        <td width="25%" style="padding:4px;">
          <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Śr. ocena (7d)</div>
            <div style="font-size:22px;font-weight:500;color:#111827;">${curr.total > 0 ? curr.avgRating.toFixed(1) : '—'}</div>
          </div>
        </td>
        <td width="25%" style="padding:4px;">
          <div style="background:${negativeReviews.length > 0 ? '#fff0f0' : '#f0fdf4'};border:1px solid ${negativeReviews.length > 0 ? '#fca5a5' : '#86efac'};border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:${negativeReviews.length > 0 ? '#991b1b' : '#166534'};margin-bottom:4px;">Negatywne (7d)</div>
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

    ${positiveSection}

    ${problemsSection}

    ${sentimentSection}

    ${summarySection}

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
