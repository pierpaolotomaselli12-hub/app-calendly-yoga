import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import logoFull from '../../assets/logo-full.png'
import './BookingConfirmed.css'

export default function BookingConfirmed() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const name = searchParams.get('name') ?? ''
  const title = searchParams.get('title') ?? ''
  const date = searchParams.get('date') ?? ''
  const time = searchParams.get('time') ?? ''
  const isWaitlist = searchParams.get('waitlist') === 'true'

  if (isWaitlist) {
    return (
      <div className="confirmed-page">
        <img src={logoFull} alt="Laura Pagnossin" className="confirmed-logo" />
        <div className="confirmed-card">
          <div className="confirmed-checkmark confirmed-checkmark--waitlist">✉</div>
          <h1 className="confirmed-title">Sei in lista d'attesa!</h1>
          <p className="confirmed-message">
            Ciao {name}, sei in lista d'attesa per <strong>{title}</strong> il {date} alle {time}. Ti contatteremo se si libera un posto.
          </p>
          <button
            className="btn-primary confirmed-btn"
            onClick={() => navigate('/')}
          >
            Torna alle lezioni
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="confirmed-page">
      <img src={logoFull} alt="Laura Pagnossin" className="confirmed-logo" />
      <div className="confirmed-card">
        <div className="confirmed-checkmark">✓</div>
        <h1 className="confirmed-title">Prenotazione confermata!</h1>
        <p className="confirmed-message">
          Ciao {name}, sei iscritto/a a <strong>{title}</strong> il {date} alle {time}.
        </p>
        <p className="confirmed-tip">Ricordati di portare il tuo tappetino!</p>
        <p className="confirmed-cancel-hint">
          Hai bisogno di disdire?{' '}
          <Link to="/cancella" className="confirmed-cancel-link">Clicca qui</Link>
        </p>
        <button
          className="btn-primary confirmed-btn"
          onClick={() => navigate('/')}
        >
          Torna alle lezioni
        </button>
      </div>
    </div>
  )
}
