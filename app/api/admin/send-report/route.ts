import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { emails, reportHtml, subject } = await request.json()

  if (!emails?.length) {
    return Response.json({ error: 'No emails provided' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const errors: string[] = []
  let sent = 0

  for (const email of emails as string[]) {
    const { error } = await resend.emails.send({
      from: 'raporty@cateringmonitor.pl',
      to: email,
      subject: subject || 'Raport Catering Monitor',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#111}table{border-collapse:collapse;width:100%}td,th{padding:6px 8px;border-bottom:1px solid #e5e7eb}h1,h2,h3{margin:0 0 8px}</style></head><body>${reportHtml}</body></html>`,
    })

    if (error) {
      errors.push(`${email}: ${(error as any).message || 'Unknown error'}`)
    } else {
      sent++
    }
  }

  return Response.json({ sent, errors })
}
