import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import logoFull from '../../assets/logo-full.png'
import './AdminLayout.css'

export default function AdminLayout() {
  const { isAdminLoggedIn, adminLogout, loading, slots, waitlist, students, events } = useApp()
  const navigate = useNavigate()

  if (!isAdminLoggedIn) {
    navigate('/admin/login', { replace: true })
    return null
  }

  function handleLogout() {
    adminLogout()
    navigate('/admin/login', { replace: true })
  }

  const todayISO = new Date().toISOString().slice(0, 10)
  const upcomingCount = slots.filter(s => s.date >= todayISO).length
  const waitlistCount = waitlist.length
  const studentsCount = students.length
  const eventsCount = events.filter(e => e.date >= todayISO).length

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <img src={logoFull} alt="Laura Pagnossin" className="sidebar-logo" />
          </div>

          <nav className="sidebar-nav">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) => isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'}
            >
              <svg className="sidebar-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2" y="2" width="7" height="7" rx="1.5" />
                <rect x="11" y="2" width="7" height="7" rx="1.5" />
                <rect x="2" y="11" width="7" height="7" rx="1.5" />
                <rect x="11" y="11" width="7" height="7" rx="1.5" />
              </svg>
              Panoramica
            </NavLink>

            <span className="sidebar-section-label">PRATICA</span>

            <NavLink
              to="/admin/slots"
              className={({ isActive }) => isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'}
            >
              <svg className="sidebar-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="4" width="14" height="13" rx="2" />
                <path d="M7 2v4M13 2v4M3 9h14" />
              </svg>
              Lezioni
              {upcomingCount > 0 && <span className="sidebar-badge">{upcomingCount}</span>}
            </NavLink>

            <NavLink
              to="/admin/bookings"
              className={({ isActive }) => isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'}
            >
              <svg className="sidebar-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2" y="2" width="16" height="16" rx="2" />
                <path d="M5 7h10M5 10.5h7M5 14h5" />
              </svg>
              Prenotazioni
              {waitlistCount > 0 && <span className="sidebar-badge sidebar-badge--warn">{waitlistCount}</span>}
            </NavLink>

            <NavLink
              to="/admin/events"
              className={({ isActive }) => isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'}
            >
              <svg className="sidebar-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="10" r="7" />
                <path d="M10 6.5v3.5l2.5 1.5" />
              </svg>
              Eventi
              {eventsCount > 0 && <span className="sidebar-badge">{eventsCount}</span>}
            </NavLink>

            <span className="sidebar-section-label">PERSONE</span>

            <NavLink
              to="/admin/students"
              className={({ isActive }) => isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'}
            >
              <svg className="sidebar-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="7" r="3" />
                <path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" />
              </svg>
              Studenti
              {studentsCount > 0 && <span className="sidebar-badge">{studentsCount}</span>}
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-profile">
            <div className="sidebar-profile-avatar">LP</div>
            <div className="sidebar-profile-info">
              <span className="sidebar-profile-name">Laura P.</span>
              <span className="sidebar-profile-role">Amministratore</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <svg className="sidebar-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M13 3h4v14h-4M9 14l4-4-4-4M3 10h10" />
            </svg>
            Esci
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>Caricamento...</p>
        ) : (
          <Outlet />
        )}
      </main>

      <nav className="admin-bottom-nav">
        <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="2" y="2" width="7" height="7" rx="1" />
            <rect x="11" y="2" width="7" height="7" rx="1" />
            <rect x="2" y="11" width="7" height="7" rx="1" />
            <rect x="11" y="11" width="7" height="7" rx="1" />
          </svg>
          <span className="bottom-nav-label">Home</span>
        </NavLink>
        <NavLink to="/admin/slots" className={({ isActive }) => isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="14" height="13" rx="2" />
            <path d="M7 2v4M13 2v4M3 9h14" />
          </svg>
          <span className="bottom-nav-label">Lezioni</span>
        </NavLink>
        <NavLink to="/admin/bookings" className={({ isActive }) => isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="2" y="2" width="16" height="16" rx="2" />
            <path d="M5 7h10M5 10.5h7M5 14h5" />
          </svg>
          <span className="bottom-nav-label">Prenot.</span>
        </NavLink>
        <NavLink to="/admin/students" className={({ isActive }) => isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="10" cy="7" r="3" />
            <path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" />
          </svg>
          <span className="bottom-nav-label">Studenti</span>
        </NavLink>
        <NavLink to="/admin/events" className={({ isActive }) => isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="10" cy="10" r="7" />
            <path d="M10 6.5v3.5l2.5 1.5" />
          </svg>
          <span className="bottom-nav-label">Eventi</span>
        </NavLink>
        <button className="bottom-nav-item" onClick={handleLogout}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M13 3h4v14h-4M9 14l4-4-4-4M3 10h10" />
          </svg>
          <span className="bottom-nav-label">Esci</span>
        </button>
      </nav>
    </div>
  )
}
