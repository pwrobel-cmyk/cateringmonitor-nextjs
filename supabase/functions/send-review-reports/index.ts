import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!

async function db(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  })
  return res.json()
}

serve(async () => {
  const now = new Date()
  const currentHour = now.getUTCHours() + 1 // UTC+1 Polska
  const currentDay = now.getDay() // 0=niedziela, 1=poniedziałek...

  const settings = await db('review_notification_settings?select=*')

  for (const s of (settings || [])) {
    const shouldSendDaily = s.daily_enabled && s.daily_hour === currentHour
    const shouldSendWeekly = s.weekly_enabled && s.weekly_day === currentDay && s.weekly_hour === currentHour

    if (!shouldSendDaily && !shouldSendWeekly) continue

    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const fourteenDaysAgo = new Date(now)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const [reviews, brands, prev7d, curr7d] = await Promise.all([
      db(`reviews?select=id,author_name,rating,content,source,review_date,status&brand_id=eq.${s.brand_id}&review_date=gte.${sevenDaysAgo.toISOString()}&rating=lte.3&order=review_date.desc&limit=10`),
      db(`brands?select=name&id=eq.${s.brand_id}&limit=1`),
      db(`reviews?select=rating&brand_id=eq.${s.brand_id}&review_date=gte.${fourteenDaysAgo.toISOString()}&review_date=lt.${sevenDaysAgo.toISOString()}`),
      db(`reviews?select=rating&brand_id=eq.${s.brand_id}&review_date=gte.${sevenDaysAgo.toISOString()}`),
    ])

    const brandName = brands?.[0]?.name || 'Twoja marka'

    const calcMetrics = (arr: any[]) => ({
      total: arr.length,
      positivePct: arr.length > 0 ? Math.round(arr.filter((r: any) => r.rating >= 4).length / arr.length * 100) : 0,
      negativePct: arr.length > 0 ? Math.round(arr.filter((r: any) => r.rating <= 3).length / arr.length * 100) : 0,
      avgRating: arr.length > 0 ? (arr.reduce((sum: number, r: any) => sum + r.rating, 0) / arr.length).toFixed(1) : '0',
    })
    const curr = calcMetrics(curr7d || [])
    const prev = calcMetrics(prev7d || [])

    const negativeReviews = (reviews || []).filter((r: any) => r.rating <= 3)

    const reviewCards = negativeReviews.slice(0, 5).map((r: any) => {
      const color = r.rating === 1 ? '#ef4444' : r.rating === 2 ? '#f97316' : '#f59e0b'
      const bg = r.rating === 1 ? '#fff8f8' : r.rating === 2 ? '#fff7f3' : '#fffbf0'
      const border = r.rating === 1 ? '#fca5a5' : r.rating === 2 ? '#fdba74' : '#fcd34d'
      return `<div style="border:1px solid ${border};border-left:4px solid ${color};border-radius:8px;padding:12px 14px;margin-bottom:8px;background:${bg};">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><span style="background:${color};color:#fff;font-size:11px;padding:2px 7px;border-radius:20px;">${r.rating}★</span> <span style="font-size:13px;font-weight:500;">${r.author_name}</span></td>
          <td align="right" style="font-size:11px;color:#6b7280;">${r.source}</td>
        </tr></table>
        <p style="font-size:13px;color:#374151;margin:8px 0 0;line-height:1.5;">"${(r.content || '').slice(0, 150)}${(r.content || '').length > 150 ? '…' : ''}"</p>
      </div>`
    }).join('')

    const diffPct = curr.positivePct - prev.positivePct
    const summaryText = diffPct > 0
      ? `Sentyment poprawił się o ${diffPct}pp vs poprzedni tydzień.`
      : diffPct < 0
      ? `Uwaga: sentyment pogorszył się o ${Math.abs(diffPct)}pp vs poprzedni tydzień.`
      : 'Stabilna sytuacja — sentyment bez zmian.'

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f3f4f6;font-family:sans-serif;">
<div style="max-width:600px;margin:0 auto;">
  <div style="background:#1a3a5c;padding:20px 24px;border-radius:8px 8px 0 0;">
    <div style="font-size:11px;color:rgba(255,255,255,0.6);">CATERINGMONITOR</div>
    <div style="font-size:16px;font-weight:500;color:#fff;">${brandName} — raport ${shouldSendDaily ? 'dzienny' : 'tygodniowy'}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7);">${now.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
    <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">Oto przegląd opinii z ostatnich 7 dni.</p>

    <table width="100%" cellpadding="4" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td width="25%"><div style="background:${negativeReviews.length > 0 ? '#fff0f0' : '#f0fdf4'};border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:${negativeReviews.length > 0 ? '#991b1b' : '#166534'};">Negatywne</div>
          <div style="font-size:22px;font-weight:500;color:${negativeReviews.length > 0 ? '#b91c1c' : '#16a34a'};">${negativeReviews.length}</div>
        </div></td>
        <td width="25%"><div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#6b7280;">Śr. ocena</div>
          <div style="font-size:22px;font-weight:500;">${curr.avgRating}</div>
        </div></td>
        <td width="25%"><div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#6b7280;">Pozytywne</div>
          <div style="font-size:22px;font-weight:500;color:#16a34a;">${curr.positivePct}%</div>
        </div></td>
        <td width="25%"><div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#6b7280;">Tydzień temu</div>
          <div style="font-size:22px;font-weight:500;">${prev.positivePct}%</div>
        </div></td>
      </tr>
    </table>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:500;color:#1e40af;text-transform:uppercase;margin-bottom:4px;">Podsumowanie tygodnia</div>
      <p style="font-size:13px;color:#1e3a8a;margin:0;">${summaryText}</p>
    </div>

    ${negativeReviews.length > 0 ? `
    <div style="font-size:12px;font-weight:500;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">Wymagają uwagi</div>
    ${reviewCards}` : `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center;">
      <p style="color:#166534;font-size:14px;margin:0;">Brak negatywnych opinii w ostatnich 7 dniach</p>
    </div>`}

    <div style="text-align:center;margin:24px 0 20px;">
      <a href="https://cateringmonitor.pl/review-manager" style="display:inline-block;background:#1a3a5c;color:#fff;font-size:14px;font-weight:500;padding:12px 28px;border-radius:8px;text-decoration:none;">Otwórz Review Manager</a>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:14px;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">CateringMonitor · automatyczny raport</p>
    </div>
  </div>
</div></body></html>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CateringMonitor <raporty@cateringmonitor.pl>',
        to: [s.email],
        subject: `[${brandName}] Raport ${shouldSendDaily ? 'dzienny' : 'tygodniowy'} — ${now.toLocaleDateString('pl-PL')}`,
        html,
      })
    })
  }

  return new Response(JSON.stringify({ ok: true, processed: settings?.length || 0 }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
