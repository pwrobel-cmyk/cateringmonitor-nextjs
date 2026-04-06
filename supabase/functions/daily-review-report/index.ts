import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Pobierz wszystkie marki z przypisanymi userami
  const { data: assignments } = await supabase
    .from('user_brand_assignments')
    .select('user_id, brand_id, brands(name, logo_url), profiles(email, full_name)')

  for (const assignment of (assignments || [])) {
    const brandId = assignment.brand_id
    const brandName = (assignment.brands as any)?.name
    const userEmail = (assignment.profiles as any)?.email
    const userName = (assignment.profiles as any)?.full_name?.split(' ')[0] || 'Pawle'

    if (!userEmail || !brandId) continue

    // Nowe opinie z ostatnich 24h
    const { data: newReviews } = await supabase
      .from('reviews')
      .select('id, author_name, rating, content, source, review_date')
      .eq('brand_id', brandId)
      .eq('is_approved', true)
      .gte('review_date', yesterday.toISOString())
      .lt('review_date', today.toISOString())
      .order('rating', { ascending: true })

    const reviews = newReviews || []
    const negativeReviews = reviews.filter(r => r.rating <= 3)
    const avgRating = reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 'brak'

    // Bez odpowiedzi łącznie
    const { count: unanswered } = await supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('is_approved', true)
      .lte('rating', 3)
      .not('status', 'in', '("done","skipped")')

    // Generuj HTML emaila
    const negativeSections = negativeReviews.slice(0, 3).map(r => {
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
    <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:2px;">CATERINGMONITOR</div>
    <div style="font-size:16px;font-weight:500;color:#fff;">${brandName} — raport dzienny</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">${new Date().toLocaleDateString('pl-PL', {weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
  </div>
  <div style="background:#fff;border:0.5px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
    <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">Dzień dobry ${userName}, oto przegląd opinii z ostatnich 24 godzin.</p>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;">
      <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Nowe opinie</div>
        <div style="font-size:22px;font-weight:500;">${reviews.length}</div>
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Śr. ocena</div>
        <div style="font-size:22px;font-weight:500;">${avgRating}</div>
      </div>
      <div style="background:${negativeReviews.length > 0 ? '#fff0f0' : '#f0fdf4'};border-radius:8px;padding:12px;text-align:center;border:0.5px solid ${negativeReviews.length > 0 ? '#fca5a5' : '#86efac'};">
        <div style="font-size:11px;color:${negativeReviews.length > 0 ? '#991b1b' : '#166534'};margin-bottom:4px;">Negatywne</div>
        <div style="font-size:22px;font-weight:500;color:${negativeReviews.length > 0 ? '#b91c1c' : '#16a34a'};">${negativeReviews.length}</div>
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Bez odpowiedzi</div>
        <div style="font-size:22px;font-weight:500;color:#d97706;">${unanswered || 0}</div>
      </div>
    </div>

    ${negativeReviews.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:12px;font-weight:500;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Wymagają Twojej uwagi</div>
      ${negativeSections}
    </div>` : `
    <div style="background:#f0fdf4;border:0.5px solid #86efac;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="color:#166534;font-size:14px;margin:0;">Brak negatywnych opinii z ostatnich 24h</p>
    </div>`}

    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://cateringmonitor.pl/review-manager" style="display:inline-block;background:#1a3a5c;color:#fff;font-size:14px;font-weight:500;padding:12px 28px;border-radius:8px;text-decoration:none;">Otwórz Review Manager</a>
    </div>

    <div style="border-top:0.5px solid #e5e7eb;padding-top:14px;text-align:center;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">CateringMonitor · wysyłany codziennie o 7:00</p>
    </div>
  </div>
</div>
</body>
</html>`

    // Wyślij przez Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'CateringMonitor <raporty@cateringmonitor.pl>',
        to: [userEmail],
        subject: `[${brandName}] Raport opinii — ${new Date().toLocaleDateString('pl-PL')} | ${negativeReviews.length > 0 ? `${negativeReviews.length} negatywnych` : 'brak negatywnych'}`,
        html
      })
    })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
