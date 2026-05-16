import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import type { Slot } from '../../types'
import './AdminDashboard.css'

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function fillColor(rate: number): string {
  if (rate > 80) return '#8b4a48'
  if (rate >= 50) return '#c17f3b'
  return '#818569'
}

interface TypeStat {
  type: string
  lessonCount: number
  bookingCount: number
}

export default function AdminDashboard() {
  const { slots, waitlist } = useApp()

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const in7Days = useMemo(() => {
    const d = new Date(today)
    d.setDate(today.getDate() + 7)
    return d
  }, [today])

  const totalBookings = useMemo(
    () => slots.reduce((sum, s) => sum + s.bookings.length, 0),
    [slots]
  )

  const upcomingSlots = useMemo(
    () =>
      slots
        .filter(s => {
          const d = new Date(s.date)
          d.setHours(0, 0, 0, 0)
          return d >= today
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [slots, today]
  )

  const pastSlots = useMemo(
    () =>
      slots
        .filter(s => {
          const d = new Date(s.date)
          d.setHours(0, 0, 0, 0)
          return d < today
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
    [slots, today]
  )

  const nextWeekCount = useMemo(
    () =>
      upcomingSlots.filter(s => {
        const d = new Date(s.date)
        d.setHours(0, 0, 0, 0)
        return d <= in7Days
      }).length,
    [upcomingSlots, in7Days]
  )

  const fillRate = useMemo(() => {
    if (pastSlots.length === 0) return null
    const total = pastSlots.reduce(
      (sum, s) => sum + (s.bookings.length / s.maxParticipants) * 100,
      0
    )
    return Math.round(total / pastSlots.length)
  }, [pastSlots])

  const next5 = upcomingSlots.slice(0, 5)
  const last3 = pastSlots.slice(0, 3)

  const typeStats = useMemo((): TypeStat[] => {
    const map = new Map<string, TypeStat>()
    slots.forEach(s => {
      const key = s.type.trim()
      if (key === '') return
      const existing = map.get(key)
      if (existing) {
        existing.lessonCount += 1
        existing.bookingCount += s.bookings.length
      } else {
        map.set(key, {
          type: key,
          lessonCount: 1,
          bookingCount: s.bookings.length,
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.type.localeCompare(b.type))
  }, [slots])

  const showTypeSection = typeStats.length > 0

  function slotFillRate(slot: Slot): number {
    return Math.round((slot.bookings.length / slot.maxParticipants) * 100)
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard-greeting">Benvenuta, Maestra</h1>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-label">Lezioni Totali</span>
          <span className="stat-value">{slots.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Prenotazioni Totali</span>
          <span className="stat-value">{totalBookings}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Prossime Lezioni</span>
          <span className="stat-value">{nextWeekCount}</span>
          <span className="stat-sub">nei prossimi 7 giorni</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">In lista d&apos;attesa</span>
          <span className="stat-value">{waitlist.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Tasso di riempimento</span>
          <span className="stat-value">
            {fillRate !== null ? `${fillRate}%` : '—'}
          </span>
          <span className="stat-sub">media lezioni passate</span>
        </div>
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Prossime 5 Lezioni</h2>
        {next5.length === 0 ? (
          <p className="empty-msg">Nessuna lezione in programma.</p>
        ) : (
          <div className="upcoming-list">
            {next5.map(slot => {
              const rate = slotFillRate(slot)
              return (
                <div key={slot.id} className="upcoming-item">
                  <div className="upcoming-item-top">
                    <div className="upcoming-info">
                      <span className="upcoming-title">{slot.title}</span>
                      <span className="upcoming-meta">
                        {formatDate(slot.date)} &middot; {slot.time}
                      </span>
                    </div>
                    <div className="upcoming-count">
                      <span className="count-num">{slot.bookings.length}</span>
                      <span className="count-sep">/</span>
                      <span className="count-max">{slot.maxParticipants}</span>
                      <span className="count-label">studenti</span>
                    </div>
                  </div>
                  <div className="fill-bar-wrap">
                    <div
                      className="fill-bar"
                      style={{
                        width: `${Math.min(rate, 100)}%`,
                        backgroundColor: fillColor(rate),
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showTypeSection && (
        <div className="dashboard-section">
          <h2 className="section-title">Tipi di lezione</h2>
          <div className="type-grid">
            {typeStats.map(ts => (
              <div key={ts.type} className="type-card">
                <span className="type-card__name">{ts.type}</span>
                <span className="type-card__bookings">{ts.bookingCount}</span>
                <span className="type-card__lessons">
                  {ts.lessonCount} {ts.lessonCount === 1 ? 'lezione' : 'lezioni'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {last3.length > 0 && (
        <div className="dashboard-section">
          <h2 className="section-title">Ultime 3 lezioni</h2>
          <div className="upcoming-list">
            {last3.map(slot => {
              const rate = slotFillRate(slot)
              return (
                <div key={slot.id} className="upcoming-item">
                  <div className="upcoming-item-top">
                    <div className="upcoming-info">
                      <span className="upcoming-title">{slot.title}</span>
                      <span className="upcoming-meta">
                        {formatDate(slot.date)} &middot; {slot.time}
                      </span>
                    </div>
                    <div className="upcoming-count">
                      <span className="count-num">{slot.bookings.length}</span>
                      <span className="count-sep">/</span>
                      <span className="count-max">{slot.maxParticipants}</span>
                      <span className="count-label">studenti</span>
                    </div>
                  </div>
                  <div className="fill-bar-wrap">
                    <div
                      className="fill-bar"
                      style={{
                        width: `${Math.min(rate, 100)}%`,
                        backgroundColor: fillColor(rate),
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
