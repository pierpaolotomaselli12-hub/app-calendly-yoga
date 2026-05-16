import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import type { Slot } from '../../types'
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

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  general?: string
}

function BookingForm({ slot }: { slot: Slot }) {
  const { addBooking } = useApp()
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const duplicate = slot.bookings.find(
      b => b.email.toLowerCase() === email.trim().toLowerCase()
    )
    if (duplicate) {
      setErrors({ general: 'Hai già una prenotazione per questa lezione.' })
      return
    }

    addBooking({
      slotId: slot.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
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
          <div className="booking-summary__top">
            {slot.type && <span className="badge badge--type">{slot.type}</span>}
          </div>
          <h1 className="booking-summary__title">{slot.title}</h1>
          <p className="booking-summary__date">{formatDateLong(slot.date)}</p>
          <p className="booking-summary__time">{slot.time} · {slot.duration} min</p>
          <p className="booking-summary__spots">
            {spotsLeft === 1 ? '1 posto rimasto' : `${spotsLeft} posti rimasti`}
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
              onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })) }}
              placeholder="mario.rossi@email.com"
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
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

export default function BookingPage() {
  const { slotId } = useParams<{ slotId: string }>()
  const { slots } = useApp()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

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

  if (isPast || isFull) {
    return (
      <div className="booking-unavailable">
        <p>{isPast ? 'Questa lezione è già passata.' : 'Questa lezione è al completo.'}</p>
        <Link to="/">← Torna alle lezioni</Link>
      </div>
    )
  }

  return <BookingForm slot={slot} />
}
