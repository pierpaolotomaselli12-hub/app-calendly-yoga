// Tiene attivo il progetto Supabase (piano gratuito: va in pausa dopo giorni senza richieste).
// Gira ogni giorno con un Cron Trigger di Cloudflare e fa una sola lettura pubblica:
// il conteggio dei posti per lezione (nessun dato personale).
async function ping(env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/slot_counts`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  console.log(`keepalive supabase: ${res.status}`)
  if (!res.ok) throw new Error(`Supabase ha risposto ${res.status}`)
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(ping(env))
  },
}
