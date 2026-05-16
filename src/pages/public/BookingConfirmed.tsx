import { useSearchParams, useNavigate } from 'react-router-dom'
import './BookingConfirmed.css'

export default function BookingConfirmed() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const name = searchParams.get('name') ?? ''
  const title = searchParams.get('title') ?? ''
  const date = searchParams.get('date') ?? ''
  const time = searchParams.get('time') ?? ''

  return (
    <div className="confirmed-page">
      <div className="confirmed-card">
        <div className="confirmed-checkmark">✓</div>
        <h1 className="confirmed-title">Prenotazione confermata!</h1>
        <p className="confirmed-message">
          Ciao {name}, sei iscritto/a a <strong>{title}</strong> il {date} alle {time}.
        </p>
        <p className="confirmed-tip">Ricordati di portare il tuo tappetino!</p>
        <button
          className="btn-primary confirmed-btn"
          onClick={() => navigate('/')}
        >
          Prenota un'altra lezione
        </button>
      </div>
    </div>
  )
}
