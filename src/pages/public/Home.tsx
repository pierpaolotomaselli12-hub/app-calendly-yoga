import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import './Home.css'

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
  const { slots, loading } = useApp()
  const navigate = useNavigate()
  const [activeType, setActiveType] = useState<string>('Tutte')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcomingSlots = useMemo(() => {
    return slots
      .filter(slot => {
        const [y, m, d] = slot.date.split('-').map(Number)
        const slotDate = new Date(y, m - 1, d)
        return slotDate >= today
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

  return (
    <div className="home">
      <header className="home-header">
        <h1 className="home-logo">Yoga Studio</h1>
        <p className="home-subtitle">Prenota la tua lezione</p>
      </header>

      <main className="home-main">
        {loading ? (
          <div className="home-loading">Caricamento lezioni...</div>
        ) : (
          <>
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
                  return (
                    <div key={slot.id} className="slot-card">
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
                      <button
                        className={isFull ? 'btn-waitlist slot-card__btn' : 'btn-primary slot-card__btn'}
                        onClick={() => navigate(`/book/${slot.id}`)}
                      >
                        {isFull ? "Lista d'attesa" : 'Prenota'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="home-footer">
        <p>Sei l'insegnante? <Link to="/admin/login">Accedi</Link></p>
      </footer>
    </div>
  )
}
