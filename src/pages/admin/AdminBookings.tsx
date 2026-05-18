import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import './AdminBookings.css'

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatBookingDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type Filter = 'upcoming' | 'past' | 'all'
type Tab = 'lessons' | 'events'

export default function AdminBookings() {
  const { slots, deleteBooking, waitlist, removeFromWaitlist, events, deleteEventBooking, removeFromEventWaitlist } = useApp()
  const [tab, setTab] = useState<Tab>('lessons')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('upcoming')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function isUpcoming(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d) >= today
  }

  const filteredSlots = useMemo(() => {
    return [...slots]
      .filter(s => {
        if (filter === 'upcoming') return isUpcoming(s.date)
        if (filter === 'past') return !isUpcoming(s.date)
        return true
      })
      .sort((a, b) => {
        if (filter === 'past') return b.date.localeCompare(a.date) || b.time.localeCompare(a.time)
        return a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
      })
  }, [slots, filter])

  const filteredEvents = useMemo(() => {
    return [...events]
      .filter(ev => {
        if (filter === 'upcoming') return isUpcoming(ev.date)
        if (filter === 'past') return !isUpcoming(ev.date)
        return true
      })
      .sort((a, b) => {
        if (filter === 'past') return b.date.localeCompare(a.date) || b.time.localeCompare(a.time)
        return a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
      })
  }, [events, filter])

  const totalLessonBookings = slots.reduce((s, sl) => s + sl.bookings.length, 0)
  const upcomingLessonBookings = slots.filter(s => isUpcoming(s.date)).reduce((s, sl) => s + sl.bookings.length, 0)
  const totalEventBookings = events.reduce((s, ev) => s + ev.bookings.length, 0)
  const upcomingEventBookings = events.filter(ev => isUpcoming(ev.date)).reduce((s, ev) => s + ev.bookings.length, 0)

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleDeleteLesson(slotId: string, bookingId: string) {
    const key = `${slotId}:${bookingId}`
    if (deleteConfirm === key) { await deleteBooking(slotId, bookingId); setDeleteConfirm(null) }
    else setDeleteConfirm(key)
  }

  async function handleDeleteEvent(eventId: string, bookingId: string) {
    const key = `ev:${eventId}:${bookingId}`
    if (deleteConfirm === key) { await deleteEventBooking(eventId, bookingId); setDeleteConfirm(null) }
    else setDeleteConfirm(key)
  }

  function renderAccordion(
    id: string,
    title: string,
    date: string,
    time: string,
    extra: string,
    bookingsCount: number,
    maxParticipants: number,
    isPast: boolean,
    isFull: boolean,
    waitlistCount: number,
    badgeType?: string,
    children: React.ReactNode = null,
  ) {
    const isOpen = expanded.has(id)
    const fillPct = maxParticipants > 0 ? Math.round((bookingsCount / maxParticipants) * 100) : 0
    return (
      <div key={id} className={`bookings-slot ${isPast ? 'bookings-slot--past' : ''}`}>
        <button className="bookings-slot-header" onClick={() => toggleExpand(id)}>
          <div className="bookings-slot-info">
            <div className="bookings-slot-top">
              {badgeType && <span className="bookings-badge-type">{badgeType}</span>}
              {isPast && <span className="bookings-badge-past">Passata</span>}
              {isFull && !isPast && <span className="bookings-badge-full">Al completo</span>}
            </div>
            <span className="bookings-slot-title">{title}</span>
            <span className="bookings-slot-meta">{formatDate(date)} · {time}{extra ? ` · ${extra}` : ''}</span>
          </div>
          <div className="bookings-slot-right">
            <div className="bookings-count-wrap">
              <span className="bookings-count">{bookingsCount} / {maxParticipants}</span>
              <div className="bookings-bar">
                <div className="bookings-bar-fill"
                  style={{ width: `${fillPct}%`, background: isFull ? '#8b4a48' : 'var(--color-green)' }} />
              </div>
            </div>
            {waitlistCount > 0 && <span className="bookings-waitlist-badge">+{waitlistCount} in attesa</span>}
            <span className={`bookings-chevron ${isOpen ? 'bookings-chevron--open' : ''}`}>›</span>
          </div>
        </button>
        {isOpen && <div className="bookings-detail">{children}</div>}
      </div>
    )
  }

  function renderTable(
    rows: { id: string; firstName: string; lastName: string; email: string; phone: string; createdAt: string }[],
    label: string,
    onDelete: (id: string) => void,
    keyPrefix: string,
  ) {
    if (rows.length === 0) return <p className="bookings-no-entries">Nessuna prenotazione.</p>
    return (
      <>
        <p className="bookings-section-label">{label} ({rows.length})</p>
        <table className="bookings-table">
          <thead><tr>
            <th>Nome</th><th>Email</th>
            <th className="col-phone">Telefono</th>
            <th className="col-date">Prenotato il</th>
            <th></th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const key = `${keyPrefix}:${r.id}`
              return (
                <tr key={r.id}>
                  <td className="bk-name">{r.firstName} {r.lastName}</td>
                  <td className="bk-meta">{r.email}</td>
                  <td className="bk-meta col-phone">{r.phone}</td>
                  <td className="bk-meta col-date">{formatBookingDate(r.createdAt)}</td>
                  <td className="bk-actions">
                    {deleteConfirm === key ? (
                      <>
                        <button className="btn-confirm-delete-sm" onClick={() => onDelete(r.id)}>Conferma</button>
                        <button className="btn-cancel-xs" onClick={() => setDeleteConfirm(null)}>No</button>
                      </>
                    ) : (
                      <button className="btn-danger" onClick={() => setDeleteConfirm(key)}>Rimuovi</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </>
    )
  }

  return (
    <div className="bookings-page">
      <div className="bookings-header">
        <div>
          <h1 className="bookings-title">Gestione prenotazioni</h1>
          <p className="bookings-subtitle">
            {tab === 'lessons'
              ? `${upcomingLessonBookings} prenotazioni per le prossime lezioni · ${totalLessonBookings} totali`
              : `${upcomingEventBookings} iscrizioni per i prossimi eventi · ${totalEventBookings} totali`}
          </p>
        </div>
        <div className="bookings-filters">
          {(['upcoming', 'past', 'all'] as Filter[]).map(f => (
            <button key={f}
              className={`bookings-filter-btn ${filter === f ? 'bookings-filter-btn--active' : ''}`}
              onClick={() => setFilter(f)}>
              {f === 'upcoming' ? 'Prossime' : f === 'past' ? 'Passate' : 'Tutte'}
            </button>
          ))}
        </div>
      </div>

      <div className="bookings-tabs">
        <button className={`bookings-tab ${tab === 'lessons' ? 'bookings-tab--active' : ''}`}
          onClick={() => { setTab('lessons'); setExpanded(new Set()); setDeleteConfirm(null) }}>
          Lezioni
        </button>
        <button className={`bookings-tab ${tab === 'events' ? 'bookings-tab--active' : ''}`}
          onClick={() => { setTab('events'); setExpanded(new Set()); setDeleteConfirm(null) }}>
          Eventi
        </button>
      </div>

      {tab === 'lessons' && (
        filteredSlots.length === 0 ? (
          <div className="bookings-empty-state">
            <p className="bookings-empty-title">{filter === 'upcoming' ? 'Nessuna lezione in programma' : 'Nessuna lezione trovata'}</p>
          </div>
        ) : (
          <div className="bookings-list">
            {filteredSlots.map(slot => {
              const [y, m, d] = slot.date.split('-').map(Number)
              const isPast = new Date(y, m - 1, d) < today
              const isFull = slot.bookings.length >= slot.maxParticipants
              const slotWaitlist = waitlist.filter(w => w.slotId === slot.id)
              return renderAccordion(
                slot.id, slot.title, slot.date, slot.time, `${slot.duration} min`,
                slot.bookings.length, slot.maxParticipants, isPast, isFull, slotWaitlist.length, slot.type || undefined,
                <>
                  {renderTable(slot.bookings, 'Prenotazioni', id => { void handleDeleteLesson(slot.id, id) }, slot.id)}
                  {slotWaitlist.length > 0 && (
                    <div className="bookings-waitlist-section">
                      <p className="bookings-section-label bookings-section-label--waitlist">Lista d&apos;attesa ({slotWaitlist.length})</p>
                      <table className="bookings-table">
                        <thead><tr><th>Nome</th><th>Email</th><th className="col-phone">Telefono</th><th className="col-date">Iscritto il</th><th></th></tr></thead>
                        <tbody>
                          {slotWaitlist.map(entry => (
                            <tr key={entry.id}>
                              <td className="bk-name">{entry.firstName} {entry.lastName}</td>
                              <td className="bk-meta">{entry.email}</td>
                              <td className="bk-meta col-phone">{entry.phone}</td>
                              <td className="bk-meta col-date">{formatBookingDate(entry.createdAt)}</td>
                              <td className="bk-actions">
                                <button className="btn-danger" onClick={() => { void removeFromWaitlist(slot.id, entry.id) }}>Rimuovi</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )
            })}
          </div>
        )
      )}

      {tab === 'events' && (
        filteredEvents.length === 0 ? (
          <div className="bookings-empty-state">
            <p className="bookings-empty-title">{filter === 'upcoming' ? 'Nessun evento in programma' : 'Nessun evento trovato'}</p>
          </div>
        ) : (
          <div className="bookings-list">
            {filteredEvents.map(ev => {
              const [y, m, d] = ev.date.split('-').map(Number)
              const isPast = new Date(y, m - 1, d) < today
              const isFull = ev.bookings.length >= ev.maxParticipants
              return renderAccordion(
                ev.id, ev.title, ev.date, ev.time, ev.location || '',
                ev.bookings.length, ev.maxParticipants, isPast, isFull, ev.waitlist.length, undefined,
                <>
                  {renderTable(ev.bookings, 'Iscrizioni', id => { void handleDeleteEvent(ev.id, id) }, `ev:${ev.id}`)}
                  {ev.waitlist.length > 0 && (
                    <div className="bookings-waitlist-section">
                      <p className="bookings-section-label bookings-section-label--waitlist">Lista d&apos;attesa ({ev.waitlist.length})</p>
                      <table className="bookings-table">
                        <thead><tr><th>Nome</th><th>Email</th><th className="col-phone">Telefono</th><th className="col-date">Iscritto il</th><th></th></tr></thead>
                        <tbody>
                          {ev.waitlist.map(entry => (
                            <tr key={entry.id}>
                              <td className="bk-name">{entry.firstName} {entry.lastName}</td>
                              <td className="bk-meta">{entry.email}</td>
                              <td className="bk-meta col-phone">{entry.phone}</td>
                              <td className="bk-meta col-date">{formatBookingDate(entry.createdAt)}</td>
                              <td className="bk-actions">
                                <button className="btn-danger" onClick={() => { void removeFromEventWaitlist(ev.id, entry.id) }}>Rimuovi</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
