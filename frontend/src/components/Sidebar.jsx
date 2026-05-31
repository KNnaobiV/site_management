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
  LogOut,
  Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const Sidebar = ({ isOpen, toggleSidebar, isMobile }) => {
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
      width: isMobile ? (isOpen ? '280px' : '0px') : (isOpen ? '280px' : '88px'),
      height: '100dvh',
      background: 'var(--bg-sidebar)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      padding: (isMobile && !isOpen) ? '0' : '40px 24px',
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 100,
      transition: 'all 0.3s ease',
      overflowX: 'hidden'
    }}>
      {/* Brand & Hamburger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px', overflow: 'hidden' }}>
        {!isMobile && (
          <button 
            onClick={toggleSidebar} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              padding: 0
            }}
          >
            <Menu size={24} />
          </button>
        )}
        
        <div style={{
          minWidth: '40px',
          width: '40px',
          height: '40px',
          background: 'var(--brand-orange)',
          borderRadius: '8px',
          display: isOpen ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <HardHat size={24} color="#fff" />
        </div>
        
        {isOpen && (
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '28px',
            margin: 0,
            color: '#fff',
            whiteSpace: 'nowrap'
          }}>Iron<em style={{ color: "var(--rust-light)" }}>Work</em></h2>
        )}
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
                  transition: 'all 0.2s',
                  justifyContent: isOpen ? 'flex-start' : 'center'
                })}
                title={!isOpen ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} color={isActive ? 'var(--brand-orange)' : 'currentColor'} style={{ flexShrink: 0 }} />
                    {isOpen && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
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
            transition: 'all 0.2s',
            justifyContent: isOpen ? 'flex-start' : 'center'
          })}
          title={!isOpen ? 'Profile' : undefined}
        >
          <div style={{ flexShrink: 0 }}>
            <Avatar name={user?.display_name || user?.username} size={40} />
          </div>
          {isOpen && (
            <>
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
                  margin: 0,
                  whiteSpace: 'nowrap'
                }}>
                  {user?.role || 'Team Member'}
                </p>
              </div>
              <ChevronRight size={16} color="var(--text-tertiary)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </>
          )}
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
            justifyContent: isOpen ? 'flex-start' : 'center'
          }}
          title={!isOpen ? 'Sign Out' : undefined}
          onMouseOver={(e) => { e.currentTarget.style.color = '#EB5757'; e.currentTarget.style.background = 'rgba(235, 87, 87, 0.1)'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={20} style={{ flexShrink: 0 }} />
          {isOpen && <span style={{ whiteSpace: 'nowrap' }}>Sign Out</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
