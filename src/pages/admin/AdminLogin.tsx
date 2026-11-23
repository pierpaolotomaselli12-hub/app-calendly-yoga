import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import logoFull from '../../assets/logo-full.png'
import './AdminLogin.css'

type Mode = 'login' | 'signup'

export default function AdminLogin() {
  const { adminLogin, adminSignUp } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!email.trim() || !password) {
      setMessage({ kind: 'error', text: 'Inserisci email e password.' })
      return
    }
    setBusy(true)
    if (mode === 'login') {
      const result = await adminLogin(email, password)
      setBusy(false)
      if (result === 'ok') { navigate('/admin/dashboard'); return }
      setPassword('')
      setMessage({
        kind: 'error',
        text: result === 'not_admin'
          ? "Questo account non ha ancora l'accesso all'area riservata."
          : result === 'not_confirmed'
            ? "Prima conferma l'email: apri il link che ti è arrivato quando hai creato la password."
            : 'Email o password non corrette.',
      })
      return
    }
    if (password.length < 8) {
      setBusy(false)
      setMessage({ kind: 'error', text: 'La password deve avere almeno 8 caratteri.' })
      return
    }
    const result = await adminSignUp(email, password)
    setBusy(false)
    setPassword('')
    if (result === 'check_email') {
      setMode('login')
      setMessage({ kind: 'info', text: "Ti è arrivata un'email: apri il link per confermare l'indirizzo, poi accedi da qui." })
    } else if (result === 'ok') {
      setMode('login')
      setMessage({ kind: 'info', text: "Password creata. Quando l'accesso all'area riservata è attivo, entra da qui con email e password." })
    } else if (result === 'email_taken') {
      setMode('login')
      setMessage({ kind: 'info', text: 'Hai già una password per questa email: accedi.' })
    } else {
      setMessage({ kind: 'error', text: 'Non è stato possibile creare la password. Controlla email e password e riprova.' })
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logoFull} alt="Laura Pagnossin" className="login-logo-img" />
        <p className="login-subtitle">{mode === 'login' ? 'Area Riservata' : 'Primo accesso: crea la password'}</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={e => { setEmail(e.target.value); setMessage(null) }}
            placeholder="Email"
            className="login-input"
            autoFocus
          />
          <input
            id="admin-password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setMessage(null) }}
            placeholder={mode === 'login' ? 'Password' : 'Nuova password (almeno 8 caratteri)'}
            className="login-input"
          />
          {message && (
            <p className={message.kind === 'error' ? 'login-error' : 'login-info'}>{message.text}</p>
          )}
          <button type="submit" className="btn-primary login-btn" disabled={busy}>
            {busy ? 'Attendi…' : mode === 'login' ? 'Accedi' : 'Crea password'}
          </button>
          <button
            type="button"
            className="login-switch"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(null) }}
          >
            {mode === 'login' ? 'Primo accesso? Crea la password' : 'Hai già la password? Accedi'}
          </button>
          <a className="login-switch" href="/reimposta-password">Password dimenticata?</a>
        </form>
      </div>
    </div>
  )
}
