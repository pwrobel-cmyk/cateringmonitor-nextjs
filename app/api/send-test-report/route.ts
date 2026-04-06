
export async function POST(request: Request) {
  const { brandId, email, brandName: clientBrandName } = await request.json()

  if (!brandId || !email) {
    return Response.json({ error: 'Missing brandId or email' }, { status: 400 })
  }

  const brandName = clientBrandName || 'Twoja marka'

  const reviewsRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/reviews?select=id,author_name,rating,content,source&brand_id=eq.${brandId}&rating=lte.3&order=review_date.desc&limit=5`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      }
    }
  )
  const reviews = await reviewsRes.json()
  console.log('[test-email] reviews:', Array.isArray(reviews) ? reviews.length : JSON.stringify(reviews).slice(0, 100))

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:sans-serif;">
<div style="max-width:600px;margin:0 auto;">

  <div style="background:#1a3a5c;padding:20px 24px;border-radius:8px 8px 0 0;">
    <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:2px;">CATERINGMONITOR</div>
    <div style="font-size:16px;font-weight:500;color:#fff;">${brandName} — raport dzienny</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">${new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">

    <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">Dzień dobry, oto przegląd opinii wymagających uwagi.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td width="25%" style="padding:4px;">
          <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Negatywne</div>
            <div style="font-size:22px;font-weight:500;color:${Array.isArray(reviews) && reviews.length > 0 ? '#b91c1c' : '#16a34a'};">${Array.isArray(reviews) ? reviews.length : 0}</div>
          </div>
        </td>
        <td width="25%" style="padding:4px;">
          <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Bez odpowiedzi</div>
            <div style="font-size:22px;font-weight:500;color:#d97706;">${Array.isArray(reviews) ? reviews.length : 0}</div>
          </div>
        </td>
        <td width="25%" style="padding:4px;">
          <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">1★ krytyczne</div>
            <div style="font-size:22px;font-weight:500;color:#b91c1c;">${Array.isArray(reviews) ? reviews.filter((r: any) => r.rating === 1).length : 0}</div>
          </div>
        </td>
        <td width="25%" style="padding:4px;">
          <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">2-3★</div>
            <div style="font-size:22px;font-weight:500;color:#d97706;">${Array.isArray(reviews) ? reviews.filter((r: any) => r.rating >= 2 && r.rating <= 3).length : 0}</div>
          </div>
        </td>
      </tr>
    </table>

    ${Array.isArray(reviews) && reviews.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:12px;font-weight:500;color:#6b7280;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;">Wymagają Twojej uwagi</div>
      ${reviews.slice(0, 3).map((r: any) => {
        const color = r.rating === 1 ? '#ef4444' : r.rating === 2 ? '#f97316' : '#f59e0b'
        const bg = r.rating === 1 ? '#fff8f8' : r.rating === 2 ? '#fff7f3' : '#fffbf0'
        const border = r.rating === 1 ? '#fca5a5' : r.rating === 2 ? '#fdba74' : '#fcd34d'
        return `
        <div style="border:1px solid ${border};border-left:4px solid ${color};border-radius:8px;padding:12px 14px;margin-bottom:8px;background:${bg};">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
            <tr>
              <td>
                <span style="background:${color};color:#fff;font-size:11px;padding:2px 7px;border-radius:20px;margin-right:8px;">${r.rating}★</span>
                <span style="font-size:13px;font-weight:500;color:#111827;">${r.author_name}</span>
              </td>
              <td align="right" style="font-size:11px;color:#6b7280;">${r.source}</td>
            </tr>
          </table>
          <p style="font-size:13px;color:#374151;margin:0;line-height:1.5;">"${(r.content || '').slice(0, 150)}${(r.content || '').length > 150 ? '…' : ''}"</p>
        </div>`
      }).join('')}
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="color:#166534;font-size:14px;margin:0;">Brak negatywnych opinii</p>
    </div>`}

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
