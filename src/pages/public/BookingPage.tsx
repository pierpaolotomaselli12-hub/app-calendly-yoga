import { useState } from 'react'
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { Slot } from '../../types'
import type { Student } from '../../types'
import './BookingPage.css'

function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getSpotsColor(spotsLeft: number, maxParticipants: number): string {
  if (spotsLeft === 0) return '#999'
  const pct = spotsLeft / maxParticipants
  if (pct > 0.5) return '#818569'
  if (pct > 0.2) return '#c17f3b'
  return '#8b4a48'
}

function SpotsDisplay({ spotsLeft, maxParticipants }: { spotsLeft: number; maxParticipants: number }) {
  if (spotsLeft === 0) {
    return <span className="spots-count" style={{ color: '#999' }}>Al completo</span>
  }
  const color = getSpotsColor(spotsLeft, maxParticipants)
  return (
    <span className="spots-display">
      <span className="spots-count" style={{ color }}>{spotsLeft}</span>
      <span className="spots-total">/ {maxParticipants} posti disponibili</span>
    </span>
  )
}

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  general?: string
}

function BookingForm({ slot, currentStudent, decrementStudentCredits }: { slot: Slot; currentStudent: Student; decrementStudentCredits: (id: string) => Promise<void> }) {
  const { addBooking } = useApp()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState(currentStudent.firstName)
  const [lastName, setLastName] = useState(currentStudent.lastName)
  const [email] = useState(currentStudent.email)
  const [phone, setPhone] = useState(currentStudent.phone)
  const [errors, setErrors] = useState<FormErrors>({})

  const spotsLeft = slot.maxParticipants - slot.bookings.length

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
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const duplicate = slot.bookings.find(
      b => b.email.toLowerCase() === email.toLowerCase()
    )
    if (duplicate) {
      setErrors({ general: 'Hai già una prenotazione per questa lezione.' })
      return
    }

    await addBooking({
      slotId: slot.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    })

    await decrementStudentCredits(currentStudent.id)

    supabase.functions.invoke('send-email', {
      body: {
        type: 'booking',
        studentEmail: email.trim(),
        studentName: firstName.trim(),
        slotTitle: slot.title,
        slotDate: formatDateLong(slot.date),
        slotTime: slot.time,
        slotDuration: slot.duration,
      },
    })

    const params = new URLSearchParams({
      name: firstName.trim(),
      title: slot.title,
      date: formatDateLong(slot.date),
      time: slot.time,
    })
    navigate(`/booking-confirmed?${params.toString()}`)
  }

  return (
    <div className="booking-page">
      <div className="booking-page__inner">
        <Link to="/" className="booking-back">← Torna alle lezioni</Link>

        <div className="booking-summary">
          {slot.imageUrl && <img src={slot.imageUrl} className="booking-cover-img" alt={slot.title} />}
          <div className="booking-summary__top">
            {slot.type && <span className="badge badge--type">{slot.type}</span>}
          </div>
          <h1 className="booking-summary__title">{slot.title}</h1>
          <p className="booking-summary__date">{formatDateLong(slot.date)}</p>
          <p className="booking-summary__time">{slot.time} · {slot.duration} min</p>
          <p className="booking-summary__spots">
            <SpotsDisplay spotsLeft={spotsLeft} maxParticipants={slot.maxParticipants} />
          </p>
          {slot.notes && (
            <p className="booking-summary__notes">{slot.notes}</p>
          )}
        </div>

        <form className="booking-form" onSubmit={handleSubmit} noValidate>
          <h2 className="booking-form__title">I tuoi dati</h2>

          {errors.general && (
            <div className="booking-form__error-banner">{errors.general}</div>
          )}

          <div className="booking-form__grid">
            <div className="form-field">
              <label className="form-label" htmlFor="firstName">Nome</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: undefined })) }}
                placeholder="Mario"
              />
              {errors.firstName && <span className="form-error">{errors.firstName}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="lastName">Cognome</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={e => { setLastName(e.target.value); setErrors(prev => ({ ...prev, lastName: undefined })) }}
                placeholder="Rossi"
              />
              {errors.lastName && <span className="form-error">{errors.lastName}</span>}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              placeholder="mario.rossi@email.com"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="phone">Telefono</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: undefined })) }}
              placeholder="+39 333 123 4567"
            />
            {errors.phone && <span className="form-error">{errors.phone}</span>}
          </div>

          <button type="submit" className="btn-primary booking-form__submit">
            Conferma prenotazione
          </button>
        </form>
      </div>
    </div>
  )
}

function WaitlistForm({ slot }: { slot: Slot }) {
  const { addToWaitlist, waitlist } = useApp()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const spotsLeft = slot.maxParticipants - slot.bookings.length

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

    const duplicate = waitlist.find(
      w => w.slotId === slot.id && w.email.toLowerCase() === email.trim().toLowerCase()
    )
    if (duplicate) {
      setErrors({ general: "Sei già in lista d'attesa per questa lezione." })
      return
    }

    await addToWaitlist({
      slotId: slot.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    })

    supabase.functions.invoke('send-email', {
      body: {
        type: 'waitlist',
        studentEmail: email.trim(),
        studentName: firstName.trim(),
        slotTitle: slot.title,
        slotDate: formatDateLong(slot.date),
        slotTime: slot.time,
        slotDuration: slot.duration,
      },
    })

    const params = new URLSearchParams({
      name: firstName.trim(),
      title: slot.title,
      date: formatDateLong(slot.date),
      time: slot.time,
      waitlist: 'true',
    })
    navigate(`/booking-confirmed?${params.toString()}`)
  }

  return (
    <div className="booking-page">
      <div className="booking-page__inner">
        <Link to="/" className="booking-back">← Torna alle lezioni</Link>

        <div className="booking-summary">
          {slot.imageUrl && <img src={slot.imageUrl} className="booking-cover-img" alt={slot.title} />}
          <div className="booking-summary__top">
            {slot.type && <span className="badge badge--type">{slot.type}</span>}
          </div>
          <h1 className="booking-summary__title">{slot.title}</h1>
          <p className="booking-summary__date">{formatDateLong(slot.date)}</p>
          <p className="booking-summary__time">{slot.time} · {slot.duration} min</p>
          <p className="booking-summary__spots">
            <SpotsDisplay spotsLeft={spotsLeft} maxParticipants={slot.maxParticipants} />
          </p>
          {slot.notes && (
            <p className="booking-summary__notes">{slot.notes}</p>
          )}
        </div>

        <form className="booking-form" onSubmit={handleSubmit} noValidate>
          <h2 className="booking-form__title">Iscriviti alla lista d&apos;attesa</h2>
          <p className="waitlist-notice">La lezione è al completo. Lascia i tuoi dati: ti contatteremo se si libera un posto.</p>

          {errors.general && (
            <div className="booking-form__error-banner">{errors.general}</div>
          )}

          <div className="booking-form__grid">
            <div className="form-field">
              <label className="form-label" htmlFor="wl-firstName">Nome</label>
              <input
                id="wl-firstName"
                type="text"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: undefined })) }}
                placeholder="Mario"
              />
              {errors.firstName && <span className="form-error">{errors.firstName}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="wl-lastName">Cognome</label>
              <input
                id="wl-lastName"
                type="text"
                value={lastName}
                onChange={e => { setLastName(e.target.value); setErrors(prev => ({ ...prev, lastName: undefined })) }}
                placeholder="Rossi"
              />
              {errors.lastName && <span className="form-error">{errors.lastName}</span>}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="wl-email">Email</label>
            <input
              id="wl-email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })) }}
              placeholder="mario.rossi@email.com"
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="wl-phone">Telefono</label>
            <input
              id="wl-phone"
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: undefined })) }}
              placeholder="+39 333 123 4567"
            />
            {errors.phone && <span className="form-error">{errors.phone}</span>}
          </div>

          <button type="submit" className="btn-primary booking-form__submit">
            Iscriviti alla lista d&apos;attesa
          </button>
        </form>
      </div>
    </div>
  )
}

export default function BookingPage() {
  const { slotId } = useParams<{ slotId: string }>()
  const { slots, loading, currentStudent, decrementStudentCredits } = useApp()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (!currentStudent) {
    return <Navigate to="/accedi" replace />
  }

  if (loading) {
    return (
      <div className="booking-unavailable">
        <p>Caricamento...</p>
      </div>
    )
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
  const slotDate = new Date(y, m - 1, d)
  const isPast = slotDate < today
  const isFull = slot.bookings.length >= slot.maxParticipants

  if (isPast) {
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
        <p style={{ fontSize: '14px', color: 'var(--color-text-light)' }}>Contatta l&apos;insegnante per acquistare un nuovo pacchetto.</p>
        <Link to="/">← Torna alle lezioni</Link>
      </div>
    )
  }

  if (isFull) {
    return <WaitlistForm slot={slot} />
  }

  return <BookingForm slot={slot} currentStudent={currentStudent} decrementStudentCredits={decrementStudentCredits} />
}
