import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

function buildCustomEmailHtml(subject: string, paragraphs: string[]): string {
  const rows = paragraphs
    .map(p => `
    <tr>
      <td style="padding:0 32px 16px;font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#374151;">
        ${p}
      </td>
    </tr>`)
    .join('')

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
        <p style="margin:0;font-family:Arial,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">Catering Monitor</p>
        <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#93c5fd;">${subject}</p>
      </td>
    </tr>

    <!-- GREETING -->
    <tr>
      <td style="padding:28px 32px 8px;font-family:Arial,sans-serif;font-size:14px;color:#374151;">
        Cześć,
      </td>
    </tr>

    <!-- CONTENT -->
    ${rows}

    <!-- SIGN OFF -->
    <tr>
      <td style="padding:8px 32px 28px;font-family:Arial,sans-serif;font-size:14px;color:#374151;">
        Pozdrawiamy,<br/>
        <strong>Zespół Catering Monitor</strong>
      </td>
    </tr>

    <!-- CTA -->
    <tr>
      <td align="center" style="padding:8px 32px 32px;">
        <table border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td bgcolor="#1a3557" align="center" style="background-color:#1a3557;padding:12px 28px;">
              <a href="https://cateringmonitor.pl/dashboard" style="font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;">Przejdź do platformy</a>
            </td>
          </tr>
        </table>
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

  const { recipients, subject, paragraphs } = await request.json() as {
    recipients: string[]
    subject: string
    paragraphs: string[]
  }

  if (!recipients?.length || !subject || !paragraphs?.length) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const html = buildCustomEmailHtml(subject, paragraphs)

  const errors: string[] = []
  let sent = 0

  for (const email of recipients) {
    const { error } = await resend.emails.send({
      from: 'raporty@cateringmonitor.pl',
      to: email,
      subject,
      html,
    })
    if (error) {
      errors.push(`${email}: ${(error as any).message || 'Unknown error'}`)
    } else {
      sent++
    }
  }

  return Response.json({ sent, errors })
}
