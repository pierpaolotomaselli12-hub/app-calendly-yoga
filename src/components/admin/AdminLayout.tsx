import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import logoFull from '../../assets/logo-full.png'
import './AdminLayout.css'

export default function AdminLayout() {
  const { isAdminLoggedIn, adminLogout, loading } = useApp()
  const navigate = useNavigate()

  if (!isAdminLoggedIn) {
    navigate('/admin/login', { replace: true })
    return null
  }

  function handleLogout() {
    adminLogout()
    navigate('/admin/login', { replace: true })
  }

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
              className={({ isActive }) =>
                isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/admin/slots"
              className={({ isActive }) =>
                isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'
              }
            >
              Lezioni
            </NavLink>
            <NavLink
              to="/admin/bookings"
              className={({ isActive }) =>
                isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'
              }
            >
              Prenotazioni
            </NavLink>
            <NavLink
              to="/admin/students"
              className={({ isActive }) =>
                isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'
              }
            >
              Studenti
            </NavLink>
            <NavLink
              to="/admin/events"
              className={({ isActive }) =>
                isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'
              }
            >
              Eventi
            </NavLink>
          </nav>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          Esci
        </button>
      </aside>
      <main className="admin-main">
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>Caricamento...</p>
        ) : (
          <Outlet />
        )}
      </main>
      <nav className="admin-bottom-nav">
        <NavLink
          to="/admin/dashboard"
          className={({ isActive }) =>
            isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'
          }
        >
          <span className="bottom-nav-icon">🏠</span>
          <span className="bottom-nav-label">Dashboard</span>
        </NavLink>
        <NavLink
          to="/admin/slots"
          className={({ isActive }) =>
            isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'
          }
        >
          <span className="bottom-nav-icon">🗓</span>
          <span className="bottom-nav-label">Lezioni</span>
        </NavLink>
        <NavLink
          to="/admin/bookings"
          className={({ isActive }) =>
            isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'
          }
        >
          <span className="bottom-nav-icon">📋</span>
          <span className="bottom-nav-label">Prenotazioni</span>
        </NavLink>
        <NavLink
          to="/admin/students"
          className={({ isActive }) =>
            isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'
          }
        >
          <span className="bottom-nav-icon">👥</span>
          <span className="bottom-nav-label">Studenti</span>
        </NavLink>
        <NavLink
          to="/admin/events"
          className={({ isActive }) =>
            isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'
          }
        >
          <span className="bottom-nav-icon">🎪</span>
          <span className="bottom-nav-label">Eventi</span>
        </NavLink>
        <button className="bottom-nav-item" onClick={handleLogout}>
          <span className="bottom-nav-icon">↩</span>
          <span className="bottom-nav-label">Esci</span>
        </button>
      </nav>
    </div>
  )
}
