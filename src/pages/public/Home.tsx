import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import './Home.css'

function isCancelable(dateStr: string, timeStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const deadline = new Date(y, m - 1, d, 10, 0, 0)
  void timeStr
  return new Date() < deadline
}

function formatEventDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

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

export default function Home() {
  const { slots, events, loading, currentStudent, studentLogout, deleteBooking, deleteEventBooking, incrementStudentCredits, students } = useApp()
  const navigate = useNavigate()
  const [activeType, setActiveType] = useState<string>('Tutte')
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcomingSlots = useMemo(() => {
    return slots
      .filter(slot => {
        const [y, m, d] = slot.date.split('-').map(Number)
        return new Date(y, m - 1, d) >= today
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.time.localeCompare(b.time)
      })
  }, [slots])

  const types = useMemo(() => {
    const set = new Set(upcomingSlots.map(s => s.type).filter(t => t.trim() !== ''))
    return Array.from(set)
  }, [upcomingSlots])

  const filtered = useMemo(() => {
    if (activeType === 'Tutte') return upcomingSlots
    return upcomingSlots.filter(s => s.type === activeType)
  }, [upcomingSlots, activeType])

  const upcomingEvents = useMemo(() => {
    return events
      .filter(ev => {
        const [y, m, d] = ev.date.split('-').map(Number)
        return new Date(y, m - 1, d) >= today
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }, [events])

  const myBookings = useMemo(() => {
    if (!currentStudent) return []
    return slots
      .filter(s => {
        const [y, m, d] = s.date.split('-').map(Number)
        const slotDate = new Date(y, m - 1, d)
        return slotDate >= today && s.bookings.some(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .map(s => ({
        slot: s,
        booking: s.bookings.find(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())!,
        cancelable: isCancelable(s.date, s.time),
      }))
  }, [slots, currentStudent])

  const myEventBookings = useMemo(() => {
    if (!currentStudent) return []
    return events
      .filter(ev => {
        const [y, m, d] = ev.date.split('-').map(Number)
        return new Date(y, m - 1, d) >= today && ev.bookings.some(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .map(ev => ({
        event: ev,
        booking: ev.bookings.find(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())!,
        cancelable: isCancelable(ev.date, ev.time),
      }))
  }, [events, currentStudent])

  async function handleCancel(slotId: string, bookingId: string, slotTitle: string, slotDate: string, slotTime: string, slotDuration: number) {
    setCancelling(bookingId)
    await deleteBooking(slotId, bookingId)
    const student = students.find(s => s.email.toLowerCase() === currentStudent!.email.toLowerCase())
    if (student) await incrementStudentCredits(student.id)
    void supabase.functions.invoke('send-email', {
      body: {
        type: 'cancellation',
        studentEmail: currentStudent!.email,
        studentName: `${currentStudent!.firstName} ${currentStudent!.lastName}`,
        slotTitle,
        slotDate: formatDateLong(slotDate),
        slotTime,
        slotDuration,
      },
    })
    setCancelling(null)
    setCancelConfirm(null)
    setExpandedBooking(null)
  }

  async function handleEventCancel(eventId: string, bookingId: string, eventTitle: string, eventDate: string, eventTime: string) {
    const key = `ev:${bookingId}`
    setCancelling(key)
    await deleteEventBooking(eventId, bookingId)
    void supabase.functions.invoke('send-email', {
      body: {
        type: 'cancellation',
        studentEmail: currentStudent!.email,
        studentName: `${currentStudent!.firstName} ${currentStudent!.lastName}`,
        slotTitle: `[EVENTO] ${eventTitle}`,
        slotDate: formatDateLong(eventDate),
        slotTime: eventTime,
        slotDuration: 0,
      },
    })
    setCancelling(null)
    setCancelConfirm(null)
    setExpandedBooking(null)
  }

  const gamification = useMemo(() => {
    if (!currentStudent) return null
    const completedSlots = slots.filter(s => {
      const [y, m, d] = s.date.split('-').map(Number)
      const slotDate = new Date(y, m - 1, d)
      return slotDate < today && s.bookings.some(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())
    })
    if (completedSlots.length === 0) return null
    const earliest = completedSlots.reduce((min, s) => s.date < min ? s.date : min, completedSlots[0].date)
    const [ey, em, ed] = earliest.split('-').map(Number)
    const firstDate = new Date(ey, em - 1, ed)
    const daysPracticing = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    return { lessonsCompleted: completedSlots.length, daysPracticing }
  }, [slots, currentStudent])

  return (
    <div className="home">
      <div className="home-sticky-top">
        <header className="home-header">
          <div className="home-header-left">
            <h1 className="home-logo">Laura Pagnossin</h1>
            <p className="home-subtitle">Prenota la tua lezione</p>
          </div>
          {currentStudent === null ? (
            <div className="home-header-auth">
              <Link to="/accedi" className="home-auth-link">Accedi</Link>
              <Link to="/registrati" className="home-auth-link home-auth-link--primary">Registrati</Link>
            </div>
          ) : (
            <div className="home-header-auth">
              <div className="home-credits-badge">
                <span className="home-credits-icon">◉</span>
                <span className="home-credits-count">{currentStudent.lessonCredits}</span>
                <span className="home-credits-label">lezioni rimanenti nel pacchetto</span>
              </div>
              <span className="home-student-name">Ciao, {currentStudent.firstName}</span>
              <button className="home-auth-link" onClick={studentLogout}>Esci</button>
            </div>
          )}
        </header>
        {currentStudent !== null && (
          <div className="home-credits-bar">
            <span className="home-credits-bar__icon">◉</span>
            <span className="home-credits-bar__count">{currentStudent.lessonCredits}</span>
            <span className="home-credits-bar__label">lezioni rimanenti nel pacchetto</span>
          </div>
        )}
      </div>

      <main className="home-main">
        {loading ? (
          <div className="home-loading">Caricamento lezioni...</div>
        ) : (
          <>
            {(myBookings.length > 0 || myEventBookings.length > 0) && (
              <div className="my-bookings">
                <h2 className="my-bookings__title">Le tue prenotazioni</h2>
                <div className="my-bookings__list">
                  {myBookings.map(({ slot, booking, cancelable }) => {
                    const isExpanded = expandedBooking === booking.id
                    const isConfirming = cancelConfirm === booking.id
                    const isCancelling = cancelling === booking.id
                    return (
                      <div
                        key={booking.id}
                        className={`my-booking-card ${isExpanded ? 'my-booking-card--open' : ''}`}
                      >
                        <button
                          className="my-booking-card__header"
                          onClick={() => {
                            setExpandedBooking(isExpanded ? null : booking.id)
                            setCancelConfirm(null)
                          }}
                        >
                          <div className="my-booking-card__info">
                            {slot.type && <span className="my-booking-type">{slot.type}</span>}
                            <span className="my-booking-title">{slot.title}</span>
                            <span className="my-booking-meta">{formatDateLong(slot.date)} · {slot.time}</span>
                          </div>
                          <span className={`my-booking-chevron ${isExpanded ? 'my-booking-chevron--open' : ''}`}>›</span>
                        </button>

                        {isExpanded && (
                          <div className="my-booking-card__detail">
                            <p className="my-booking-duration">{slot.duration} minuti</p>
                            {slot.notes && <p className="my-booking-notes">{slot.notes}</p>}

                            {cancelable ? (
                              <div className="my-booking-cancel-wrap">
                                {!isConfirming ? (
                                  <button
                                    className="btn-disdici"
                                    onClick={() => setCancelConfirm(booking.id)}
                                    disabled={isCancelling}
                                  >
                                    Disdici prenotazione
                                  </button>
                                ) : (
                                  <div className="my-booking-confirm-row">
                                    <span className="my-booking-confirm-label">Sei sicuro? Il credito ti verrà restituito.</span>
                                    <div className="my-booking-confirm-btns">
                                      <button
                                        className="btn-disdici-confirm"
                                        disabled={isCancelling}
                                        onClick={() => {
                                          void handleCancel(slot.id, booking.id, slot.title, slot.date, slot.time, slot.duration)
                                        }}
                                      >
                                        {isCancelling ? 'Annullamento…' : 'Conferma disdetta'}
                                      </button>
                                      <button
                                        className="btn-disdici-annulla"
                                        onClick={() => setCancelConfirm(null)}
                                        disabled={isCancelling}
                                      >
                                        No, torna indietro
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="my-booking-expired">
                                La cancellazione non è più disponibile (scaduta alle 10:00 del giorno della lezione).
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {myEventBookings.map(({ event, booking, cancelable }) => {
                    const key = `ev:${booking.id}`
                    const isExpanded = expandedBooking === key
                    const isConfirming = cancelConfirm === key
                    const isCancelling = cancelling === key
                    return (
                      <div key={key} className={`my-booking-card ${isExpanded ? 'my-booking-card--open' : ''}`}>
                        <button
                          className="my-booking-card__header"
                          onClick={() => { setExpandedBooking(isExpanded ? null : key); setCancelConfirm(null) }}
                        >
                          <div className="my-booking-card__info">
                            <span className="my-booking-type">Evento</span>
                            <span className="my-booking-title">{event.title}</span>
                            <span className="my-booking-meta">{formatDateLong(event.date)} · {event.time}</span>
                          </div>
                          <span className={`my-booking-chevron ${isExpanded ? 'my-booking-chevron--open' : ''}`}>›</span>
                        </button>
                        {isExpanded && (
                          <div className="my-booking-card__detail">
                            {event.location && <p className="my-booking-duration">📍 {event.location}</p>}
                            {event.price && <p className="my-booking-notes" style={{ color: '#c17f3b' }}>{event.price} · Il pagamento avviene direttamente con l&apos;insegnante.</p>}
                            {event.notes && <p className="my-booking-notes">{event.notes}</p>}
                            {cancelable ? (
                              <div className="my-booking-cancel-wrap">
                                {!isConfirming ? (
                                  <button className="btn-disdici" onClick={() => setCancelConfirm(key)} disabled={isCancelling}>
                                    Disdici iscrizione
                                  </button>
                                ) : (
                                  <div className="my-booking-confirm-row">
                                    <span className="my-booking-confirm-label">Sei sicuro di voler disdire l&apos;iscrizione?</span>
                                    <div className="my-booking-confirm-btns">
                                      <button
                                        className="btn-disdici-confirm"
                                        disabled={isCancelling}
                                        onClick={() => { void handleEventCancel(event.id, booking.id, event.title, event.date, event.time) }}
                                      >
                                        {isCancelling ? 'Annullamento…' : 'Conferma disdetta'}
                                      </button>
                                      <button className="btn-disdici-annulla" onClick={() => setCancelConfirm(null)} disabled={isCancelling}>
                                        No, torna indietro
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="my-booking-expired">
                                La cancellazione non è più disponibile (scaduta alle 10:00 del giorno dell&apos;evento).
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {types.length > 0 && (
              <div className="home-filters">
                <button
                  className={`pill${activeType === 'Tutte' ? ' pill--active' : ''}`}
                  onClick={() => setActiveType('Tutte')}
                >
                  Tutte
                </button>
                {types.map(type => (
                  <button
                    key={type}
                    className={`pill${activeType === type ? ' pill--active' : ''}`}
                    onClick={() => setActiveType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="home-empty">
                <p>Nessuna lezione disponibile al momento. Torna presto!</p>
              </div>
            ) : (
              <div className="home-grid">
                {filtered.map(slot => {
                  const spotsLeft = slot.maxParticipants - slot.bookings.length
                  const isFull = spotsLeft === 0

                  let bookBtn: React.ReactNode
                  if (isFull) {
                    bookBtn = (
                      <button
                        className="btn-waitlist slot-card__btn"
                        onClick={() => navigate(`/book/${slot.id}`)}
                      >
                        Lista d&apos;attesa
                      </button>
                    )
                  } else if (currentStudent === null) {
                    bookBtn = (
                      <button
                        className="btn-primary slot-card__btn"
                        onClick={() => navigate('/accedi')}
                      >
                        Prenota
                      </button>
                    )
                  } else if (currentStudent.lessonCredits === 0) {
                    bookBtn = (
                      <button className="btn-no-credits slot-card__btn" disabled>
                        Nessun credito
                      </button>
                    )
                  } else {
                    bookBtn = (
                      <button
                        className="btn-primary slot-card__btn"
                        onClick={() => navigate(`/book/${slot.id}`)}
                      >
                        Prenota
                      </button>
                    )
                  }

                  return (
                    <div key={slot.id} className="slot-card">
                      {slot.imageUrl && <img src={slot.imageUrl} className="card-cover-img" alt={slot.title} />}
                      <div className="slot-card__badges">
                        {slot.type && (
                          <span className="badge badge--type">{slot.type}</span>
                        )}
                        <span className="badge badge--spots">
                          <SpotsDisplay spotsLeft={spotsLeft} maxParticipants={slot.maxParticipants} />
                        </span>
                      </div>
                      <h2 className="slot-card__title">{slot.title}</h2>
                      <p className="slot-card__date">{formatDateLong(slot.date)}</p>
                      <p className="slot-card__time">{slot.time} · {slot.duration} min</p>
                      {slot.notes && (
                        <p className="slot-card__notes">{slot.notes}</p>
                      )}
                      {bookBtn}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {gamification && (
        <section className="home-gamification">
          <div className="gamification-inner">
            <div className="gamification-stat">
              <span className="gamification-number">{gamification.lessonsCompleted}</span>
              <span className="gamification-label">lezioni completate</span>
            </div>
            <div className="gamification-divider" />
            <div className="gamification-stat">
              <span className="gamification-number">{gamification.daysPracticing}</span>
              <span className="gamification-label">giorni che pratichi con Laura</span>
            </div>
          </div>
        </section>
      )}

      {upcomingEvents.length > 0 && (
        <section className="home-events">
          <div className="home-events-inner">
            <h2 className="home-events-title">Eventi in programma</h2>
            <div className="events-grid">
              {upcomingEvents.map(ev => {
                const spotsLeft = ev.maxParticipants - ev.bookings.length
                const isFull = spotsLeft === 0
                const alreadyBooked = currentStudent !== null && ev.bookings.some(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())
                const alreadyWaitlisted = currentStudent !== null && ev.waitlist.some(w => w.email.toLowerCase() === currentStudent.email.toLowerCase())

                let eventBtn: React.ReactNode
                if (alreadyBooked) {
                  eventBtn = <button className="btn-primary slot-card__btn" disabled style={{ opacity: 0.6 }}>Già iscritto ✓</button>
                } else if (alreadyWaitlisted) {
                  eventBtn = <button className="btn-waitlist slot-card__btn" disabled style={{ opacity: 0.6 }}>In lista d&apos;attesa</button>
                } else if (isFull) {
                  eventBtn = <button className="btn-waitlist slot-card__btn" onClick={() => navigate(`/eventi/${ev.id}`)}>Lista d&apos;attesa</button>
                } else if (currentStudent === null) {
                  eventBtn = <button className="btn-primary slot-card__btn" onClick={() => navigate('/accedi')}>Prenota</button>
                } else {
                  eventBtn = <button className="btn-primary slot-card__btn" onClick={() => navigate(`/eventi/${ev.id}`)}>Prenota</button>
                }

                return (
                  <div key={ev.id} className="event-public-card">
                    {ev.imageUrl && <img src={ev.imageUrl} className="card-cover-img" alt={ev.title} />}
                    <div className="slot-card__badges">
                      <span className="badge badge--type">Evento</span>
                      {ev.price && <span className="badge badge--type" style={{ color: '#c17f3b', borderColor: '#c17f3b' }}>{ev.price}</span>}
                      <span className="badge badge--spots">
                        <SpotsDisplay spotsLeft={spotsLeft} maxParticipants={ev.maxParticipants} />
                      </span>
                    </div>
                    <h3 className="event-public-title">{ev.title}</h3>
                    <p className="event-public-date">{formatEventDate(ev.date)} · {ev.time}</p>
                    {ev.location && <p className="event-public-location">📍 {ev.location}</p>}
                    {ev.description && <p className="event-public-desc">{ev.description}</p>}
                    {ev.notes && <p className="event-public-notes">{ev.notes}</p>}
                    {eventBtn}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <footer className="home-footer">
        <p>Sei l&apos;insegnante? <Link to="/admin/login">Accedi</Link></p>
      </footer>
    </div>
  )
}
