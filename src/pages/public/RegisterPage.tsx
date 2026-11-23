import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LESSONS_PATH, useReturnTo } from '../../lib/navigation'
import { useApp } from '../../context/AppContext'
import logoFull from '../../assets/logo-full.png'
import './RegisterPage.css'

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  password?: string
  general?: string
}

export default function RegisterPage() {
  const { studentRegister, sessionEmail } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = useReturnTo()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(sessionEmail ?? '')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!firstName.trim()) errs.firstName = 'Il nome è obbligatorio.'
    if (!lastName.trim()) errs.lastName = 'Il cognome è obbligatorio.'
    if (!email.trim()) {
      errs.email = "L'email è obbligatoria."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Inserisci un'email valida."
    }
    if (!phone.trim()) {
      errs.phone = 'Il telefono è obbligatorio.'
    } else if (!/^[\d\s+\-().]+$/.test(phone.trim())) {
      errs.phone = 'Inserisci un numero di telefono valido.'
    }
    if (password.length < 8) errs.password = 'La password deve avere almeno 8 caratteri.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSubmitting(true)
    const result = await studentRegister({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
    })
    setSubmitting(false)
    if (result === 'ok') {
      navigate(returnTo, { replace: true })
      return
    }
    if (result === 'check_email') {
      setSentTo(email.trim())
      return
    }
    setPassword('')
    const messages: Record<string, string> = {
      email_taken: 'Questa email ha già un account. Prova ad accedere con la tua password.',
      weak_password: 'Scegli una password più sicura (almeno 8 caratteri).',
      invalid_email: "Controlla l'indirizzo email.",
      error: 'Registrazione non riuscita. Riprova tra poco.',
    }
    setErrors({ general: messages[result] })
  }

  return (
    <div className="register-page">
      <div className="register-inner">
        <Link to={LESSONS_PATH} className="register-back">← Torna alle lezioni</Link>

        <img src={logoFull} alt="Laura Pagnossin" className="auth-logo" />
        {sentTo ? (
        <div className="register-card">
          <h1 className="register-title">Controlla la tua email</h1>
          <p className="register-subtitle">
            Ti ho mandato un'email a <strong>{sentTo}</strong>. Apri il link che trovi dentro per attivare l'account,
            poi accedi con email e password.
          </p>
          <p className="register-subtitle">Non la trovi? Guarda anche nello spam o nelle promozioni.</p>
          <p className="register-login-link"><Link to="/accedi" state={location.state}>Vai ad Accedi</Link></p>
        </div>
        ) : (
        <div className="register-card">
          <h1 className="register-title">Crea il tuo account</h1>
          <p className="register-subtitle">Registrati per prenotare le lezioni</p>

          <form className="register-form" onSubmit={handleSubmit} noValidate>
            {errors.general && (
              <div className="register-error-banner">{errors.general}</div>
            )}

            <div className="register-form__grid">
              <div className="form-field">
                <label className="form-label" htmlFor="reg-firstName">Nome</label>
                <input
                  id="reg-firstName"
                  type="text"
                  value={firstName}
                  onChange={e => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: undefined })) }}
                  placeholder="Mario"
                />
                {errors.firstName && <span className="form-error">{errors.firstName}</span>}
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="reg-lastName">Cognome</label>
                <input
                  id="reg-lastName"
                  type="text"
                  value={lastName}
                  onChange={e => { setLastName(e.target.value); setErrors(prev => ({ ...prev, lastName: undefined })) }}
                  placeholder="Rossi"
                />
                {errors.lastName && <span className="form-error">{errors.lastName}</span>}
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })) }}
                placeholder="mario.rossi@email.com"
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="reg-phone">Telefono</label>
              <input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: undefined })) }}
                placeholder="+39 333 123 4567"
              />
              {errors.phone && <span className="form-error">{errors.phone}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })) }}
                autoComplete="new-password"
                placeholder="Almeno 8 caratteri"
              />
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn-primary register-submit" disabled={submitting}>
              {submitting ? 'Registrazione...' : 'Registrati'}
            </button>
          </form>

          <p className="register-login-link">
            Hai già un account? <Link to="/accedi" state={location.state}>Accedi</Link>
          </p>
        </div>
        )}
      </div>
    </div>
  )
}
