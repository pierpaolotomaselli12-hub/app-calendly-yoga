import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { LESSONS_PATH } from '../../lib/navigation'
import logoFull from '../../assets/logo-full.png'
import './StudentLoginPage.css'

/**
 * Due passaggi nella stessa pagina:
 * 1. senza sessione di recupero: chiede l'email e manda il link
 * 2. aperta dal link dell'email (evento PASSWORD_RECOVERY): chiede la nuova password
 */
export default function ResetPasswordPage() {
  const { requestPasswordReset, updatePassword } = useApp()
  const navigate = useNavigate()
  const [recovery, setRecovery] = useState(() => window.location.hash.includes('type=recovery'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setMessage({ kind: 'error', text: 'Inserisci la tua email.' }); return }
    setBusy(true)
    await requestPasswordReset(email)
    setBusy(false)
    // stesso messaggio in ogni caso: non riveliamo quali email sono registrate
    setMessage({ kind: 'info', text: "Se l'email è registrata, ti arriva un link per scegliere una nuova password. Guarda anche nello spam." })
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setMessage({ kind: 'error', text: 'La password deve avere almeno 8 caratteri.' }); return }
    setBusy(true)
    const ok = await updatePassword(password)
    setBusy(false)
    if (!ok) {
      setMessage({ kind: 'error', text: 'Il link è scaduto o non è valido. Richiedine uno nuovo.' })
      setRecovery(false)
      return
    }
    navigate(LESSONS_PATH, { replace: true })
  }

  return (
    <div className="student-login-page">
      <div className="student-login-inner">
        <Link to="/accedi" className="student-login-back">← Torna ad Accedi</Link>
        <img src={logoFull} alt="Laura Pagnossin" className="auth-logo" />
        <div className="student-login-card">
          <h1 className="student-login-title">{recovery ? 'Nuova password' : 'Password dimenticata'}</h1>
          <p className="student-login-subtitle">
            {recovery ? 'Scegli una nuova password (almeno 8 caratteri).' : 'Inserisci la tua email: ti mando un link per sceglierne una nuova.'}
          </p>
          <form className="student-login-form" onSubmit={recovery ? savePassword : sendLink} noValidate>
            {message && (
              <div className={message.kind === 'error' ? 'student-login-error-banner' : 'student-login-info-banner'}>{message.text}</div>
            )}
            {recovery ? (
              <div className="form-field">
                <label className="form-label" htmlFor="reset-password">Nuova password</label>
                <input id="reset-password" type="password" autoComplete="new-password" value={password}
                  onChange={e => { setPassword(e.target.value); setMessage(null) }} />
              </div>
            ) : (
              <div className="form-field">
                <label className="form-label" htmlFor="reset-email">Email</label>
                <input id="reset-email" type="email" autoComplete="username" value={email}
                  onChange={e => { setEmail(e.target.value); setMessage(null) }} placeholder="mario.rossi@email.com" />
              </div>
            )}
            <button type="submit" className="btn-primary student-login-submit" disabled={busy}>
              {busy ? 'Attendi…' : recovery ? 'Salva la password' : 'Mandami il link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
