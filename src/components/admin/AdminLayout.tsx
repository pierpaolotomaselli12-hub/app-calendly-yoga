import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import './AdminLayout.css'

export default function AdminLayout() {
  const { isAdminLoggedIn, adminLogout } = useApp()
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
            <span className="sidebar-name">Yoga Studio</span>
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
        <Outlet />
      </main>
    </div>
  )
}
