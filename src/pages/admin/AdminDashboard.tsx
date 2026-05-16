import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import './AdminDashboard.css'

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default function AdminDashboard() {
  const { slots } = useApp()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7Days = new Date(today)
  in7Days.setDate(today.getDate() + 7)

  const totalBookings = useMemo(
    () => slots.reduce((sum, s) => sum + s.bookings.length, 0),
    [slots]
  )

  const upcomingSlots = useMemo(() => {
    return slots
      .filter(s => {
        const d = new Date(s.date)
        d.setHours(0, 0, 0, 0)
        return d >= today
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }, [slots])

  const nextWeekCount = useMemo(
    () =>
      upcomingSlots.filter(s => {
        const d = new Date(s.date)
        d.setHours(0, 0, 0, 0)
        return d <= in7Days
      }).length,
    [upcomingSlots]
  )

  const next5 = upcomingSlots.slice(0, 5)

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
      </div>

      <div className="dashboard-section">
        <h2 className="section-title">Prossime 5 Lezioni</h2>
        {next5.length === 0 ? (
          <p className="empty-msg">Nessuna lezione in programma.</p>
        ) : (
          <div className="upcoming-list">
            {next5.map(slot => (
              <div key={slot.id} className="upcoming-item">
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
