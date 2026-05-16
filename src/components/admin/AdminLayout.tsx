import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
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
            <span className="sidebar-leaf">✿</span>
            <span className="sidebar-name">Laura Pagnossin</span>
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
              to="/admin/students"
              className={({ isActive }) =>
                isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'
              }
            >
              Studenti
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
          to="/admin/students"
          className={({ isActive }) =>
            isActive ? 'bottom-nav-item bottom-nav-item--active' : 'bottom-nav-item'
          }
        >
          <span className="bottom-nav-icon">👥</span>
          <span className="bottom-nav-label">Studenti</span>
        </NavLink>
        <button className="bottom-nav-item" onClick={handleLogout}>
          <span className="bottom-nav-icon">↩</span>
          <span className="bottom-nav-label">Esci</span>
        </button>
      </nav>
    </div>
  )
}
