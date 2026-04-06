import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(request: Request) {
  const { brandId, email, brandName: clientBrandName } = await request.json()

  console.log('brandId:', brandId, 'email:', email)

  if (!brandId || !email) {
    return Response.json({ error: 'Missing brandId or email' }, { status: 400 })
  }

  const brandName = clientBrandName || 'Twoja marka'

  const { data: negativeReviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('id, author_name, rating, content, source')
    .eq('brand_id', brandId)
    .lte('rating', 3)
    .order('review_date', { ascending: false })
    .limit(5)
  console.log('reviews:', negativeReviews?.length, 'error:', reviewsError)

  const reviews = negativeReviews || []

  const negativeSections = reviews.map(r => {
    const color = r.rating === 1 ? '#ef4444' : '#f59e0b'
    const bg = r.rating === 1 ? '#fff8f8' : '#fffbf0'
    const border = r.rating === 1 ? '#fca5a5' : '#fcd34d'
    return `
      <div style="border:0.5px solid ${border};border-left:3px solid ${color};border-radius:8px;padding:12px 14px;margin-bottom:8px;background:${bg};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="background:${color};color:#fff;font-size:11px;padding:2px 7px;border-radius:20px;">${r.rating}★</span>
            <span style="font-size:13px;font-weight:500;">${r.author_name}</span>
          </div>
          <span style="font-size:11px;color:#6b7280;">${r.source}</span>
        </div>
        <p style="font-size:13px;color:#374151;margin:0;line-height:1.5;">"${(r.content || '').slice(0, 120)}..."</p>
      </div>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:sans-serif;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#1a3a5c;padding:20px 24px;border-radius:8px 8px 0 0;">
    <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:2px;">CATERINGMONITOR · TESTOWY EMAIL</div>
    <div style="font-size:16px;font-weight:500;color:#fff;">${brandName} — raport dzienny (testowy)</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">${new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>
  <div style="background:#fff;border:0.5px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
    <div style="background:#fef9c3;border:0.5px solid #fde047;border-radius:8px;padding:12px 14px;margin-bottom:20px;">
      <p style="font-size:13px;color:#713f12;margin:0;">To jest testowy email. Poniżej 5 ostatnich negatywnych opinii dla ${brandName}.</p>
    </div>

    <div style="margin-bottom:24px;">
      <div style="font-size:12px;font-weight:500;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Ostatnie negatywne opinie</div>
      ${reviews.length > 0 ? negativeSections : '<p style="color:#6b7280;font-size:14px;">Brak negatywnych opinii.</p>'}
    </div>

    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://cateringmonitor.pl/review-manager" style="display:inline-block;background:#1a3a5c;color:#fff;font-size:14px;font-weight:500;padding:12px 28px;border-radius:8px;text-decoration:none;">Otwórz Review Manager</a>
    </div>

    <div style="border-top:0.5px solid #e5e7eb;padding-top:14px;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">CateringMonitor · testowy email wysłany ręcznie</p>
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
