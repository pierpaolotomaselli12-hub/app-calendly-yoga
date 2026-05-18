import { useState } from 'react'
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { YogaEvent } from '../../types'
import './BookingPage.css'

function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function getSpotsColor(spotsLeft: number, max: number): string {
  if (spotsLeft === 0) return '#999'
  const pct = spotsLeft / max
  if (pct > 0.5) return '#818569'
  if (pct > 0.2) return '#c17f3b'
  return '#8b4a48'
}

function SpotsDisplay({ spotsLeft, max }: { spotsLeft: number; max: number }) {
  if (spotsLeft === 0) return <span className="spots-count" style={{ color: '#999' }}>Al completo</span>
  const color = getSpotsColor(spotsLeft, max)
  return (
    <span className="spots-display">
      <span className="spots-count" style={{ color }}>{spotsLeft}</span>
      <span className="spots-total">/ {max} posti disponibili</span>
    </span>
  )
}

interface FormErrors { firstName?: string; lastName?: string; phone?: string; general?: string }

function BookingForm({ event }: { event: YogaEvent }) {
  const { addEventBooking, currentStudent } = useApp()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState(currentStudent?.firstName ?? '')
  const [lastName, setLastName] = useState(currentStudent?.lastName ?? '')
  const [email] = useState(currentStudent?.email ?? '')
  const [phone, setPhone] = useState(currentStudent?.phone ?? '')
  const [errors, setErrors] = useState<FormErrors>({})

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!firstName.trim()) errs.firstName = 'Il nome è obbligatorio.'
    if (!lastName.trim()) errs.lastName = 'Il cognome è obbligatorio.'
    if (!phone.trim()) errs.phone = 'Il telefono è obbligatorio.'
    else if (!/^[\d\s+\-().]+$/.test(phone.trim())) errs.phone = 'Inserisci un numero valido.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const duplicate = event.bookings.find(b => b.email.toLowerCase() === email.toLowerCase())
    if (duplicate) { setErrors({ general: 'Hai già una prenotazione per questo evento.' }); return }

    await addEventBooking({ eventId: event.id, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() })

    void supabase.functions.invoke('send-email', {
      body: {
        type: 'booking',
        studentEmail: email.trim(),
        studentName: firstName.trim(),
        slotTitle: `[EVENTO] ${event.title}`,
        slotDate: formatDateLong(event.date),
        slotTime: event.time,
        slotDuration: 0,
      },
    })

    const params = new URLSearchParams({ name: firstName.trim(), title: event.title, date: formatDateLong(event.date), time: event.time })
    navigate(`/booking-confirmed?${params.toString()}`)
  }

  const spotsLeft = event.maxParticipants - event.bookings.length

  return (
    <div className="booking-page">
      <div className="booking-page__inner">
        <Link to="/" className="booking-back">← Torna agli eventi</Link>
        <div className="booking-summary">
          <div className="booking-summary__top">
            <span className="badge badge--type">Evento</span>
            {event.price && <span className="badge badge--type" style={{ color: '#c17f3b', borderColor: '#c17f3b' }}>{event.price}</span>}
          </div>
          <h1 className="booking-summary__title">{event.title}</h1>
          <p className="booking-summary__date">{formatDateLong(event.date)}</p>
          <p className="booking-summary__time">{event.time}</p>
          {event.location && <p className="booking-summary__time">📍 {event.location}</p>}
          <p className="booking-summary__spots"><SpotsDisplay spotsLeft={spotsLeft} max={event.maxParticipants} /></p>
          {event.description && <p className="booking-summary__notes">{event.description}</p>}
          {event.notes && <p className="booking-summary__notes">{event.notes}</p>}
          {event.price && (
            <p className="booking-summary__notes" style={{ color: '#c17f3b' }}>
              Il pagamento avviene direttamente con l&apos;insegnante.
            </p>
          )}
        </div>

        <form className="booking-form" onSubmit={handleSubmit} noValidate>
          <h2 className="booking-form__title">I tuoi dati</h2>
          {errors.general && <div className="booking-form__error-banner">{errors.general}</div>}
          <div className="booking-form__grid">
            <div className="form-field">
              <label className="form-label" htmlFor="ev-firstName">Nome</label>
              <input id="ev-firstName" type="text" value={firstName}
                onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: undefined })) }} placeholder="Mario" />
              {errors.firstName && <span className="form-error">{errors.firstName}</span>}
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="ev-lastName">Cognome</label>
              <input id="ev-lastName" type="text" value={lastName}
                onChange={e => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: undefined })) }} placeholder="Rossi" />
              {errors.lastName && <span className="form-error">{errors.lastName}</span>}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="ev-email">Email</label>
            <input id="ev-email" type="email" value={email} readOnly />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="ev-phone">Telefono</label>
            <input id="ev-phone" type="tel" value={phone}
              onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: undefined })) }} placeholder="+39 333 123 4567" />
            {errors.phone && <span className="form-error">{errors.phone}</span>}
          </div>
          <button type="submit" className="btn-primary booking-form__submit">Conferma iscrizione</button>
        </form>
      </div>
    </div>
  )
}

function WaitlistForm({ event }: { event: YogaEvent }) {
  const { addToEventWaitlist } = useApp()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!firstName.trim()) errs.firstName = 'Il nome è obbligatorio.'
    if (!lastName.trim()) errs.lastName = 'Il cognome è obbligatorio.'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.general = "Inserisci un'email valida."
    if (!phone.trim()) errs.phone = 'Il telefono è obbligatorio.'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const dup = event.waitlist.find(w => w.email.toLowerCase() === email.trim().toLowerCase())
    if (dup) { setErrors({ general: "Sei già in lista d'attesa per questo evento." }); return }

    await addToEventWaitlist({ eventId: event.id, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() })

    void supabase.functions.invoke('send-email', {
      body: {
        type: 'waitlist',
        studentEmail: email.trim(),
        studentName: firstName.trim(),
        slotTitle: `[EVENTO] ${event.title}`,
        slotDate: formatDateLong(event.date),
        slotTime: event.time,
        slotDuration: 0,
      },
    })

    const params = new URLSearchParams({ name: firstName.trim(), title: event.title, date: formatDateLong(event.date), time: event.time, waitlist: 'true' })
    navigate(`/booking-confirmed?${params.toString()}`)
  }

  const spotsLeft = event.maxParticipants - event.bookings.length

  return (
    <div className="booking-page">
      <div className="booking-page__inner">
        <Link to="/" className="booking-back">← Torna agli eventi</Link>
        <div className="booking-summary">
          <div className="booking-summary__top"><span className="badge badge--type">Evento</span></div>
          <h1 className="booking-summary__title">{event.title}</h1>
          <p className="booking-summary__date">{formatDateLong(event.date)}</p>
          <p className="booking-summary__time">{event.time}</p>
          {event.location && <p className="booking-summary__time">📍 {event.location}</p>}
          <p className="booking-summary__spots"><SpotsDisplay spotsLeft={spotsLeft} max={event.maxParticipants} /></p>
        </div>
        <form className="booking-form" onSubmit={handleSubmit} noValidate>
          <h2 className="booking-form__title">Iscriviti alla lista d&apos;attesa</h2>
          <p className="waitlist-notice">L&apos;evento è al completo. Lascia i tuoi dati: ti contatteremo se si libera un posto.</p>
          {errors.general && <div className="booking-form__error-banner">{errors.general}</div>}
          <div className="booking-form__grid">
            <div className="form-field">
              <label className="form-label">Nome</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Mario" />
              {errors.firstName && <span className="form-error">{errors.firstName}</span>}
            </div>
            <div className="form-field">
              <label className="form-label">Cognome</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Rossi" />
              {errors.lastName && <span className="form-error">{errors.lastName}</span>}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mario.rossi@email.com" />
          </div>
          <div className="form-field">
            <label className="form-label">Telefono</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39 333 123 4567" />
            {errors.phone && <span className="form-error">{errors.phone}</span>}
          </div>
          <button type="submit" className="btn-primary booking-form__submit">Iscriviti alla lista d&apos;attesa</button>
        </form>
      </div>
    </div>
  )
}

export default function EventBookingPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const { events, loading, currentStudent } = useApp()

  if (!currentStudent) return <Navigate to="/accedi" replace />
  if (loading) return <div className="booking-unavailable"><p>Caricamento...</p></div>

  const event = events.find(e => e.id === eventId)
  if (!event) return (
    <div className="booking-unavailable">
      <p>Evento non disponibile.</p>
      <Link to="/">← Torna alla home</Link>
    </div>
  )

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, m, d] = event.date.split('-').map(Number)
  if (new Date(y, m - 1, d) < today) return (
    <div className="booking-unavailable">
      <p>Questo evento è già passato.</p>
      <Link to="/">← Torna alla home</Link>
    </div>
  )

  const isFull = event.bookings.length >= event.maxParticipants
  if (isFull) return <WaitlistForm event={event} />
  return <BookingForm event={event} />
}
