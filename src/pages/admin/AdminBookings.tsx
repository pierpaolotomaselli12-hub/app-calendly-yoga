import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import './AdminBookings.css'

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatBookingDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

type Filter = 'upcoming' | 'past' | 'all'

export default function AdminBookings() {
  const { slots, deleteBooking, waitlist, removeFromWaitlist } = useApp()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('upcoming')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filteredSlots = useMemo(() => {
    return [...slots]
      .filter(s => {
        const [y, m, d] = s.date.split('-').map(Number)
        const slotDate = new Date(y, m - 1, d)
        if (filter === 'upcoming') return slotDate >= today
        if (filter === 'past') return slotDate < today
        return true
      })
      .sort((a, b) => {
        if (filter === 'past') return b.date.localeCompare(a.date) || b.time.localeCompare(a.time)
        return a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
      })
  }, [slots, filter])

  const totalBookings = slots.reduce((sum, s) => sum + s.bookings.length, 0)
  const upcomingBookings = useMemo(() => {
    return slots
      .filter(s => {
        const [y, m, d] = s.date.split('-').map(Number)
        return new Date(y, m - 1, d) >= today
      })
      .reduce((sum, s) => sum + s.bookings.length, 0)
  }, [slots])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDelete(slotId: string, bookingId: string) {
    const key = `${slotId}:${bookingId}`
    if (deleteConfirm === key) {
      await deleteBooking(slotId, bookingId)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(key)
    }
  }

  return (
    <div className="bookings-page">
      <div className="bookings-header">
        <div>
          <h1 className="bookings-title">Gestione prenotazioni</h1>
          <p className="bookings-subtitle">
            {upcomingBookings} prenotazioni per le prossime lezioni · {totalBookings} totali
          </p>
        </div>
        <div className="bookings-filters">
          {(['upcoming', 'past', 'all'] as Filter[]).map(f => (
            <button
              key={f}
              className={`bookings-filter-btn ${filter === f ? 'bookings-filter-btn--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'upcoming' ? 'Prossime' : f === 'past' ? 'Passate' : 'Tutte'}
            </button>
          ))}
        </div>
      </div>

      {filteredSlots.length === 0 ? (
        <div className="bookings-empty-state">
          <p className="bookings-empty-title">
            {filter === 'upcoming' ? 'Nessuna lezione in programma' : 'Nessuna lezione trovata'}
          </p>
          <p className="bookings-empty-sub">
            {filter === 'upcoming' ? 'Crea delle lezioni dalla sezione Lezioni.' : ''}
          </p>
        </div>
      ) : (
        <div className="bookings-list">
          {filteredSlots.map(slot => {
            const isOpen = expanded.has(slot.id)
            const slotWaitlist = waitlist.filter(w => w.slotId === slot.id)
            const fillPct = slot.maxParticipants > 0
              ? Math.round((slot.bookings.length / slot.maxParticipants) * 100)
              : 0
            const isFull = slot.bookings.length >= slot.maxParticipants
            const [y, m, d] = slot.date.split('-').map(Number)
            const isPast = new Date(y, m - 1, d) < today

            return (
              <div key={slot.id} className={`bookings-slot ${isPast ? 'bookings-slot--past' : ''}`}>
                <button
                  className="bookings-slot-header"
                  onClick={() => toggleExpand(slot.id)}
                >
                  <div className="bookings-slot-info">
                    <div className="bookings-slot-top">
                      {slot.type && (
                        <span className="bookings-badge-type">{slot.type}</span>
                      )}
                      {isPast && (
                        <span className="bookings-badge-past">Passata</span>
                      )}
                      {isFull && !isPast && (
                        <span className="bookings-badge-full">Al completo</span>
                      )}
                    </div>
                    <span className="bookings-slot-title">{slot.title}</span>
                    <span className="bookings-slot-meta">
                      {formatDate(slot.date)} &middot; {slot.time} &middot; {slot.duration} min
                    </span>
                  </div>
                  <div className="bookings-slot-right">
                    <div className="bookings-count-wrap">
                      <span className="bookings-count">
                        {slot.bookings.length} / {slot.maxParticipants}
                      </span>
                      <div className="bookings-bar">
                        <div
                          className="bookings-bar-fill"
                          style={{ width: `${fillPct}%`, background: isFull ? '#8b4a48' : 'var(--color-green)' }}
                        />
                      </div>
                    </div>
                    {slotWaitlist.length > 0 && (
                      <span className="bookings-waitlist-badge">
                        +{slotWaitlist.length} in attesa
                      </span>
                    )}
                    <span className={`bookings-chevron ${isOpen ? 'bookings-chevron--open' : ''}`}>›</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="bookings-detail">
                    {slot.bookings.length === 0 ? (
                      <p className="bookings-no-entries">Nessuna prenotazione per questa lezione.</p>
                    ) : (
                      <>
                        <p className="bookings-section-label">Prenotazioni ({slot.bookings.length})</p>
                        <table className="bookings-table">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>Email</th>
                              <th className="col-phone">Telefono</th>
                              <th className="col-date">Prenotato il</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {slot.bookings.map(booking => {
                              const key = `${slot.id}:${booking.id}`
                              return (
                                <tr key={booking.id}>
                                  <td className="bk-name">{booking.firstName} {booking.lastName}</td>
                                  <td className="bk-meta">{booking.email}</td>
                                  <td className="bk-meta col-phone">{booking.phone}</td>
                                  <td className="bk-meta col-date">{formatBookingDate(booking.createdAt)}</td>
                                  <td className="bk-actions">
                                    {deleteConfirm === key ? (
                                      <>
                                        <button
                                          className="btn-confirm-delete-sm"
                                          onClick={() => { void handleDelete(slot.id, booking.id) }}
                                        >
                                          Conferma
                                        </button>
                                        <button
                                          className="btn-cancel-xs"
                                          onClick={() => setDeleteConfirm(null)}
                                        >
                                          No
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        className="btn-danger"
                                        onClick={() => setDeleteConfirm(key)}
                                      >
                                        Rimuovi
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </>
                    )}

                    {slotWaitlist.length > 0 && (
                      <div className="bookings-waitlist-section">
                        <p className="bookings-section-label bookings-section-label--waitlist">
                          Lista d&apos;attesa ({slotWaitlist.length})
                        </p>
                        <table className="bookings-table">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>Email</th>
                              <th className="col-phone">Telefono</th>
                              <th className="col-date">Iscritto il</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {slotWaitlist.map(entry => (
                              <tr key={entry.id}>
                                <td className="bk-name">{entry.firstName} {entry.lastName}</td>
                                <td className="bk-meta">{entry.email}</td>
                                <td className="bk-meta col-phone">{entry.phone}</td>
                                <td className="bk-meta col-date">{formatBookingDate(entry.createdAt)}</td>
                                <td className="bk-actions">
                                  <button
                                    className="btn-danger"
                                    onClick={() => { void removeFromWaitlist(slot.id, entry.id) }}
                                  >
                                    Rimuovi
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
