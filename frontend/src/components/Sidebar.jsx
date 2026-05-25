import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Map as MapIcon,
  CheckSquare,
  ClipboardList,
  Bell,
  UserPlus,
  ChevronRight,
  HardHat,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const Sidebar = () => {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/projects', icon: Briefcase, label: 'Projects' },
    { to: '/plots', icon: MapIcon, label: 'Plots' },
    { to: '/work-items', icon: CheckSquare, label: 'Work Items' },
    { to: '/job-items', icon: ClipboardList, label: 'Job Items' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
  ];

  return (
    <div style={{
      width: '280px',
      height: '100vh',
      background: 'var(--bg-sidebar)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      padding: '40px 24px',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: 'var(--brand-orange)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <HardHat size={24} color="#fff" />
        </div>
        <h2 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '28px',
          margin: 0,
          color: '#fff'
        }}>Iron<em style={{ color: "var(--rust-light)" }}>Work</em></h2>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1 }}>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {navItems.map((item) => (
            <li key={item.label} style={{ marginBottom: '8px' }}>
              <NavLink
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  color: isActive ? '#fff' : 'var(--text-tertiary)',
                  background: isActive ? 'rgba(193, 74, 30, 0.15)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                })}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} color={isActive ? 'var(--brand-orange)' : 'currentColor'} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Profile */}
      <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <NavLink
          to="/profile"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
            background: isActive ? 'rgba(193, 74, 30, 0.15)' : 'transparent',
            borderRadius: '12px',
            padding: '16px',
            transition: 'all 0.2s'
          })}
        >
          <Avatar name={user?.display_name || user?.username} size={40} />
          <div style={{ overflow: 'hidden' }}>
            <p style={{
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {user?.display_name || user?.username}
            </p>
            <p style={{
              color: 'var(--text-tertiary)',
              fontSize: '12px',
              margin: 0
            }}>
              {user?.role || 'Team Member'}
            </p>
          </div>
          <ChevronRight size={16} color="var(--text-tertiary)" style={{ marginLeft: 'auto' }} />
        </NavLink>

        <button
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 500,
            transition: 'all 0.2s',
            width: '100%',
            textAlign: 'left'
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = '#EB5757'; e.currentTarget.style.background = 'rgba(235, 87, 87, 0.1)'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
