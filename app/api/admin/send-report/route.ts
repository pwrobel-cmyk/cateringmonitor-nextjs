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
  const trendRow = summary.trend
    ? `<tr><td colspan="4" style="padding-top:16px;">
        <div style="background:#f0f4ff;border-left:4px solid #1e3a5f;padding:12px 16px;border-radius:0 6px 6px 0;">
          <span style="color:#1e3a5f;font-size:14px;">
            Trend w analizowanym okresie: <strong>${summary.trend}</strong>
            ${summary.bestMonth ? ` · Najlepszy miesiąc: <strong>${summary.bestMonth}</strong>` : ''}
          </span>
        </div>
      </td></tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f8;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:#1a3557;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${summary.brandName}</h1>
              <p style="color:#93c5fd;margin:8px 0 0;font-size:13px;">Raport analizy opinii klientów</p>
              <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">${summary.dateFrom} – ${summary.dateTo}</p>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td style="padding:32px 40px 24px;">
              <h2 style="color:#1a3557;font-size:16px;font-weight:600;margin:0 0 20px;text-transform:uppercase;letter-spacing:0.5px;">Podsumowanie okresu</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" width="25%" style="background:#f0f4ff;border-radius:8px;padding:18px 8px;">
                    <div style="font-size:26px;font-weight:700;color:#1a3557;line-height:1;">${summary.stats.avgRating}</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:6px;">★&nbsp;Średnia ocena</div>
                  </td>
                  <td width="12"></td>
                  <td align="center" width="25%" style="background:#f0fdf4;border-radius:8px;padding:18px 8px;">
                    <div style="font-size:26px;font-weight:700;color:#16a34a;line-height:1;">${summary.stats.positivePercent}%</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:6px;">Pozytywnych</div>
                  </td>
                  <td width="12"></td>
                  <td align="center" width="25%" style="background:#fff7ed;border-radius:8px;padding:18px 8px;">
                    <div style="font-size:26px;font-weight:700;color:#ea580c;line-height:1;">${summary.stats.negativePercent}%</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:6px;">Negatywnych</div>
                  </td>
                  <td width="12"></td>
                  <td align="center" width="25%" style="background:#fafafa;border-radius:8px;padding:18px 8px;border:1px solid #e5e7eb;">
                    <div style="font-size:26px;font-weight:700;color:#374151;line-height:1;">${summary.stats.count.toLocaleString('pl-PL')}</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:6px;">Opinii</div>
                  </td>
                </tr>
                ${trendRow}
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
