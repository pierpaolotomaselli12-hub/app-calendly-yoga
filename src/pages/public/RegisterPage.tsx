import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import './RegisterPage.css'

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  general?: string
}

export default function RegisterPage() {
  const { studentRegister, studentLogin } = useApp()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

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
    })
    if (result === 'email_taken') {
      setErrors({ general: 'Questa email è già registrata. Prova ad accedere.' })
      setSubmitting(false)
      return
    }
    await studentLogin(email.trim())
    navigate('/')
  }

  return (
    <div className="register-page">
      <div className="register-inner">
        <Link to="/" className="register-back">← Torna alle lezioni</Link>

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

            <button type="submit" className="btn-primary register-submit" disabled={submitting}>
              {submitting ? 'Registrazione...' : 'Registrati'}
            </button>
          </form>

          <p className="register-login-link">
            Hai già un account? <Link to="/accedi">Accedi</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
