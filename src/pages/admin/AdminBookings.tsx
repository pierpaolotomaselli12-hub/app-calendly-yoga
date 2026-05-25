import { useState, useMemo, type ReactNode } from 'react'
import { useApp } from '../../context/AppContext'
import './AdminBookings.css'

// ── Date / avatar helpers ──────────────────────────────

const MONTH_SHORT = ['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC']
const DAY_SHORT   = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']

function parseDateParts(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return { dayNum: d, month: MONTH_SHORT[m - 1], dayName: DAY_SHORT[date.getDay()] }
}

const AVATAR_COLORS = ['#818569','#8b4a48','#c17f3b','#5c6148','#9a8878','#6e7258','#b0906e']
function avatarColor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(first: string, last: string) { return `${first[0]??''}${last[0]??''}`.toUpperCase() }

function relativeBookingDate(iso: string): string {
  const then = new Date(iso)
  const todayMid = new Date(); todayMid.setHours(0,0,0,0)
  const thenMid  = new Date(then); thenMid.setHours(0,0,0,0)
  const diffDays = Math.round((todayMid.getTime() - thenMid.getTime()) / 86400000)
  const t = then.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return `oggi · ${t}`
  if (diffDays === 1) return `ieri · ${t}`
  if (diffDays < 7)  return `${diffDays} giorni fa`
  return `${thenMid.getDate()} ${MONTH_SHORT[thenMid.getMonth()]}`
}

function bookingTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function fillBarColor(rate: number) {
  if (rate >= 100) return '#8b4a48'
  if (rate >= 70)  return '#c17f3b'
  return '#818569'
}

// ── Types ──────────────────────────────────────────────

type Filter = 'upcoming' | 'past' | 'all'
type Tab    = 'lessons' | 'events'

interface RecentEntry {
  slotTitle: string; slotDay: string; slotTime: string
  firstName: string; lastName: string; createdAt: string; isWaitlist: boolean
}

// ── SVG icons ──────────────────────────────────────────

function IconMail()  { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M2 4l6 5 6-5"/></svg> }
function IconTrash() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"/></svg> }

// ── Component ──────────────────────────────────────────

export default function AdminBookings() {
  const {
    slots, deleteBooking, waitlist, removeFromWaitlist,
    events, deleteEventBooking, removeFromEventWaitlist,
    students, addBooking, decrementStudentCredits, addEventBooking,
  } = useApp()

  const [tab, setTab]               = useState<Tab>('lessons')
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filter, setFilter]         = useState<Filter>('upcoming')
  const [showFilters, setShowFilters] = useState(false)

  // Add-student state
  const [addingToId, setAddingToId]     = useState<string | null>(null)
  const [addStudentSearch, setAddStudentSearch] = useState('')
  const [addStudentId, setAddStudentId] = useState('')
  const [showAddDropdown, setShowAddDropdown]   = useState(false)
  const [addingStudent, setAddingStudent]       = useState(false)

  // ── Derived ───────────────────────────────────────────

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  function isUpcoming(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d) >= today
  }

  const filteredSlots = useMemo(() =>
    [...slots]
      .filter(s => filter === 'upcoming' ? isUpcoming(s.date) : filter === 'past' ? !isUpcoming(s.date) : true)
      .sort((a, b) => filter === 'past'
        ? b.date.localeCompare(a.date) || b.time.localeCompare(a.time)
        : a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
  [slots, filter, today])

  const filteredEvents = useMemo(() =>
    [...events]
      .filter(ev => filter === 'upcoming' ? isUpcoming(ev.date) : filter === 'past' ? !isUpcoming(ev.date) : true)
      .sort((a, b) => filter === 'past'
        ? b.date.localeCompare(a.date) || b.time.localeCompare(a.time)
        : a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
  [events, filter, today])

  const totalAllBookings = useMemo(() =>
    slots.reduce((s, sl) => s + sl.bookings.length, 0) +
    events.reduce((s, ev) => s + ev.bookings.length, 0),
  [slots, events])

  const totalWaitlistCount = useMemo(() =>
    waitlist.length + events.reduce((s, ev) => s + ev.waitlist.length, 0),
  [waitlist, events])

  const creditsByEmail = useMemo(() => {
    const m = new Map<string, number>()
    students.forEach(s => m.set(s.email.toLowerCase(), s.lessonCredits))
    return m
  }, [students])

  const recentEntries = useMemo((): RecentEntry[] => {
    const all: RecentEntry[] = []
    slots.forEach(s => {
      const dayShort = DAY_SHORT[new Date(s.date + 'T00:00:00').getDay()]
      s.bookings.forEach(b => all.push({ slotTitle: s.title, slotDay: dayShort, slotTime: s.time, firstName: b.firstName, lastName: b.lastName, createdAt: b.createdAt, isWaitlist: false }))
    })
    waitlist.forEach(w => {
      const slot = slots.find(s => s.id === w.slotId); if (!slot) return
      const dayShort = DAY_SHORT[new Date(slot.date + 'T00:00:00').getDay()]
      all.push({ slotTitle: slot.title, slotDay: dayShort, slotTime: slot.time, firstName: w.firstName, lastName: w.lastName, createdAt: w.createdAt, isWaitlist: true })
    })
    events.forEach(ev => {
      const dayShort = DAY_SHORT[new Date(ev.date + 'T00:00:00').getDay()]
      ev.bookings.forEach(b => all.push({ slotTitle: ev.title, slotDay: dayShort, slotTime: ev.time, firstName: b.firstName, lastName: b.lastName, createdAt: b.createdAt, isWaitlist: false }))
      ev.waitlist.forEach(w => all.push({ slotTitle: ev.title, slotDay: dayShort, slotTime: ev.time, firstName: w.firstName, lastName: w.lastName, createdAt: w.createdAt, isWaitlist: true }))
    })
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
  }, [slots, waitlist, events])

  // ── Handlers ──────────────────────────────────────────

  function toggleExpand(id: string) {
    const isOpen = expanded.has(id)
    setExpanded(prev => { const n = new Set(prev); isOpen ? n.delete(id) : n.add(id); return n })
    if (isOpen && addingToId === id) setAddingToId(null)
  }

  function switchTab(t: Tab) { setTab(t); setExpanded(new Set()); setDeleteConfirm(null); setAddingToId(null) }

  async function handleDeleteLesson(slotId: string, bookingId: string) {
    const key = `${slotId}:${bookingId}`
    if (deleteConfirm === key) { await deleteBooking(slotId, bookingId); setDeleteConfirm(null) }
    else setDeleteConfirm(key)
  }

  async function handleDeleteWaitlist(slotId: string, entryId: string) {
    const key = `wl:${slotId}:${entryId}`
    if (deleteConfirm === key) { await removeFromWaitlist(slotId, entryId); setDeleteConfirm(null) }
    else setDeleteConfirm(key)
  }

  async function handleDeleteEvent(eventId: string, bookingId: string) {
    const key = `ev:${eventId}:${bookingId}`
    if (deleteConfirm === key) { await deleteEventBooking(eventId, bookingId); setDeleteConfirm(null) }
    else setDeleteConfirm(key)
  }

  async function handleDeleteEventWaitlist(eventId: string, entryId: string) {
    const key = `ev-wl:${eventId}:${entryId}`
    if (deleteConfirm === key) { await removeFromEventWaitlist(eventId, entryId); setDeleteConfirm(null) }
    else setDeleteConfirm(key)
  }

  async function handleAddStudent(targetId: string, isEvent: boolean) {
    const student = students.find(s => s.id === addStudentId)
    if (!student) return
    setAddingStudent(true)
    if (isEvent) {
      await addEventBooking({ eventId: targetId, firstName: student.firstName, lastName: student.lastName, email: student.email, phone: student.phone })
    } else {
      await addBooking({ slotId: targetId, firstName: student.firstName, lastName: student.lastName, email: student.email, phone: student.phone })
      if (student.lessonCredits > 0) await decrementStudentCredits(student.id)
    }
    setAddStudentId(''); setAddStudentSearch(''); setAddingStudent(false); setAddingToId(null)
  }

  function emailAllStudents(emails: string[], title: string) {
    const subject = encodeURIComponent(`Informazioni: ${title}`)
    const bcc = emails.map(e => encodeURIComponent(e)).join(',')
    window.open(`mailto:?bcc=${bcc}&subject=${subject}`, '_blank')
  }

  function exportCSV() {
    const rows: string[] = []
    if (tab === 'lessons') {
      rows.push(['Lezione','Data','Orario','Nome','Cognome','Email','Telefono','Prenotato il'].join(','))
      filteredSlots.forEach(s => s.bookings.forEach(b =>
        rows.push([s.title, s.date, s.time, b.firstName, b.lastName, b.email, b.phone,
          new Date(b.createdAt).toLocaleDateString('it-IT')].map(v => `"${v}"`).join(','))))
    } else {
      rows.push(['Evento','Data','Orario','Nome','Cognome','Email','Telefono','Prenotato il'].join(','))
      filteredEvents.forEach(ev => ev.bookings.forEach(b =>
        rows.push([ev.title, ev.date, ev.time, b.firstName, b.lastName, b.email, b.phone,
          new Date(b.createdAt).toLocaleDateString('it-IT')].map(v => `"${v}"`).join(','))))
    }
    const csv = '﻿' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `prenotazioni-${tab}-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  // ── Render helpers ─────────────────────────────────────

  function renderBookingRow(
    b: { id: string; firstName: string; lastName: string; email: string; phone: string; createdAt: string },
    deleteKey: string,
    onDelete: () => void,
    isWaitlist = false,
  ): ReactNode {
    const isConfirm = deleteConfirm === deleteKey
    const credits = creditsByEmail.get(b.email.toLowerCase())
    return (
      <div key={b.id} className={`bk-row${isWaitlist ? ' bk-row--waitlist' : ''}${isConfirm ? ' bk-row--confirm' : ''}`}>
        <div className="bk-row-student">
          <div className="bk-avatar" style={{ background: avatarColor(`${b.firstName}${b.lastName}`) }}>
            {initials(b.firstName, b.lastName)}
          </div>
          <div className="bk-row-student-info">
            <span className="bk-row-name">{b.firstName} {b.lastName}</span>
            {credits !== undefined && <span className="bk-row-credits">{credits} crediti</span>}
          </div>
        </div>
        <div className="bk-row-contact">
          <span className="bk-row-email">{b.email}</span>
          <span className="bk-row-phone">{b.phone}</span>
        </div>
        <div className="bk-row-date">{relativeBookingDate(b.createdAt)}</div>
        <div className="bk-row-status">
          <span className={`bk-status-pill${isWaitlist ? ' bk-status-pill--waiting' : ' bk-status-pill--confirmed'}`}>
            {isWaitlist ? 'IN-ATTESA' : 'CONFERMATA'}
          </span>
        </div>
        <div className="bk-row-actions">
          {isConfirm ? (
            <>
              <button className="bk-confirm-delete" onClick={onDelete}>Sì</button>
              <button className="bk-cancel-confirm" onClick={() => setDeleteConfirm(null)}>No</button>
            </>
          ) : (
            <>
              <button className="bk-icon-btn" title="Invia email" onClick={() => window.open(`mailto:${b.email}`, '_blank')}>
                <IconMail />
              </button>
              <button className="bk-icon-btn bk-icon-btn--danger" title="Rimuovi" onClick={() => setDeleteConfirm(deleteKey)}>
                <IconTrash />
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  function renderAddPanel(targetId: string, isEvent: boolean): ReactNode {
    const bookedEmails = isEvent
      ? new Set(events.find(ev => ev.id === targetId)?.bookings.map(b => b.email) ?? [])
      : new Set(slots.find(s => s.id === targetId)?.bookings.map(b => b.email) ?? [])

    const available = isEvent
      ? students.filter(s => !bookedEmails.has(s.email))
      : students.filter(s => !bookedEmails.has(s.email) && s.lessonCredits >= 1)

    const filtered = available.filter(s =>
      `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(addStudentSearch.toLowerCase())
    )

    return (
      <div className="bk-add-panel">
        <span className="bk-add-label">Aggiungi studente</span>
        <div className="bk-add-controls">
          <div className="bk-search-wrap">
            <input
              type="text" className="bk-search-input" placeholder="Cerca per nome o email…"
              autoComplete="off" value={addStudentSearch}
              onChange={e => { setAddStudentSearch(e.target.value); setAddStudentId(''); setShowAddDropdown(true) }}
              onFocus={() => setShowAddDropdown(true)}
              onBlur={() => setTimeout(() => setShowAddDropdown(false), 150)}
            />
            {showAddDropdown && addStudentSearch.length > 0 && (
              filtered.length > 0 ? (
                <ul className="bk-search-dropdown">
                  {filtered.slice(0, 8).map(s => (
                    <li key={s.id} className="bk-search-option"
                      onMouseDown={() => { setAddStudentId(s.id); setAddStudentSearch(`${s.firstName} ${s.lastName}`); setShowAddDropdown(false) }}>
                      <span className="bk-search-name">{s.firstName} {s.lastName}</span>
                      <span className="bk-search-meta">{s.email} · {s.lessonCredits} crediti</span>
                    </li>
                  ))}
                </ul>
              ) : <div className="bk-search-empty">Nessuno studente trovato</div>
            )}
          </div>
          <button className="btn-primary bk-add-btn-sm"
            disabled={!addStudentId || addingStudent}
            onClick={() => handleAddStudent(targetId, isEvent)}>
            {addingStudent ? '…' : 'Aggiungi'}
          </button>
          <button className="bk-cancel-add" onClick={() => { setAddingToId(null); setAddStudentSearch(''); setAddStudentId('') }}>
            Annulla
          </button>
        </div>
      </div>
    )
  }

  function renderCard(
    id: string, title: string, dateStr: string, time: string, duration: string,
    typeBadge: string | undefined, bookingsCount: number, maxParticipants: number,
    waitlistCount: number, children: ReactNode,
    footerEmails: string[],
    isEvent: boolean,
  ): ReactNode {
    const isOpen = expanded.has(id)
    const { dayNum, month, dayName } = parseDateParts(dateStr)
    const fillPct = maxParticipants > 0 ? Math.min(Math.round((bookingsCount / maxParticipants) * 100), 100) : 0
    const spotsLeft = Math.max(0, maxParticipants - bookingsCount)

    return (
      <div key={id} className="bk-card">
        {/* Header */}
        <div className="bk-card-header" onClick={() => toggleExpand(id)}>
          <div className="bk-date">
            <span className="bk-date-num">{dayNum}</span>
            <span className="bk-date-month">{month}</span>
            <span className="bk-date-day">{dayName}</span>
          </div>
          <div className="bk-info">
            <div className="bk-info-top">
              {typeBadge && <span className="bk-type-pill">{typeBadge}</span>}
              <span className="bk-info-meta">{dayName} · {time}{duration ? ` · ${duration}` : ''}</span>
            </div>
            <span className="bk-info-title">{title}</span>
          </div>
          <div className="bk-card-right">
            <div className="bk-fill-col">
              <div className="bk-fill-count">
                <span className="bk-fill-booked">{bookingsCount}</span>
                <span className="bk-fill-sep">/</span>
                <span className="bk-fill-max">{maxParticipants}</span>
              </div>
              <div className="bk-fill-bar-wrap">
                <div className="bk-fill-bar" style={{ width: `${fillPct}%`, background: fillBarColor(fillPct) }} />
              </div>
              {waitlistCount > 0 && <span className="bk-waitlist-label">· {waitlistCount} attesa</span>}
            </div>
            <button
              className={`bk-roster-btn${isOpen ? ' bk-roster-btn--open' : ''}`}
              onClick={e => { e.stopPropagation(); toggleExpand(id) }}
            >
              {isOpen ? 'Comprimi ∨' : 'Roster ›'}
            </button>
          </div>
        </div>

        {/* Expanded roster */}
        {isOpen && (
          <div className="bk-roster">
            <div className="bk-roster-thead">
              <span>STUDENTE</span>
              <span>CONTATTO</span>
              <span>PRENOTATA</span>
              <span>STATO</span>
              <span />
            </div>
            {children}
            <div className="bk-roster-footer">
              <span className="bk-spots-left">
                {spotsLeft > 0 ? `${spotsLeft} ${spotsLeft === 1 ? 'posto ancora libero' : 'posti ancora liberi'}` : 'Al completo'}
              </span>
              <div className="bk-roster-actions">
                <button className="bk-email-all-btn" onClick={() => emailAllStudents(footerEmails, title)}
                  disabled={footerEmails.length === 0}>
                  <IconMail /> Email a tutti
                </button>
                <button className="btn-primary bk-manual-add-btn"
                  onClick={() => setAddingToId(prev => prev === id ? null : id)}>
                  + Aggiungi manualmente
                </button>
              </div>
            </div>
            {addingToId === id && renderAddPanel(id, isEvent)}
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="bookings-page">

      {/* Header */}
      <div className="bk-header">
        <div>
          <h1 className="bk-title">Prenotazioni</h1>
          <p className="bk-subtitle">
            {totalAllBookings} {totalAllBookings === 1 ? 'prenotazione totale' : 'prenotazioni totali'}
            {totalWaitlistCount > 0 && ` · ${totalWaitlistCount} in lista d'attesa`}
          </p>
        </div>
        <div className="bk-header-actions">
          <button className={`btn-filtri${showFilters ? ' btn-filtri--open' : ''}`}
            onClick={() => setShowFilters(f => !f)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 4h12M5 8h6M7 12h2" />
            </svg>
            Filtri
          </button>
          <button className="bk-export-btn" onClick={exportCSV}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 2v8M5 7l3 3 3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"/>
            </svg>
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bk-filter-panel">
          <span className="bk-filter-label">Mostra</span>
          <div className="bk-filter-pills">
            {([['upcoming','Prossime'],['past','Passate'],['all','Tutte']] as [Filter, string][]).map(([v, label]) => (
              <button key={v} className={`bk-filter-pill${filter === v ? ' bk-filter-pill--active' : ''}`}
                onClick={() => setFilter(v)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Layout: main + sidebar */}
      <div className="bk-layout">
        <div className="bk-main">

          {/* Tabs */}
          <div className="bk-tabs">
            <button className={`bk-tab${tab === 'lessons' ? ' bk-tab--active' : ''}`}
              onClick={() => switchTab('lessons')}>
              Lezioni <span className="bk-tab-badge">{filteredSlots.length}</span>
            </button>
            <button className={`bk-tab${tab === 'events' ? ' bk-tab--active' : ''}`}
              onClick={() => switchTab('events')}>
              Eventi <span className="bk-tab-badge">{filteredEvents.length}</span>
            </button>
          </div>

          {/* Lessons */}
          {tab === 'lessons' && (
            filteredSlots.length === 0 ? (
              <div className="bk-empty">
                <p>{filter === 'upcoming' ? 'Nessuna lezione in programma.' : 'Nessuna lezione trovata.'}</p>
              </div>
            ) : (
              <div className="bk-list">
                {filteredSlots.map(slot => {
                  const slotWl = waitlist.filter(w => w.slotId === slot.id)
                  const allBookingEmails = slot.bookings.map(b => b.email)
                  return renderCard(
                    slot.id, slot.title, slot.date, slot.time, `${slot.duration} min`,
                    slot.type || undefined, slot.bookings.length, slot.maxParticipants,
                    slotWl.length,
                    <>
                      {slot.bookings.map(b => renderBookingRow(b, `${slot.id}:${b.id}`,
                        () => { void handleDeleteLesson(slot.id, b.id) }))}
                      {slotWl.map(w => renderBookingRow(
                        { id: w.id, firstName: w.firstName, lastName: w.lastName, email: w.email, phone: w.phone, createdAt: w.createdAt },
                        `wl:${slot.id}:${w.id}`,
                        () => { void handleDeleteWaitlist(slot.id, w.id) },
                        true,
                      ))}
                      {slot.bookings.length === 0 && slotWl.length === 0 && (
                        <p className="bk-empty-roster">Nessuna prenotazione.</p>
                      )}
                    </>,
                    allBookingEmails, false,
                  )
                })}
              </div>
            )
          )}

          {/* Events */}
          {tab === 'events' && (
            filteredEvents.length === 0 ? (
              <div className="bk-empty">
                <p>{filter === 'upcoming' ? 'Nessun evento in programma.' : 'Nessun evento trovato.'}</p>
              </div>
            ) : (
              <div className="bk-list">
                {filteredEvents.map(ev => {
                  const allBookingEmails = ev.bookings.map(b => b.email)
                  return renderCard(
                    ev.id, ev.title, ev.date, ev.time, ev.location || '',
                    undefined, ev.bookings.length, ev.maxParticipants,
                    ev.waitlist.length,
                    <>
                      {ev.bookings.map(b => renderBookingRow(b, `ev:${ev.id}:${b.id}`,
                        () => { void handleDeleteEvent(ev.id, b.id) }))}
                      {ev.waitlist.map(w => renderBookingRow(
                        { id: w.id, firstName: w.firstName, lastName: w.lastName, email: w.email, phone: w.phone, createdAt: w.createdAt },
                        `ev-wl:${ev.id}:${w.id}`,
                        () => { void handleDeleteEventWaitlist(ev.id, w.id) },
                        true,
                      ))}
                      {ev.bookings.length === 0 && ev.waitlist.length === 0 && (
                        <p className="bk-empty-roster">Nessuna iscrizione.</p>
                      )}
                    </>,
                    allBookingEmails, true,
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* Sidebar */}
        <aside className="bk-sidebar">
          <div className="bk-side-card">
            <h2 className="bk-side-title">Ultime prenotazioni</h2>
            {recentEntries.length === 0 ? (
              <p className="bk-side-empty">Nessuna prenotazione.</p>
            ) : (
              <div className="bk-recent-list">
                {recentEntries.map((entry, i) => (
                  <div key={i} className="bk-recent-item">
                    <div className="bk-avatar bk-avatar--sm" style={{ background: avatarColor(`${entry.firstName}${entry.lastName}`) }}>
                      {initials(entry.firstName, entry.lastName)}
                    </div>
                    <div className="bk-recent-info">
                      <span className="bk-recent-name">{entry.firstName} {entry.lastName}</span>
                      <span className="bk-recent-slot">{entry.slotTitle} · {entry.slotDay} {entry.slotTime}</span>
                      <span className={`bk-status-pill bk-status-pill--sm${entry.isWaitlist ? ' bk-status-pill--waiting' : ' bk-status-pill--confirmed'}`}>
                        {entry.isWaitlist ? 'IN-ATTESA' : 'CONFERMATA'}
                      </span>
                    </div>
                    <span className="bk-recent-time">{bookingTimeOnly(entry.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
