import { Outlet, NavLink, useNavigate } from 'react-router-dom'
// import { useAuth } from '../../context/AuthContext'
import { useMyInvitations } from '../../../hooks/useInvitations'

function SidebarLink({ to, icon, label, badge }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && <span className="notif-dot" />}
    </NavLink>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pendingCount } = useMyInvitations()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? user.username?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">
            Build<span className="logo-accent">Track</span>
          </span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Workspace</div>
          <SidebarLink to="/projects" icon={<IconFolder />} label="Projects" />
          <SidebarLink to="/invitations" icon={<IconMail />} label="Invitations" badge={pendingCount} />

          <div className="sidebar-section-label" style={{ marginTop: 'var(--sp-4)' }}>Account</div>
          <button className="sidebar-link" onClick={handleLogout} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}>
            <IconLogout />
            Sign out
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{user?.username}</div>
              <div className="sidebar-role">{user?.email}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

// Inline SVG icons
const IconFolder  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
const IconMail    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
const IconLogout  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>