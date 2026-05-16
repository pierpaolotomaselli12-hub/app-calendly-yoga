import { useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function CancelPage() {
  const { slots, deleteBooking } = useApp()
  const [searchEmail, setSearchEmail] = useState('')
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
    await deleteBooking(item.slot.id, item.booking.id)
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
    setRowState(item.booking.id, 'done')
  }

  return (
    <div className="cancel-page">
      <div className="cancel-inner">
        <Link to="/" className="cancel-back">← Torna alle lezioni</Link>
        <h1 className="cancel-title">Disdici una prenotazione</h1>
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
                    {state === 'idle' && (
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
