import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(request: Request) {
  const { brandId, email, brandName: clientBrandName, stats } = await request.json()

  if (!brandId || !email) {
    return Response.json({ error: 'Missing brandId or email' }, { status: 400 })
  }

  const brandName = clientBrandName || 'Twoja marka'
  const kpi = stats || { totalNew: 0, avgRating: 0, negativeCount: 0, unanswered: 0 }

  const { data: negativeReviews } = await supabase
    .from('reviews')
    .select('id, author_name, rating, content, source')
    .eq('brand_id', brandId)
    .lte('rating', 3)
    .order('review_date', { ascending: false })
    .limit(5)

  const reviews = negativeReviews || []

  const reviewCards = reviews.slice(0, 3).map(r => {
    const color = r.rating <= 1 ? '#ef4444' : r.rating === 2 ? '#f97316' : '#f59e0b'
    const bg    = r.rating <= 1 ? '#fff8f8' : r.rating === 2 ? '#fff7f3' : '#fffbf0'
    const border = r.rating <= 1 ? '#fca5a5' : r.rating === 2 ? '#fdba74' : '#fcd34d'
    return `
      <div style="border:1px solid ${border};border-left:4px solid ${color};border-radius:8px;padding:14px 16px;margin-bottom:10px;background:${bg};">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
          <tr>
            <td>
              <span style="background:${color};color:#fff;font-size:11px;font-weight:600;padding:3px 8px;border-radius:20px;margin-right:8px;">${r.rating}★</span>
              <span style="font-size:13px;font-weight:600;color:#111827;">${r.author_name || 'Anonim'}</span>
            </td>
            <td align="right" style="font-size:11px;color:#6b7280;">${r.source || ''}</td>
          </tr>
        </table>
        <p style="font-size:13px;color:#374151;margin:0;line-height:1.6;font-style:italic;">"${(r.content || '').slice(0, 150)}${(r.content || '').length > 150 ? '…' : ''}"</p>
      </div>`
  }).join('')

  const negBg     = kpi.negativeCount > 0 ? '#fff0f0' : '#f0fdf4'
  const negBorder = kpi.negativeCount > 0 ? '#fca5a5' : '#86efac'
  const negColor  = kpi.negativeCount > 0 ? '#b91c1c' : '#16a34a'
  const negLabel  = kpi.negativeCount > 0 ? '#991b1b' : '#166534'

  const html = `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;">

  <!-- Header -->
  <div style="background:#1a3a5c;padding:22px 28px;border-radius:10px 10px 0 0;">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.1em;color:rgba(255,255,255,0.5);margin-bottom:4px;">CATERINGMONITOR · TESTOWY EMAIL</div>
    <div style="font-size:18px;font-weight:600;color:#fff;margin-bottom:3px;">${brandName} — raport dzienny</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.65);">${new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>

  <!-- Body -->
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:28px;">

    <!-- Test banner -->
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
      <p style="font-size:13px;color:#713f12;margin:0;">⚡ To jest <strong>testowy email</strong>. Dane poniżej pochodzą z aktualnego stanu Review Manager dla marki <strong>${brandName}</strong>.</p>
    </div>

    <!-- Intro -->
    <p style="font-size:14px;color:#6b7280;margin:0 0 22px;">Poniżej przegląd opinii z bieżącego okresu.</p>

    <!-- KPI grid (table-based for email clients) -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;">
      <tr>
        <td width="24%" style="padding:0 4px 0 0;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 10px;text-align:center;">
            <div style="font-size:10px;color:#6b7280;margin-bottom:6px;">Nowe opinie</div>
            <div style="font-size:24px;font-weight:600;color:#111827;">${kpi.totalNew}</div>
          </div>
        </td>
        <td width="24%" style="padding:0 4px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 10px;text-align:center;">
            <div style="font-size:10px;color:#6b7280;margin-bottom:6px;">Śr. ocena</div>
            <div style="font-size:24px;font-weight:600;color:#111827;">${Number(kpi.avgRating).toFixed(1)}</div>
          </div>
        </td>
        <td width="24%" style="padding:0 4px;">
          <div style="background:${negBg};border:1px solid ${negBorder};border-radius:8px;padding:14px 10px;text-align:center;">
            <div style="font-size:10px;color:${negLabel};margin-bottom:6px;">Negatywne</div>
            <div style="font-size:24px;font-weight:600;color:${negColor};">${kpi.negativeCount}</div>
          </div>
        </td>
        <td width="24%" style="padding:0 0 0 4px;">
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 10px;text-align:center;">
            <div style="font-size:10px;color:#92400e;margin-bottom:6px;">Bez odpowiedzi</div>
            <div style="font-size:24px;font-weight:600;color:#d97706;">${kpi.unanswered}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Review cards -->
    ${reviews.length > 0 ? `
    <div style="margin-bottom:26px;">
      <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Wymagają Twojej uwagi</div>
      ${reviewCards}
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:18px;margin-bottom:26px;text-align:center;">
      <p style="color:#166534;font-size:14px;margin:0;">✓ Brak negatywnych opinii do pokazania</p>
    </div>`}

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://cateringmonitor.pl/review-manager"
         style="display:inline-block;background:#1a3a5c;color:#fff;font-size:14px;font-weight:600;padding:13px 30px;border-radius:8px;text-decoration:none;letter-spacing:0.01em;">
        Otwórz Review Manager →
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #f3f4f6;padding-top:16px;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">CateringMonitor · testowy email · wysłany ręcznie z panelu ustawień</p>
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
      from: 'CateringMonitor <onboarding@resend.dev>',
      to: [email],
      subject: `[TEST] ${brandName} — raport CateringMonitor | ${kpi.negativeCount > 0 ? `${kpi.negativeCount} negatywnych` : 'brak negatywnych'}`,
      html,
    }),
  })

  if (!resendRes.ok) {
    const err = await resendRes.text()
    return Response.json({ error: 'Resend error', detail: err }, { status: 502 })
  }

  return Response.json({ ok: true })
}
