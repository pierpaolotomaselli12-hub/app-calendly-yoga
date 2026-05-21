import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import logoFull from '../../assets/logo-full.png'
import './Home.css'

// ── Calendar helpers ─────────────────────────────────────────

const DAY_ABBRS = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM']

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} — ${end.getDate()} ${cap(end.toLocaleDateString('it-IT', { month: 'long' }))}`
  }
  return `${start.getDate()} ${cap(start.toLocaleDateString('it-IT', { month: 'short' }))} — ${end.getDate()} ${cap(end.toLocaleDateString('it-IT', { month: 'long' }))}`
}

// ── Date format helpers ──────────────────────────────────────

function isCancelable(dateStr: string, timeStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const deadline = new Date(y, m - 1, d, 10, 0, 0)
  void timeStr
  return new Date() < deadline
}

function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return cap(new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short',
  }))
}

function formatEventDateSide(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ── Gamification ─────────────────────────────────────────────

const YOGA_QUOTES = [
  { text: 'Lo yoga è il viaggio del sé, attraverso il sé, al sé.', author: 'Bhagavad Gītā' },
  { text: 'Il corpo è il tuo tempio. Mantienilo puro e pulito per l\'anima che vi risiede.', author: 'B.K.S. Iyengar' },
  { text: 'La pace viene dall\'interno. Non cercarla fuori.', author: 'Buddha' },
  { text: 'Respira. Lascia andare. Ricorda che questo momento è l\'unico che hai con certezza.', author: '' },
  { text: 'Non importa quanto velocemente vai, fintanto che non ti fermi.', author: 'Confucio' },
  { text: 'Nel silenzio si ritrova la propria natura più profonda.', author: 'Patañjali' },
  { text: 'Ogni respiro è un nuovo inizio.', author: '' },
]

function CreditRing({ credits, total }: { credits: number; total: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? Math.min(credits / total, 1) : 0
  const dash = circ * pct
  return (
    <div className="gami-ring">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke="var(--color-green)"
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="gami-ring-center">
        <span className="gami-ring-num">{credits}</span>
        <span className="gami-ring-sub">di {total}</span>
      </div>
    </div>
  )
}

function getSpotsColor(spotsLeft: number, maxParticipants: number): string {
  if (spotsLeft === 0) return '#999'
  const pct = spotsLeft / maxParticipants
  if (pct > 0.5) return '#818569'
  if (pct > 0.2) return '#c17f3b'
  return '#8b4a48'
}

// ── Component ─────────────────────────────────────────────────

export default function Home() {
  const { slots, events, loading, currentStudent, studentLogout, deleteBooking, deleteEventBooking, incrementStudentCredits, students } = useApp()
  const navigate = useNavigate()

  const [activeType, setActiveType] = useState<string>('Tutte')
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [showAllSlots, setShowAllSlots] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = toISO(today)

  const upcomingSlots = useMemo(() => {
    return slots
      .filter(slot => {
        const [y, m, d] = slot.date.split('-').map(Number)
        return new Date(y, m - 1, d) >= today
      })
      .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time))
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
        return new Date(y, m - 1, d) >= today && s.bookings.some(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())
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

  const gamification = useMemo(() => {
    if (!currentStudent) return null
    const completedSlots = slots.filter(s => {
      const [y, m, d] = s.date.split('-').map(Number)
      return new Date(y, m - 1, d) < today && s.bookings.some(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())
    })
    if (completedSlots.length === 0) return null
    const earliest = completedSlots.reduce((min, s) => s.date < min ? s.date : min, completedSlots[0].date)
    const [ey, em, ed] = earliest.split('-').map(Number)
    const firstDate = new Date(ey, em - 1, ed)
    const daysPracticing = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    return { lessonsCompleted: completedSlots.length, daysPracticing }
  }, [slots, currentStudent])

  // ── Week calendar ────────────────────────────────────────────

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekNumber = useMemo(() => getWeekNumber(weekStart), [weekStart])
  const weekRangeLabel = useMemo(() => formatWeekRange(weekStart), [weekStart])

  const slotsInWeek = useMemo(() => {
    const map: Record<string, typeof slots> = {}
    weekDays.forEach(day => {
      const ds = toISO(day)
      map[ds] = slots.filter(s => s.date === ds).sort((a, b) => a.time.localeCompare(b.time))
    })
    return map
  }, [slots, weekDays])

  // ── Next practice ─────────────────────────────────────────────

  const nextPractice = useMemo(() => {
    if (currentStudent && myBookings.length > 0) return myBookings[0].slot
    return upcomingSlots[0] ?? null
  }, [currentStudent, myBookings, upcomingSlots])

  const nextPracticeBooking = useMemo(() => {
    if (!currentStudent || !nextPractice) return null
    return nextPractice.bookings.find(b => b.email.toLowerCase() === currentStudent.email.toLowerCase()) ?? null
  }, [currentStudent, nextPractice])

  // ── Handlers ──────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="home">

      {/* ── Sticky header ── */}
      <div className="home-sticky-top">
        <header className="home-header">
          <div className="home-header-left">
            <img src={logoFull} alt="Laura Pagnossin" className="home-logo-img" />
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
                <span className="home-credits-label">lezioni rimanenti</span>
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

            {/* ── Gamification card ── */}
            {gamification && currentStudent && (() => {
              const totalCredits = currentStudent.lessonCredits + gamification.lessonsCompleted
              const todayQuote = YOGA_QUOTES[new Date().getDay() % YOGA_QUOTES.length]
              return (
                <section className="home-gamification">
                  <div className="gamification-card">
                    <div className="gami-col gami-col--credits">
                      <span className="gami-eyebrow">Pacchetto</span>
                      <div className="gami-credits-body">
                        <CreditRing credits={currentStudent.lessonCredits} total={totalCredits} />
                        <div>
                          <p className="gami-main-text">
                            {currentStudent.lessonCredits} {currentStudent.lessonCredits === 1 ? 'lezione rimanente' : 'lezioni rimanenti'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="gami-sep" />
                    <div className="gami-col gami-col--quote">
                      <span className="gami-eyebrow">Intenzione di oggi</span>
                      <blockquote className="gami-quote">
                        <p>"{todayQuote.text}"</p>
                        {todayQuote.author && <footer>— {todayQuote.author}</footer>}
                      </blockquote>
                    </div>
                    <div className="gami-sep" />
                    <div className="gami-col gami-col--streak">
                      <span className="gami-eyebrow">Continua</span>
                      <div className="gami-streak-body">
                        <span className="gami-streak-icon">🔥</span>
                        <div>
                          <p className="gami-streak-num">
                            {gamification.daysPracticing} <span className="gami-streak-unit">giorni</span>
                          </p>
                          <p className="gami-streak-sub">
                            con Laura · {gamification.lessonsCompleted} {gamification.lessonsCompleted === 1 ? 'completata' : 'completate'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )
            })()}

            {/* ── Weekly calendar ── */}
            <section className="cal-section">
              <div className="cal-header">
                <div className="cal-header-left">
                  <span className="cal-week-eyebrow">Settimana {weekNumber}</span>
                  <h2 className="cal-week-range">{weekRangeLabel}</h2>
                </div>
                <div className="cal-nav">
                  <button className="cal-nav-btn" onClick={() => setWeekStart(w => addDays(w, -7))}>‹ Prec.</button>
                  <button className="cal-nav-btn cal-nav-btn--today" onClick={() => setWeekStart(getMonday(new Date()))}>Oggi</button>
                  <button className="cal-nav-btn" onClick={() => setWeekStart(w => addDays(w, 7))}>Succ. ›</button>
                </div>
              </div>

              <div className="cal-grid-wrap">
                <div className="cal-grid">
                  {weekDays.map((day, i) => {
                    const ds = toISO(day)
                    const isToday = ds === todayISO
                    const isPast = ds < todayISO
                    const daySlots = slotsInWeek[ds] || []
                    return (
                      <div key={ds} className={`cal-day${isToday ? ' cal-day--today' : ''}${isPast ? ' cal-day--past' : ''}`}>
                        <div className="cal-day-head">
                          <span className="cal-day-abbr">{DAY_ABBRS[i]}</span>
                          <span className="cal-day-num">{day.getDate()}</span>
                        </div>
                        <div className="cal-day-body">
                          {daySlots.length === 0 ? (
                            <span className="cal-riposo">riposo</span>
                          ) : (
                            daySlots.map(slot => {
                              const isBooked = currentStudent != null && slot.bookings.some(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())
                              const isNext = nextPractice != null && slot.id === nextPractice.id && !isBooked
                              const isFull = slot.maxParticipants - slot.bookings.length === 0
                              let mod = ' cal-slot--available'
                              if (isBooked) mod = ' cal-slot--booked'
                              else if (isNext) mod = ' cal-slot--next'
                              else if (isFull) mod = ' cal-slot--full'
                              return (
                                <button
                                  key={slot.id}
                                  className={`cal-slot${mod}${isPast ? ' cal-slot--past' : ''}`}
                                  onClick={() => navigate(`/book/${slot.id}`)}
                                >
                                  <span className="cal-slot-time">{slot.time}</span>
                                  <span className="cal-slot-title">{slot.title}</span>
                                  {slot.type && <span className="cal-slot-type">{slot.type}</span>}
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="cal-legend">
                <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-dot--next" /> prossima</span>
                <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-dot--booked" /> prenotata</span>
                <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-dot--available" /> disponibile</span>
              </div>
            </section>

            {/* ── Prossima pratica + eventi ── */}
            {(nextPractice != null || upcomingEvents.length > 0) && (
              <div className="home-bottom">

                {nextPractice != null && (
                  <section className="pratica-section">
                    <h2 className="home-section-title">La tua prossima pratica</h2>
                    <div className="pratica-card">
                      <div className="pratica-card__content">
                        <div className="pratica-tags">
                          {nextPractice.type && (
                            <span className="pratica-tag pratica-tag--type">{nextPractice.type}</span>
                          )}
                          {nextPracticeBooking && (
                            <span className="pratica-tag pratica-tag--booked">Prenotata</span>
                          )}
                        </div>
                        <h3 className="pratica-title">{nextPractice.title}</h3>
                        {nextPractice.notes && <p className="pratica-desc">{nextPractice.notes}</p>}
                        <div className="pratica-meta">
                          <span className="pratica-meta-item">
                            <svg className="pratica-meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="1" y="2" width="14" height="13" rx="2" /><path d="M5 1v2M11 1v2M1 6h14" />
                            </svg>
                            {formatDateShort(nextPractice.date)}
                          </span>
                          <span className="pratica-meta-item">
                            <svg className="pratica-meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="8" cy="8" r="7" /><path d="M8 4v4l3 2" />
                            </svg>
                            {nextPractice.time} · {nextPractice.duration} min
                          </span>
                          <span className="pratica-meta-item">
                            <svg className="pratica-meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M8 1C5.24 1 3 3.24 3 6c0 4 5 9 5 9s5-5 5-9c0-2.76-2.24-5-5-5z" /><circle cx="8" cy="6" r="1.5" />
                            </svg>
                            {nextPractice.maxParticipants - nextPractice.bookings.length}/{nextPractice.maxParticipants} posti
                          </span>
                        </div>
                        <div className="pratica-actions">
                          {nextPracticeBooking ? (
                            <>
                              <button className="btn-primary pratica-btn-main" disabled>Già prenotata ✓</button>
                              {isCancelable(nextPractice.date, nextPractice.time) && (
                                <button
                                  className="pratica-btn-secondary"
                                  onClick={() => {
                                    setExpandedBooking(nextPracticeBooking.id)
                                    setTimeout(() => document.querySelector('.my-bookings')?.scrollIntoView({ behavior: 'smooth' }), 100)
                                  }}
                                >
                                  Disdici
                                </button>
                              )}
                            </>
                          ) : currentStudent === null ? (
                            <button className="btn-primary pratica-btn-main" onClick={() => navigate('/accedi')}>
                              Accedi per prenotare
                            </button>
                          ) : currentStudent.lessonCredits === 0 ? (
                            <button className="btn-primary pratica-btn-main" disabled>Nessun credito</button>
                          ) : (
                            <button className="btn-primary pratica-btn-main" onClick={() => navigate(`/book/${nextPractice.id}`)}>
                              Prenota lezione
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="pratica-card__image">
                        {nextPractice.imageUrl ? (
                          <img src={nextPractice.imageUrl} alt={nextPractice.title} />
                        ) : (
                          <div className="pratica-img-placeholder">
                            <span>{nextPractice.type ? nextPractice.type.toUpperCase() : 'YOGA'} · PRATICA</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {upcomingEvents.length > 0 && (
                  <section className="events-side">
                    <div className="events-side__header">
                      <h2 className="home-section-title">Eventi &amp; ritiri</h2>
                    </div>
                    <div className="events-side__list">
                      {upcomingEvents.map(ev => {
                        const spotsLeft = ev.maxParticipants - ev.bookings.length
                        const isFull = spotsLeft === 0
                        const alreadyBooked = currentStudent != null && ev.bookings.some(b => b.email.toLowerCase() === currentStudent.email.toLowerCase())
                        const alreadyWaitlisted = currentStudent != null && ev.waitlist.some(w => w.email.toLowerCase() === currentStudent.email.toLowerCase())
                        return (
                          <div key={ev.id} className="event-side-card">
                            <div className="event-side-card__img">
                              {ev.imageUrl
                                ? <img src={ev.imageUrl} alt={ev.title} />
                                : <div className="event-side-img-placeholder" />
                              }
                            </div>
                            <div className="event-side-card__body">
                              <span className="event-side-title">{ev.title}</span>
                              <span className="event-side-date">{formatEventDateSide(ev.date)} · {ev.time}</span>
                              {ev.location && <span className="event-side-loc">{ev.location}</span>}
                            </div>
                            <div className="event-side-card__action">
                              {ev.price && <span className="event-side-price">{ev.price}</span>}
                              {alreadyBooked ? (
                                <button className="btn-primary event-side-btn" disabled>Iscritto ✓</button>
                              ) : alreadyWaitlisted ? (
                                <button className="btn-waitlist event-side-btn" disabled>In attesa</button>
                              ) : isFull ? (
                                <button className="btn-waitlist event-side-btn" onClick={() => navigate(`/eventi/${ev.id}`)}>Attesa</button>
                              ) : currentStudent === null ? (
                                <button className="btn-primary event-side-btn" onClick={() => navigate('/accedi')}>Prenota</button>
                              ) : (
                                <button className="btn-primary event-side-btn" onClick={() => navigate(`/eventi/${ev.id}`)}>Prenota</button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ── Le mie prenotazioni ── */}
            {(myBookings.length > 0 || myEventBookings.length > 0) && (
              <div className="my-bookings">
                <h2 className="my-bookings__title">Le tue prenotazioni</h2>
                <div className="my-bookings__list">
                  {myBookings.map(({ slot, booking, cancelable }) => {
                    const isExpanded = expandedBooking === booking.id
                    const isConfirming = cancelConfirm === booking.id
                    const isCancelling = cancelling === booking.id
                    return (
                      <div key={booking.id} className={`my-booking-card${isExpanded ? ' my-booking-card--open' : ''}`}>
                        <button
                          className="my-booking-card__header"
                          onClick={() => { setExpandedBooking(isExpanded ? null : booking.id); setCancelConfirm(null) }}
                        >
                          <div className="my-booking-card__info">
                            {slot.type && <span className="my-booking-type">{slot.type}</span>}
                            <span className="my-booking-title">{slot.title}</span>
                            <span className="my-booking-meta">{formatDateLong(slot.date)} · {slot.time}</span>
                          </div>
                          <span className={`my-booking-chevron${isExpanded ? ' my-booking-chevron--open' : ''}`}>›</span>
                        </button>
                        {isExpanded && (
                          <div className="my-booking-card__detail">
                            <p className="my-booking-duration">{slot.duration} minuti</p>
                            {slot.notes && <p className="my-booking-notes">{slot.notes}</p>}
                            {cancelable ? (
                              <div className="my-booking-cancel-wrap">
                                {!isConfirming ? (
                                  <button className="btn-disdici" onClick={() => setCancelConfirm(booking.id)} disabled={isCancelling}>
                                    Disdici prenotazione
                                  </button>
                                ) : (
                                  <div className="my-booking-confirm-row">
                                    <span className="my-booking-confirm-label">Sei sicuro? Il credito ti verrà restituito.</span>
                                    <div className="my-booking-confirm-btns">
                                      <button
                                        className="btn-disdici-confirm"
                                        disabled={isCancelling}
                                        onClick={() => { void handleCancel(slot.id, booking.id, slot.title, slot.date, slot.time, slot.duration) }}
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
                      <div key={key} className={`my-booking-card${isExpanded ? ' my-booking-card--open' : ''}`}>
                        <button
                          className="my-booking-card__header"
                          onClick={() => { setExpandedBooking(isExpanded ? null : key); setCancelConfirm(null) }}
                        >
                          <div className="my-booking-card__info">
                            <span className="my-booking-type">Evento</span>
                            <span className="my-booking-title">{event.title}</span>
                            <span className="my-booking-meta">{formatDateLong(event.date)} · {event.time}</span>
                          </div>
                          <span className={`my-booking-chevron${isExpanded ? ' my-booking-chevron--open' : ''}`}>›</span>
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

            {/* ── Tutte le lezioni (browse) ── */}
            <div className="all-slots-section">
              <button className="all-slots-toggle" onClick={() => setShowAllSlots(v => !v)}>
                <span>Sfoglia tutte le lezioni</span>
                <span className={`all-slots-chevron${showAllSlots ? ' all-slots-chevron--open' : ''}`}>›</span>
              </button>

              {showAllSlots && (
                <>
                  {types.length > 0 && (
                    <div className="home-filters">
                      <button className={`pill${activeType === 'Tutte' ? ' pill--active' : ''}`} onClick={() => setActiveType('Tutte')}>Tutte</button>
                      {types.map(type => (
                        <button key={type} className={`pill${activeType === type ? ' pill--active' : ''}`} onClick={() => setActiveType(type)}>{type}</button>
                      ))}
                    </div>
                  )}

                  {filtered.length === 0 ? (
                    <div className="home-empty"><p>Nessuna lezione disponibile al momento. Torna presto!</p></div>
                  ) : (
                    <div className="home-grid">
                      {filtered.map(slot => {
                        const spotsLeft = slot.maxParticipants - slot.bookings.length
                        const isFull = spotsLeft === 0
                        let bookBtn: React.ReactNode
                        if (isFull) {
                          bookBtn = <button className="btn-waitlist slot-card__btn" onClick={() => navigate(`/book/${slot.id}`)}>Lista d&apos;attesa</button>
                        } else if (currentStudent === null) {
                          bookBtn = <button className="btn-primary slot-card__btn" onClick={() => navigate('/accedi')}>Prenota</button>
                        } else if (currentStudent.lessonCredits === 0) {
                          bookBtn = <button className="btn-no-credits slot-card__btn" disabled>Nessun credito</button>
                        } else {
                          bookBtn = <button className="btn-primary slot-card__btn" onClick={() => navigate(`/book/${slot.id}`)}>Prenota</button>
                        }
                        return (
                          <div key={slot.id} className="slot-card">
                            {slot.imageUrl && <img src={slot.imageUrl} className="card-cover-img" alt={slot.title} />}
                            <div className="slot-card__body">
                              <div className="slot-card__badges">
                                {slot.type && <span className="badge badge--type">{slot.type}</span>}
                                {isFull ? (
                                  <span className="spots-full">Al completo</span>
                                ) : (
                                  <span className="spots-available" style={{ color: getSpotsColor(spotsLeft, slot.maxParticipants) }}>
                                    {spotsLeft} {spotsLeft === 1 ? 'posto' : 'posti'} disponibili
                                  </span>
                                )}
                              </div>
                              <h2 className="slot-card__title">{slot.title}</h2>
                              <p className="slot-card__date">{formatDateLong(slot.date)}</p>
                              <p className="slot-card__time">{slot.time} · {slot.duration} min</p>
                              {slot.notes && <p className="slot-card__notes">{slot.notes}</p>}
                              <div className="slot-card__footer">{bookBtn}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

          </>
        )}
      </main>

      <footer className="home-footer">
        <p>Sei l&apos;insegnante? <Link to="/admin/login">Accedi</Link></p>
      </footer>
    </div>
  )
}
