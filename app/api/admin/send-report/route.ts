import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

interface Recipient {
  userId?: string
  email: string
}

interface ReportSummary {
  brandId: string | null
  brandName: string
  brandLogoUrl?: string | null
  dateFrom: string
  dateTo: string
  title: string
  stats: {
    count: number
    avgRating: string
    positivePercent: string
    negativePercent: string
  }
  trend?: string
  bestMonth?: string
}

function buildEmailHtml(summary: ReportSummary, reportLink: string): string {
  const trendHtml = summary.trend
    ? `<tr>
        <td colspan="2" style="padding-top:16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#f0f4ff;border-left:4px solid #1a3557;padding:12px 16px;">
                <span style="color:#1a3557;font-size:13px;">Trend: <strong>${summary.trend}</strong>${summary.bestMonth ? ' &middot; Najlepszy miesiąc: <strong>' + summary.bestMonth.replace(/★/g, '') + '</strong>' : ''}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f8;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f6f8" style="padding:30px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td bgcolor="#1a3557" style="padding:28px 36px;text-align:center;">
              <div style="color:#ffffff;font-size:20px;font-weight:bold;margin:0;">${summary.brandName}</div>
              <div style="color:#93c5fd;font-size:12px;margin:6px 0 0;">Raport analizy opinii klientow</div>
              <div style="color:#bfdbfe;font-size:12px;margin:3px 0 0;">${summary.dateFrom} &ndash; ${summary.dateTo}</div>
            </td>
          </tr>

          <!-- Stats heading -->
          <tr>
            <td style="padding:28px 36px 12px;">
              <div style="color:#1a3557;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e2e8f0;padding-bottom:10px;">Podsumowanie okresu</div>
            </td>
          </tr>

          <!-- Stats 2x2 -->
          <tr>
            <td style="padding:0 36px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" align="center" bgcolor="#eef2ff" style="padding:16px;border-radius:6px;">
                    <div style="font-size:28px;font-weight:bold;color:#1a3557;">${summary.stats.avgRating}</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:4px;">Srednia ocena (max 5)</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" align="center" bgcolor="#f0fdf4" style="padding:16px;border-radius:6px;">
                    <div style="font-size:28px;font-weight:bold;color:#16a34a;">${summary.stats.positivePercent}%</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:4px;">Pozytywnych opinii (4-5)</div>
                  </td>
                </tr>
                <tr><td colspan="3" style="padding:6px 0;"></td></tr>
                <tr>
                  <td width="48%" align="center" bgcolor="#fff7ed" style="padding:16px;border-radius:6px;">
                    <div style="font-size:28px;font-weight:bold;color:#ea580c;">${summary.stats.negativePercent}%</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:4px;">Negatywnych opinii (1-2)</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" align="center" bgcolor="#f8fafc" style="padding:16px;border-radius:6px;border:1px solid #e2e8f0;">
                    <div style="font-size:28px;font-weight:bold;color:#374151;">${summary.stats.count.toLocaleString('pl-PL')}</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:4px;">Liczba opinii w okresie</div>
                  </td>
                </tr>
                ${trendHtml}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 40px 40px;text-align:center;">
              <a href="${reportLink}"
                 style="display:inline-block;background:#1a3557;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:8px;letter-spacing:0.2px;">
                Zobacz pełny raport →
              </a>
              <p style="color:#9ca3af;font-size:12px;margin:14px 0 0;">
                Raport dostępny w Catering Monitor w sekcji <strong>Moje raporty</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 40px;text-align:center;">
              <p style="color:#9ca3af;font-size:11px;margin:0;">Catering Monitor · cateringmonitor.pl</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { recipients, reportSummary, subject } = await request.json() as {
    recipients: Recipient[]
    reportSummary: ReportSummary
    subject?: string
  }

  if (!recipients?.length) {
    return Response.json({ error: 'No recipients provided' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const errors: string[] = []
  let sent = 0

  for (const recipient of recipients) {
    try {
      // Create custom_reports record for this recipient
      const { data: reportRecord, error: insertError } = await (supabase as any)
        .from('custom_reports')
        .insert({
          user_id: recipient.userId || null,
          brand_id: reportSummary.brandId,
          brand_name: reportSummary.brandName,
          date_from: reportSummary.dateFrom,
          date_to: reportSummary.dateTo,
          title: reportSummary.title,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (insertError) {
        errors.push(`${recipient.email}: insert error: ${insertError.message}`)
        continue
      }

      const reportLink = `https://cateringmonitor.pl/reports/custom/${reportRecord.id}`
      const html = buildEmailHtml(reportSummary, reportLink)

      const { error: sendError } = await resend.emails.send({
        from: 'raporty@cateringmonitor.pl',
        to: recipient.email,
        subject: subject || `Raport: ${reportSummary.brandName} · ${reportSummary.dateFrom} – ${reportSummary.dateTo}`,
        html,
      })

      if (sendError) {
        errors.push(`${recipient.email}: ${(sendError as any).message || 'Unknown error'}`)
      } else {
        sent++
      }
    } catch (e: any) {
      errors.push(`${recipient.email}: ${e.message || 'Unknown error'}`)
    }
  }

  return Response.json({ sent, errors })
}
