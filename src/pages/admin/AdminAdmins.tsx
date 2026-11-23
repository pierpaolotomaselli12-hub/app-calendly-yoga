import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import './AdminAdmins.css'

interface AdminRow {
  user_id: string
  email: string
  created_at: string
}

const ERRORS: Record<string, string> = {
  no_account: "Non c'è nessun account con questa email. La persona deve prima creare la password da laurapagnossin.it/admin/login.",
  not_confirmed: "L'account esiste ma l'email non è ancora confermata: la persona deve aprire il link che ha ricevuto.",
  already_admin: 'Questa persona è già amministratore.',
  self: 'Non puoi togliere te stesso.',
  last_admin: "Deve restare almeno un amministratore.",
  forbidden: 'Non hai i permessi per questa operazione.',
}

function errorText(message: string): string {
  const code = Object.keys(ERRORS).find(k => message.includes(k))
  return code ? ERRORS[code] : 'Operazione non riuscita. Riprova tra poco.'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AdminAdmins() {
  const { sessionEmail } = useApp()
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_admins')
    if (error) setMessage({ kind: 'error', text: errorText(error.message) })
    else setAdmins((data ?? []) as AdminRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    void supabase.rpc('list_admins').then(({ data, error }) => {
      if (!active) return
      if (error) setMessage({ kind: 'error', text: errorText(error.message) })
      else setAdmins((data ?? []) as AdminRow[])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setMessage({ kind: 'error', text: "Inserisci l'email della persona da abilitare." }); return }
    setBusy(true)
    setMessage(null)
    const { data, error } = await supabase.rpc('add_admin', { p_email: email.trim() })
    setBusy(false)
    if (error) { setMessage({ kind: 'error', text: errorText(error.message) }); return }
    setEmail('')
    setMessage({ kind: 'info', text: `${data as string} ora è amministratore.` })
    await load()
  }

  async function handleRemove(row: AdminRow) {
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.rpc('remove_admin', { p_user_id: row.user_id })
    setBusy(false)
    setConfirmRemove(null)
    if (error) { setMessage({ kind: 'error', text: errorText(error.message) }); return }
    setMessage({ kind: 'info', text: `${row.email} non è più amministratore.` })
    await load()
  }

  const me = sessionEmail?.toLowerCase()

  return (
    <div className="adm-page">
      <div className="adm-header">
        <h1 className="adm-title">Amministratori</h1>
        <p className="adm-subtitle">Chi può entrare nell'area riservata e gestire lezioni, prenotazioni e studenti.</p>
      </div>

      {message && (
        <div className={message.kind === 'error' ? 'adm-banner adm-banner--error' : 'adm-banner'} role="status">{message.text}</div>
      )}

      <section className="adm-card">
        <h2 className="adm-card-title">Abilita un amministratore</h2>
        <ol className="adm-steps">
          <li>La persona apre <strong>laurapagnossin.it/admin/login</strong> e sceglie "Primo accesso? Crea la password".</li>
          <li>Conferma l'email con il link che riceve.</li>
          <li>Tu inserisci qui la sua email e premi Abilita.</li>
        </ol>
        <form className="adm-form" onSubmit={handleAdd}>
          <label className="adm-label" htmlFor="adm-email">Email</label>
          <div className="adm-form-row">
            <input
              id="adm-email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setMessage(null) }}
              placeholder="nome@email.com"
              autoComplete="off"
            />
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Attendi…' : 'Abilita'}</button>
          </div>
        </form>
      </section>

      <section className="adm-card">
        <h2 className="adm-card-title">Amministratori attivi</h2>
        {loading ? (
          <p className="adm-muted">Caricamento…</p>
        ) : (
          <ul className="adm-list">
            {admins.map(row => {
              const isMe = row.email.toLowerCase() === me
              return (
                <li key={row.user_id} className="adm-row">
                  <div className="adm-avatar" aria-hidden="true">{row.email.charAt(0).toUpperCase()}</div>
                  <div className="adm-info">
                    <span className="adm-email">{row.email}{isMe && <span className="adm-you">tu</span>}</span>
                    <span className="adm-muted">Dal {formatDate(row.created_at)}</span>
                  </div>
                  {!isMe && (confirmRemove === row.user_id ? (
                    <div className="adm-confirm">
                      <span>Togliere l'accesso?</span>
                      <button type="button" className="adm-btn-danger" disabled={busy} onClick={() => void handleRemove(row)}>Sì, togli</button>
                      <button type="button" className="adm-btn-ghost" onClick={() => setConfirmRemove(null)}>Annulla</button>
                    </div>
                  ) : (
                    <button type="button" className="adm-btn-ghost" onClick={() => setConfirmRemove(row.user_id)}>Togli accesso</button>
                  ))}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
