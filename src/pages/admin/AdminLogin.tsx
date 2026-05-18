import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import logoFull from '../../assets/logo-full.png'
import './AdminLogin.css'

export default function AdminLogin() {
  const { adminLogin } = useApp()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = adminLogin(password)
    if (ok) {
      navigate('/admin/dashboard')
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logoFull} alt="Laura Pagnossin" className="login-logo-img" />
        <p className="login-subtitle">Area Riservata</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false) }}
            placeholder="Password"
            className="login-input"
            autoFocus
          />
          {error && (
            <p className="login-error">Password non corretta</p>
          )}
          <button type="submit" className="btn-primary login-btn">
            Accedi
          </button>
        </form>
      </div>
    </div>
  )
}
