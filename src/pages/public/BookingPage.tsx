import { useState } from 'react'
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { Slot } from '../../types'
import type { Student } from '../../types'
import './BookingPage.css'

function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  general?: string
}

// ── Lesson detail panel (shared between booking and waitlist) ──

function LessonDetail({ slot }: { slot: Slot }) {
  const spotsLeft = slot.maxParticipants - slot.bookings.length
  return (
    <div className="lesson-card">
      <div className="lesson-hero">
        {slot.imageUrl
          ? <img className="lesson-hero-img" src={slot.imageUrl} alt={slot.title} />
          : <div className="lesson-hero-placeholder" />
        }
        <div className="lesson-hero-overlay">
          {slot.type && <span className="lesson-hero-badge">{slot.type}</span>}
          <h1 className="lesson-hero-title">{slot.title}</h1>
        </div>
      </div>

      <div className="lesson-info-grid">
        <div className="lesson-info-cell">
          <span className="lesson-info-label">Data</span>
          <span className="lesson-info-value">{formatDateLong(slot.date)}</span>
        </div>
        <div className="lesson-info-cell">
          <span className="lesson-info-label">Orario</span>
          <span className="lesson-info-value">{slot.time} · {slot.duration} min</span>
        </div>
        <div className="lesson-info-cell">
          <span className="lesson-info-label">Posti</span>
          <span className="lesson-info-value">{spotsLeft}/{slot.maxParticipants} disponibili</span>
        </div>
      </div>

      {slot.notes && (
        <div className="lesson-description">
          <span className="lesson-description-label">Cosa ti aspetta</span>
          <p className="lesson-description-text">{slot.notes}</p>
        </div>
      )}

      <div className="lesson-pills">
        <span className="lesson-pill">
          <svg className="lesson-pill-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="7" /><path d="M8 4v4l3 2" />
          </svg>
          Annulla fino a 12h prima
        </span>
      </div>
    </div>
  )
}

// ── Booking form ───────────────────────────────────────────────

function BookingForm({ slot, currentStudent, decrementStudentCredits }: { slot: Slot; currentStudent: Student; decrementStudentCredits: (id: string) => Promise<void> }) {
  const { addBooking } = useApp()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState(currentStudent.firstName)
  const [lastName, setLastName] = useState(currentStudent.lastName)
  const [email] = useState(currentStudent.email)
  const [phone, setPhone] = useState(currentStudent.phone)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!firstName.trim()) errs.firstName = 'Il nome è obbligatorio.'
    if (!lastName.trim()) errs.lastName = 'Il cognome è obbligatorio.'
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
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const duplicate = slot.bookings.find(b => b.email.toLowerCase() === email.toLowerCase())
    if (duplicate) { setErrors({ general: 'Hai già una prenotazione per questa lezione.' }); return }

    setSubmitting(true)
    await addBooking({ slotId: slot.id, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() })
    await decrementStudentCredits(currentStudent.id)

    supabase.functions.invoke('send-email', {
      body: { type: 'booking', studentEmail: email.trim(), studentName: firstName.trim(), slotTitle: slot.title, slotDate: formatDateLong(slot.date), slotTime: slot.time, slotDuration: slot.duration },
    })

    const params = new URLSearchParams({ name: firstName.trim(), title: slot.title, date: formatDateLong(slot.date), time: slot.time })
    navigate(`/booking-confirmed?${params.toString()}`)
  }

  return (
    <div className="booking-page">
      <div className="booking-page__inner">
        <Link to="/" className="booking-back">← Torna alle lezioni</Link>

        <div className="booking-layout">
          <LessonDetail slot={slot} />

          <div className="booking-form-card">
            <div className="booking-steps">
              <div className="booking-step booking-step--active">
                <span className="booking-step-num">1</span>
                Conferma
              </div>
              <span className="booking-steps-sep">·</span>
              <div className="booking-step">
                <span className="booking-step-num">2</span>
                Riepilogo
              </div>
            </div>

            <h2 className="booking-form-title">Conferma i tuoi dati</h2>
            <p className="booking-form-subtitle">
              Useremo questi contatti solo per la prenotazione. Sei già registrato — verifica che tutto sia corretto.
            </p>

            {errors.general && (
              <div className="booking-error-banner">{errors.general}</div>
            )}

            <form onSubmit={handleSubmit} noValidate className="booking-form-inner">
              <div className="booking-form__grid">
                <div className="form-field">
                  <label className="form-label" htmlFor="firstName">Nome</label>
                  <input
                    id="firstName" type="text" value={firstName}
                    onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: undefined })) }}
                    placeholder="Mario"
                  />
                  {errors.firstName && <span className="form-error">{errors.firstName}</span>}
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="lastName">Cognome</label>
                  <input
                    id="lastName" type="text" value={lastName}
                    onChange={e => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: undefined })) }}
                    placeholder="Rossi"
                  />
                  {errors.lastName && <span className="form-error">{errors.lastName}</span>}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="email">Email</label>
                <div className="input-icon-wrap">
                  <svg className="input-prefix-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="3" width="14" height="10" rx="2" />
                    <path d="M1 6l7 4 7-4" />
                  </svg>
                  <input id="email" type="email" value={email} readOnly className="input-with-icon" />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="phone">Telefono</label>
                <div className="phone-input-wrap">
                  <span className="phone-prefix">🇮🇹 +39</span>
                  <div className="phone-divider" />
                  <input
                    id="phone" type="tel" value={phone}
                    onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: undefined })) }}
                    placeholder="348 427 3489"
                    className="phone-input"
                  />
                </div>
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>

              <div className="booking-credit-box">
                <span className="booking-credit-icon">🌿</span>
                <div>
                  <p className="booking-credit-text">1 lezione del tuo pacchetto verrà utilizzata</p>
                  <p className="booking-credit-sub">
                    Crediti residui: {currentStudent.lessonCredits} → dopo la prenotazione resteranno {currentStudent.lessonCredits - 1}
                  </p>
                </div>
              </div>

              <div className="booking-actions">
                <button type="button" className="btn-annulla" onClick={() => navigate('/')}>
                  Annulla
                </button>
                <button type="submit" className="btn-primary booking-submit" disabled={submitting}>
                  {submitting ? 'Conferma in corso…' : 'Conferma prenotazione →'}
                </button>
              </div>

              <p className="booking-privacy">🔒 Confermando accetti i termini e l&apos;informativa privacy.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Waitlist form ──────────────────────────────────────────────

function WaitlistForm({ slot }: { slot: Slot }) {
  const { addToWaitlist, waitlist } = useApp()
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
    if (!email.trim()) { errs.email = "L'email è obbligatoria." }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { errs.email = "Inserisci un'email valida." }
    if (!phone.trim()) { errs.phone = 'Il telefono è obbligatorio.' }
    else if (!/^[\d\s+\-().]+$/.test(phone.trim())) { errs.phone = 'Inserisci un numero di telefono valido.' }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const duplicate = waitlist.find(w => w.slotId === slot.id && w.email.toLowerCase() === email.trim().toLowerCase())
    if (duplicate) { setErrors({ general: "Sei già in lista d'attesa per questa lezione." }); return }

    setSubmitting(true)
    await addToWaitlist({ slotId: slot.id, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() })

    supabase.functions.invoke('send-email', {
      body: { type: 'waitlist', studentEmail: email.trim(), studentName: firstName.trim(), slotTitle: slot.title, slotDate: formatDateLong(slot.date), slotTime: slot.time, slotDuration: slot.duration },
    })

    const params = new URLSearchParams({ name: firstName.trim(), title: slot.title, date: formatDateLong(slot.date), time: slot.time, waitlist: 'true' })
    navigate(`/booking-confirmed?${params.toString()}`)
  }

  return (
    <div className="booking-page">
      <div className="booking-page__inner">
        <Link to="/" className="booking-back">← Torna alle lezioni</Link>

        <div className="booking-layout">
          <LessonDetail slot={slot} />

          <div className="booking-form-card">
            <h2 className="booking-form-title">Lista d&apos;attesa</h2>
            <p className="booking-form-subtitle">
              La lezione è al completo. Lascia i tuoi dati: ti contatteremo se si libera un posto.
            </p>

            {errors.general && <div className="booking-error-banner">{errors.general}</div>}

            <form onSubmit={handleSubmit} noValidate className="booking-form-inner">
              <div className="booking-form__grid">
                <div className="form-field">
                  <label className="form-label" htmlFor="wl-firstName">Nome</label>
                  <input id="wl-firstName" type="text" value={firstName}
                    onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: undefined })) }}
                    placeholder="Mario" />
                  {errors.firstName && <span className="form-error">{errors.firstName}</span>}
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="wl-lastName">Cognome</label>
                  <input id="wl-lastName" type="text" value={lastName}
                    onChange={e => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: undefined })) }}
                    placeholder="Rossi" />
                  {errors.lastName && <span className="form-error">{errors.lastName}</span>}
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="wl-email">Email</label>
                <div className="input-icon-wrap">
                  <svg className="input-prefix-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="3" width="14" height="10" rx="2" />
                    <path d="M1 6l7 4 7-4" />
                  </svg>
                  <input id="wl-email" type="email" value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
                    placeholder="mario.rossi@email.com" className="input-with-icon" />
                </div>
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="wl-phone">Telefono</label>
                <div className="phone-input-wrap">
                  <span className="phone-prefix">🇮🇹 +39</span>
                  <div className="phone-divider" />
                  <input id="wl-phone" type="tel" value={phone}
                    onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: undefined })) }}
                    placeholder="348 427 3489" className="phone-input" />
                </div>
                {errors.phone && <span className="form-error">{errors.phone}</span>}
              </div>

              <div className="booking-actions">
                <button type="button" className="btn-annulla" onClick={() => navigate('/')}>Annulla</button>
                <button type="submit" className="btn-primary booking-submit" disabled={submitting}>
                  {submitting ? 'Iscrizione in corso…' : 'Iscriviti alla lista d\'attesa →'}
                </button>
              </div>

              <p className="booking-privacy">🔒 Confermando accetti i termini e l&apos;informativa privacy.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page entry ────────────────────────────────────────────────

export default function BookingPage() {
  const { slotId } = useParams<{ slotId: string }>()
  const { slots, loading, currentStudent, decrementStudentCredits } = useApp()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (!currentStudent) return <Navigate to="/accedi" replace />

  if (loading) {
    return <div className="booking-unavailable"><p>Caricamento...</p></div>
  }

  const slot = slots.find(s => s.id === slotId)
  if (!slot) {
    return (
      <div className="booking-unavailable">
        <p>Lezione non disponibile.</p>
        <Link to="/">← Torna alle lezioni</Link>
      </div>
    )
  }

  const [y, m, d] = slot.date.split('-').map(Number)
  if (new Date(y, m - 1, d) < today) {
    return (
      <div className="booking-unavailable">
        <p>Questa lezione è già passata.</p>
        <Link to="/">← Torna alle lezioni</Link>
      </div>
    )
  }

  if (currentStudent.lessonCredits === 0) {
    return (
      <div className="booking-unavailable">
        <p>Non hai lezioni disponibili nel tuo pacchetto.</p>
        <p style={{ fontSize: '14px', color: 'var(--color-text-light)' }}>
          Contatta l&apos;insegnante per acquistare un nuovo pacchetto.
        </p>
        <Link to="/">← Torna alle lezioni</Link>
      </div>
    )
  }

  if (slot.bookings.length >= slot.maxParticipants) {
    return <WaitlistForm slot={slot} />
  }

  return <BookingForm slot={slot} currentStudent={currentStudent} decrementStudentCredits={decrementStudentCredits} />
}
