import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS_PATH } from '../../lib/navigation'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import type { Slot, Booking } from '../../types'
import './CancelPage.css'

interface BookingItem {
  booking: Booking
  slot: Slot
}

type RowState = 'idle' | 'confirming' | 'cancelling' | 'done'

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

function isCancelable(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date() < new Date(y, m - 1, d, 10, 0, 0)
}

export default function CancelPage() {
  const { slots, deleteBooking, students, incrementStudentCredits, currentStudent, loading } = useApp()
  const [searchEmail, setSearchEmail] = useState(currentStudent?.email ?? '')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [found, setFound] = useState<BookingItem[]>([])
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const results = slots
      .filter(s => {
        const [y, m, d] = s.date.split('-').map(Number)
        return new Date(y, m - 1, d) >= today
      })
      .flatMap(s =>
        s.bookings
          .filter(b => b.email.toLowerCase() === searchEmail.toLowerCase())
          .map(b => ({ booking: b, slot: s }))
      )
    setFound(results)
    setRowStates({})
    setSubmitted(true)
  }

  function setRowState(bookingId: string, state: RowState) {
    setRowStates(prev => ({ ...prev, [bookingId]: state }))
  }

  async function handleConfirm(item: BookingItem) {
    setRowState(item.booking.id, 'cancelling')
    setCancelError(null)
    try {
      await deleteBooking(item.slot.id, item.booking.id) // per lo studente: cancel_booking, che restituisce anche il credito
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Disdetta non riuscita. Riprova.')
      setRowState(item.booking.id, 'idle')
      return
    }
    supabase.functions.invoke('send-email', {
      body: {
        type: 'cancellation',
        studentEmail: item.booking.email,
        studentName: `${item.booking.firstName} ${item.booking.lastName}`,
        slotTitle: item.slot.title,
        slotDate: formatDate(item.slot.date),
        slotTime: item.slot.time,
        slotDuration: item.slot.duration,
      },
    })
    const student = students.find(s => s.email.toLowerCase() === item.booking.email.toLowerCase())
    if (student) {
      await incrementStudentCredits(student.id)
    }
    setRowState(item.booking.id, 'done')
  }

  if (!loading && !currentStudent) {
    return (
      <div className="cancel-page">
        <div className="cancel-inner">
          <Link to={LESSONS_PATH} className="cancel-back">← Torna alle lezioni</Link>
          <h1 className="cancel-title">Disdici una prenotazione</h1>
          <p className="cancel-empty">Per vedere e disdire le tue prenotazioni <Link to="/accedi" state={{ from: '/cancella' }}>accedi al tuo account</Link>.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cancel-page">
      <div className="cancel-inner">
        <Link to={LESSONS_PATH} className="cancel-back">← Torna alle lezioni</Link>
        <h1 className="cancel-title">Disdici una prenotazione</h1>
        {cancelError && <p className="cancel-empty" role="alert">{cancelError}</p>}
        <form className="cancel-form" onSubmit={handleSearch}>
          <input
            className="cancel-email-input"
            type="email"
            placeholder="La tua email"
            value={searchEmail}
            onChange={e => {
              setSearchEmail(e.target.value)
              setSubmitted(false)
            }}
            required
          />
          <button type="submit" className="btn-primary cancel-search-btn">Cerca</button>
        </form>
        {submitted && found.length === 0 && (
          <p className="cancel-empty">Nessuna prenotazione trovata per questa email.</p>
        )}
        {found.length > 0 && (
          <ul className="cancel-list">
            {found.map(item => {
              const state = rowStates[item.booking.id] ?? 'idle'
              return (
                <li key={item.booking.id} className="cancel-card">
                  <div className="cancel-card__info">
                    <span className="cancel-card__title">{item.slot.title}</span>
                    <span className="cancel-card__meta">
                      {formatDate(item.slot.date)} — {item.slot.time}
                    </span>
                  </div>
                  <div className="cancel-card__actions">
                    {!isCancelable(item.slot.date) && state === 'idle' && (
                      <span className="cancel-status cancel-status--expired">Cancellazione scaduta (ore 10:00)</span>
                    )}
                    {isCancelable(item.slot.date) && state === 'idle' && (
                      <button
                        className="cancel-btn-disdici"
                        onClick={() => setRowState(item.booking.id, 'confirming')}
                      >
                        Disdici
                      </button>
                    )}
                    {state === 'confirming' && (
                      <div className="cancel-confirm-row">
                        <span className="cancel-confirm-label">Conferma disdetta?</span>
                        <button
                          className="cancel-btn-confirm"
                          onClick={() => { void handleConfirm(item) }}
                        >
                          Conferma
                        </button>
                        <button
                          className="cancel-btn-annulla"
                          onClick={() => setRowState(item.booking.id, 'idle')}
                        >
                          Annulla
                        </button>
                      </div>
                    )}
                    {state === 'cancelling' && (
                      <span className="cancel-status">Annullamento...</span>
                    )}
                    {state === 'done' && (
                      <span className="cancel-status cancel-status--done">Prenotazione cancellata.</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
