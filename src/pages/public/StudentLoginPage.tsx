import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import logoFull from '../../assets/logo-full.png'
import './StudentLoginPage.css'

export default function StudentLoginPage() {
  const { studentLogin } = useApp()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await studentLogin(email.trim())
    if (!result) {
      setError('Email non trovata. Sei già registrato/a?')
      setSubmitting(false)
      return
    }
    navigate('/')
  }

  return (
    <div className="student-login-page">
      <div className="student-login-inner">
        <Link to="/" className="student-login-back">← Torna alle lezioni</Link>

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
                required
              />
            </div>

            <button type="submit" className="btn-primary student-login-submit" disabled={submitting}>
              {submitting ? 'Accesso...' : 'Accedi'}
            </button>
          </form>

          <p className="student-login-register-link">
            Non hai ancora un account? <Link to="/registrati">Registrati</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
