import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const TEACHER_EMAIL = 'laura.pagnossin152@gmail.com'
const FROM = 'Yoga Studio <onboarding@resend.dev>'

interface EmailPayload {
  type: 'booking' | 'waitlist'
  studentEmail: string
  studentName: string
  slotTitle: string
  slotDate: string
  slotTime: string
  slotDuration: number
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html, reply_to: TEACHER_EMAIL }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const payload: EmailPayload = await req.json()
    const { type, studentEmail, studentName, slotTitle, slotDate, slotTime, slotDuration } = payload

    if (type === 'booking') {
      await sendEmail(
        studentEmail,
        `Prenotazione confermata – ${slotTitle}`,
        `
          <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2c2c2c;">
            <h2 style="color:#818569;">Prenotazione confermata</h2>
            <p>Ciao ${studentName},</p>
            <p>La tua prenotazione è confermata. Ti aspettiamo!</p>
            <div style="background:#f5f2ee;padding:20px;margin:24px 0;">
              <strong>${slotTitle}</strong><br/>
              ${slotDate} alle ${slotTime} · ${slotDuration} min
            </div>
            <p style="color:#6b6b6b;font-size:14px;">Ricordati di portare il tuo tappetino.</p>
            <p style="color:#6b6b6b;font-size:14px;">Per info rispondi a questa email.</p>
          </div>
        `
      )
      await sendEmail(
        TEACHER_EMAIL,
        `Nuova prenotazione – ${slotTitle}`,
        `
          <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2c2c2c;">
            <h2 style="color:#818569;">Nuova prenotazione</h2>
            <p><strong>${studentName}</strong> si è prenotato/a per:</p>
            <div style="background:#f5f2ee;padding:20px;margin:24px 0;">
              <strong>${slotTitle}</strong><br/>
              ${slotDate} alle ${slotTime} · ${slotDuration} min
            </div>
            <p style="color:#6b6b6b;font-size:14px;">Contatto studente: ${studentEmail}</p>
          </div>
        `
      )
    } else {
      await sendEmail(
        studentEmail,
        `Lista d'attesa – ${slotTitle}`,
        `
          <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#2c2c2c;">
            <h2 style="color:#818569;">Sei in lista d'attesa</h2>
            <p>Ciao ${studentName},</p>
            <p>Sei stato/a aggiunto/a alla lista d'attesa per la seguente lezione:</p>
            <div style="background:#f5f2ee;padding:20px;margin:24px 0;">
              <strong>${slotTitle}</strong><br/>
              ${slotDate} alle ${slotTime} · ${slotDuration} min
            </div>
            <p style="color:#6b6b6b;font-size:14px;">Ti contatteremo se si libera un posto.</p>
            <p style="color:#6b6b6b;font-size:14px;">Per info rispondi a questa email.</p>
          </div>
        `
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
