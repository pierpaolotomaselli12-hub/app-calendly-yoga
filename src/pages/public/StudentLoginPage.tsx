import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LESSONS_PATH, useReturnTo } from '../../lib/navigation'
import { useApp } from '../../context/AppContext'
import logoFull from '../../assets/logo-full.png'
import './StudentLoginPage.css'

export default function StudentLoginPage() {
  const { studentLogin, currentStudent, loading } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = useReturnTo()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Arrivo dal link di conferma email (sessione già attiva): si entra direttamente
  useEffect(() => {
    if (!loading && currentStudent) navigate(returnTo, { replace: true })
  }, [loading, currentStudent, navigate, returnTo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Inserisci email e password.')
      return
    }
    setSubmitting(true)
    const result = await studentLogin(email.trim(), password)
    setSubmitting(false)
    if (result === 'not_confirmed') {
      setError("Il tuo account non è ancora attivo: apri il link che ti ho mandato via email al momento della registrazione.")
      return
    }
    if (result === 'invalid') {
      setPassword('')
      setError('Email o password non corrette. Se non hai ancora creato la password, registrati con la stessa email: ritrovi i tuoi crediti.')
      return
    }
    if (result === 'no_profile') {
      navigate('/registrati', { state: location.state, replace: true })
      return
    }
    navigate(returnTo, { replace: true })
  }

  return (
    <div className="student-login-page">
      <div className="student-login-inner">
        <Link to={LESSONS_PATH} className="student-login-back">← Torna alle lezioni</Link>

        <img src={logoFull} alt="Laura Pagnossin" className="auth-logo" />
        <div className="student-login-card">
          <h1 className="student-login-title">Accedi</h1>
          <p className="student-login-subtitle">Inserisci la tua email per accedere</p>

          <form className="student-login-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="student-login-error-banner">{error}</div>
            )}

            <div className="form-field">
              <label className="form-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="mario.rossi@email.com"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null) }}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn-primary student-login-submit" disabled={submitting}>
              {submitting ? 'Accesso...' : 'Accedi'}
            </button>
            <p className="student-login-register-link"><Link to="/reimposta-password">Password dimenticata?</Link></p>
          </form>

          <p className="student-login-register-link">
            Non hai ancora un account? <Link to="/registrati" state={location.state}>Registrati</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
