import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
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
        <div className="login-logo">
          <span className="login-leaf">✿</span>
        </div>
        <h1 className="login-title">Laura Pagnossin</h1>
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
