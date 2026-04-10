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
  ranking?: {
    name: string
    count: number
    avgRating: number
    positivePercent: number
    negativePercent: number
    isSelected: boolean
  }[]
}

function buildEmailHtml(summary: ReportSummary, reportLink: string): string {
  const bestMonthText = summary.bestMonth
    ? summary.bestMonth.replace(/[★☆]/g, '').trim()
    : ''
  const trendText = summary.trend
    ? `Trend: ${summary.trend}${bestMonthText ? ` | Najlepszy miesiac: ${bestMonthText}` : ''}`
    : ''

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;">
<table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f0f2f5">
<tr><td align="center" style="padding:24px 0;">

  <table border="0" cellpadding="0" cellspacing="0" width="560" bgcolor="#ffffff" style="border:1px solid #d1d5db;">

    <!-- HEADER -->
    <tr>
      <td bgcolor="#1a3557" align="center" style="padding:28px 32px;background-color:#1a3557;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">${summary.brandName}</p>
        <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#bfdbfe;">Raport analizy opinii klientow</p>
        <p style="margin:3px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#93c5fd;">${summary.dateFrom} - ${summary.dateTo}</p>
      </td>
    </tr>

    <!-- SECTION HEADING -->
    <tr>
      <td style="padding:24px 32px 12px;">
        <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#1a3557;text-transform:uppercase;letter-spacing:1px;">PODSUMOWANIE OKRESU</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr><td bgcolor="#d1d5db" height="1" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>

    <!-- STATS ROW 1 -->
    <tr>
      <td style="padding:8px 32px 4px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="49%" bgcolor="#eef2ff" align="center" style="padding:16px 8px;background-color:#eef2ff;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:26px;font-weight:bold;color:#1a3557;">${summary.stats.avgRating}</p>
              <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#6b7280;">Srednia ocena (max 5)</p>
            </td>
            <td width="2%">&nbsp;</td>
            <td width="49%" bgcolor="#f0fdf4" align="center" style="padding:16px 8px;background-color:#f0fdf4;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:26px;font-weight:bold;color:#16a34a;">${summary.stats.positivePercent}%</p>
              <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#6b7280;">Pozytywnych opinii (4-5)</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- STATS ROW 2 -->
    <tr>
      <td style="padding:4px 32px 8px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="49%" bgcolor="#fff7ed" align="center" style="padding:16px 8px;background-color:#fff7ed;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:26px;font-weight:bold;color:#ea580c;">${summary.stats.negativePercent}%</p>
              <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#6b7280;">Negatywnych opinii (1-2)</p>
            </td>
            <td width="2%">&nbsp;</td>
            <td width="49%" bgcolor="#f8fafc" align="center" style="padding:16px 8px;background-color:#f8fafc;border:1px solid #e5e7eb;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:26px;font-weight:bold;color:#374151;">${summary.stats.count.toLocaleString('pl-PL')}</p>
              <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#6b7280;">Liczba opinii</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${trendText ? `
    <!-- TREND -->
    <tr>
      <td style="padding:4px 32px 12px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td bgcolor="#eff6ff" style="padding:10px 14px;border-left:3px solid #1a3557;background-color:#eff6ff;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#1a3557;">${trendText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''}

    ${summary.ranking && summary.ranking.length > 0 ? `
    <!-- RANKING HEADING -->
    <tr>
      <td style="padding:16px 32px 8px;">
        <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#1a3557;text-transform:uppercase;letter-spacing:1px;">RANKING MAREK W TYM OKRESIE</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr><td bgcolor="#d1d5db" height="1" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
    <!-- RANKING TABLE -->
    <tr>
      <td style="padding:0 32px 16px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr bgcolor="#f8fafc" style="background-color:#f8fafc;">
            <td width="28" style="padding:6px 4px;font-family:Arial,sans-serif;font-size:10px;color:#6b7280;font-weight:bold;">#</td>
            <td style="padding:6px 4px;font-family:Arial,sans-serif;font-size:10px;color:#6b7280;font-weight:bold;">MARKA</td>
            <td width="50" align="right" style="padding:6px 4px;font-family:Arial,sans-serif;font-size:10px;color:#6b7280;font-weight:bold;">OCENA</td>
            <td width="46" align="right" style="padding:6px 4px;font-family:Arial,sans-serif;font-size:10px;color:#6b7280;font-weight:bold;">POZ.</td>
            <td width="46" align="right" style="padding:6px 4px;font-family:Arial,sans-serif;font-size:10px;color:#6b7280;font-weight:bold;">NEG.</td>
            <td width="52" align="right" style="padding:6px 4px;font-family:Arial,sans-serif;font-size:10px;color:#6b7280;font-weight:bold;">OPINII</td>
          </tr>
          ${summary.ranking.map((b, i) => `
          <tr bgcolor="${b.isSelected ? '#eff6ff' : i % 2 === 0 ? '#ffffff' : '#f9fafb'}" style="background-color:${b.isSelected ? '#eff6ff' : i % 2 === 0 ? '#ffffff' : '#f9fafb'};${b.isSelected ? 'border-left:3px solid #1a3557;' : ''}">
            <td style="padding:7px 4px;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;">${i + 1}</td>
            <td style="padding:7px 4px;font-family:Arial,sans-serif;font-size:12px;color:#111827;font-weight:${b.isSelected ? 'bold' : 'normal'};">${b.name}${b.isSelected ? ' *' : ''}</td>
            <td align="right" style="padding:7px 4px;font-family:Arial,sans-serif;font-size:12px;color:#1a3557;font-weight:bold;">${b.avgRating.toFixed(2)}</td>
            <td align="right" style="padding:7px 4px;font-family:Arial,sans-serif;font-size:12px;color:#16a34a;">${b.positivePercent}%</td>
            <td align="right" style="padding:7px 4px;font-family:Arial,sans-serif;font-size:12px;color:#ea580c;">${b.negativePercent}%</td>
            <td align="right" style="padding:7px 4px;font-family:Arial,sans-serif;font-size:12px;color:#374151;">${b.count.toLocaleString('pl-PL')}</td>
          </tr>`).join('')}
        </table>
        ${summary.ranking.some(b => b.isSelected) ? `<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:10px;color:#6b7280;">* Twoja marka</p>` : ''}
      </td>
    </tr>` : ''}

    <!-- CTA -->
    <tr>
      <td align="center" style="padding:20px 32px 32px;">
        <table border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td bgcolor="#1a3557" align="center" style="background-color:#1a3557;padding:14px 32px;">
              <a href="${reportLink}" style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;">Zobacz pelny raport</a>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;">Raport dostepny w Catering Monitor w sekcji Moje raporty</p>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td bgcolor="#f9fafb" align="center" style="padding:14px 32px;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#9ca3af;">Catering Monitor &middot; cateringmonitor.pl</p>
      </td>
    </tr>

  </table>

</td></tr>
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
          recipient_email: recipient.email,
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
