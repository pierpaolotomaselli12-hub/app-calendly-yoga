import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import './AdminDashboard.css'

// ── Date helpers ──────────────────────────────────────

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  return m
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1]}`
}

function formatWeekRange(mon: Date): string {
  const sun = addDays(mon, 6)
  return `${mon.getDate()} – ${sun.getDate()} ${MONTH_NAMES[sun.getMonth()]}`
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'adesso'
  if (diffMin < 60) return `${diffMin}m fa`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h fa`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}g fa`
  return formatDateShort(iso.slice(0, 10))
}

function fillColor(rate: number): string {
  if (rate > 80) return '#8b4a48'
  if (rate >= 50) return '#c17f3b'
  return '#818569'
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

const TYPE_COLORS = ['#818569', '#c17f3b', '#8b4a48', '#5c6148', '#b0a897']

// ── Component ─────────────────────────────────────────

export default function AdminDashboard() {
  const { slots, waitlist, students } = useApp()

  const todayISO = useMemo(() => toISO(new Date()), [])

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const weekRange = useMemo(() => formatWeekRange(weekStart), [weekStart])

  // Stat: lezioni questa settimana (always current week, not navigated)
  const slotsThisWeek = useMemo(() => {
    const mon = getMonday(new Date())
    const monISO = toISO(mon)
    const sunISO = toISO(addDays(mon, 6))
    return slots.filter(s => s.date >= monISO && s.date <= sunISO)
  }, [slots])

  // Fill rate (past slots)
  const fillRate = useMemo(() => {
    const past = slots.filter(s => s.date < todayISO)
    if (past.length === 0) return null
    const total = past.reduce((sum, s) => sum + (s.bookings.length / Math.max(s.maxParticipants, 1)) * 100, 0)
    return Math.round(total / past.length)
  }, [slots, todayISO])

  // Next upcoming slot
  const nextSlot = useMemo(
    () =>
      slots
        .filter(s => s.date >= todayISO)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] ?? null,
    [slots, todayISO]
  )

  // Today's slots
  const todaySlots = useMemo(
    () => slots.filter(s => s.date === todayISO).sort((a, b) => a.time.localeCompare(b.time)),
    [slots, todayISO]
  )

  // Recent bookings (latest 8)
  const recentBookings = useMemo(() => {
    const all: { slotTitle: string; firstName: string; lastName: string; createdAt: string }[] = []
    slots.forEach(s =>
      s.bookings.forEach(b =>
        all.push({ slotTitle: s.title, firstName: b.firstName, lastName: b.lastName, createdAt: b.createdAt })
      )
    )
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)
  }, [slots])

  // Top students by booking count
  const topStudents = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    slots.forEach(s =>
      s.bookings.forEach(b => {
        const key = b.email.toLowerCase()
        const e = map.get(key)
        if (e) e.count++
        else map.set(key, { name: `${b.firstName} ${b.lastName}`, count: 1 })
      })
    )
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [slots])

  // Type stats with relative bar widths
  const typeStats = useMemo(() => {
    const map = new Map<string, { type: string; count: number; bookings: number }>()
    slots.forEach(s => {
      const key = s.type.trim()
      if (!key) return
      const e = map.get(key)
      if (e) { e.count++; e.bookings += s.bookings.length }
      else map.set(key, { type: key, count: 1, bookings: s.bookings.length })
    })
    const arr = Array.from(map.values()).sort((a, b) => b.bookings - a.bookings)
    const maxB = Math.max(...arr.map(t => t.bookings), 1)
    return arr.map(t => ({ ...t, pct: Math.round((t.bookings / maxB) * 100) }))
  }, [slots])

  const nextFillRate = nextSlot
    ? Math.min(Math.round((nextSlot.bookings.length / Math.max(nextSlot.maxParticipants, 1)) * 100), 100)
    : 0

  return (
    <div className="dash">
      {/* ── Left main ── */}
      <div className="dash-main">

        {/* Greeting */}
        <div className="dash-header">
          <div>
            <h1 className="dash-greeting">{getGreeting()}, Maestra</h1>
            <p className="dash-date">{formatDateShort(todayISO)}</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="dash-stats">
          <div className="dash-stat">
            <span className="dash-stat-label">Lezioni settimana</span>
            <span className="dash-stat-value">{slotsThisWeek.length}</span>
            <span className="dash-stat-sub">{formatWeekRange(getMonday(new Date()))}</span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat-label">Tasso riempimento</span>
            <span className="dash-stat-value" style={{ color: fillRate != null ? fillColor(fillRate) : undefined }}>
              {fillRate != null ? `${fillRate}%` : '—'}
            </span>
            <span className="dash-stat-sub">media lezioni passate</span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat-label">Studenti iscritti</span>
            <span className="dash-stat-value">{students.length}</span>
            <span className="dash-stat-sub">totale registrati</span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat-label">Lista d'attesa</span>
            <span className="dash-stat-value" style={{ color: waitlist.length > 0 ? '#c17f3b' : undefined }}>
              {waitlist.length}
            </span>
            <span className="dash-stat-sub">in attesa</span>
          </div>
        </div>

        {/* Prossima lezione */}
        {nextSlot && (
          <div className="dash-next">
            <span className="dash-next-label">Prossima lezione</span>
            <div className="dash-next-row">
              <div className="dash-next-info">
                <span className="dash-next-title">{nextSlot.title}</span>
                <span className="dash-next-meta">
                  {formatDateShort(nextSlot.date)} · {nextSlot.time} · {nextSlot.duration} min
                </span>
              </div>
              <div className="dash-next-count">
                <span className="dash-next-num">{nextSlot.bookings.length}</span>
                <span className="dash-next-denom">/{nextSlot.maxParticipants}</span>
              </div>
            </div>
            <div className="dash-next-bar-wrap">
              <div
                className="dash-next-bar"
                style={{ width: `${nextFillRate}%`, background: fillColor(nextFillRate) }}
              />
            </div>
          </div>
        )}

        {/* Weekly calendar */}
        <div className="dash-cal">
          <div className="dash-cal-head">
            <span className="dash-cal-heading">Calendario settimana</span>
            <div className="dash-cal-nav">
              <button className="dash-cal-btn" onClick={() => setWeekStart(d => addDays(d, -7))}>‹</button>
              <span className="dash-cal-range">{weekRange}</span>
              <button className="dash-cal-btn" onClick={() => setWeekStart(d => addDays(d, 7))}>›</button>
            </div>
          </div>
          <div className="dash-cal-grid">
            {weekDays.map((day, i) => {
              const ds = toISO(day)
              const daySlots = slots.filter(s => s.date === ds)
              const isToday = ds === todayISO
              const isPast = ds < todayISO
              return (
                <div
                  key={ds}
                  className={`dash-cal-day${isToday ? ' dash-cal-day--today' : ''}${isPast ? ' dash-cal-day--past' : ''}`}
                >
                  <div className="dash-cal-day-head">
                    <span className="dash-cal-day-lbl">{DAY_LABELS[i]}</span>
                    <span className="dash-cal-day-num">{day.getDate()}</span>
                  </div>
                  <div className="dash-cal-day-slots">
                    {daySlots.length === 0 ? (
                      <span className="dash-cal-empty">—</span>
                    ) : (
                      daySlots.map(s => (
                        <div key={s.id} className={`dash-cal-slot${isPast ? ' dash-cal-slot--past' : ''}`}>
                          <span className="dash-cal-slot-time">{s.time}</span>
                          <span className="dash-cal-slot-fill">{s.bookings.length}/{s.maxParticipants}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Type bars */}
        {typeStats.length > 0 && (
          <div className="dash-types">
            <h2 className="dash-section-title">Lezioni per tipologia</h2>
            <div className="dash-types-list">
              {typeStats.map((t, i) => (
                <div key={t.type} className="dash-type-row">
                  <span className="dash-type-name">{t.type}</span>
                  <div className="dash-type-bar-wrap">
                    <div
                      className="dash-type-bar"
                      style={{ width: `${t.pct}%`, background: TYPE_COLORS[i % TYPE_COLORS.length] }}
                    />
                  </div>
                  <span className="dash-type-count">{t.bookings} pren.</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right sidebar ── */}
      <aside className="dash-side">

        {/* Oggi */}
        <div className="dash-side-card">
          <h2 className="dash-side-title">Oggi</h2>
          {todaySlots.length === 0 ? (
            <p className="dash-side-empty">Nessuna lezione oggi</p>
          ) : (
            <div className="dash-today-list">
              {todaySlots.map(s => (
                <div key={s.id} className="dash-today-item">
                  <span className="dash-today-time">{s.time}</span>
                  <div className="dash-today-info">
                    <span className="dash-today-title">{s.title}</span>
                    <span className="dash-today-meta">{s.bookings.length}/{s.maxParticipants} studenti</span>
                  </div>
                  <div className={`dash-today-dot${s.bookings.length >= s.maxParticipants ? ' dash-today-dot--full' : ''}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attività recente */}
        <div className="dash-side-card">
          <h2 className="dash-side-title">Attività recente</h2>
          {recentBookings.length === 0 ? (
            <p className="dash-side-empty">Nessuna prenotazione</p>
          ) : (
            <div className="dash-activity-list">
              {recentBookings.map((b, i) => (
                <div key={i} className="dash-activity-item">
                  <div className="dash-activity-avatar">
                    {b.firstName[0]}{b.lastName[0]}
                  </div>
                  <div className="dash-activity-info">
                    <span className="dash-activity-name">{b.firstName} {b.lastName}</span>
                    <span className="dash-activity-slot">{b.slotTitle}</span>
                  </div>
                  <span className="dash-activity-time">{relativeTime(b.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top students */}
        {topStudents.length > 0 && (
          <div className="dash-side-card">
            <h2 className="dash-side-title">Studenti più assidui</h2>
            <div className="dash-top-list">
              {topStudents.map((s, i) => (
                <div key={i} className="dash-top-item">
                  <span className="dash-top-rank">#{i + 1}</span>
                  <span className="dash-top-name">{s.name}</span>
                  <span className="dash-top-count">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
