import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  Map as MapIcon, 
  ClipboardList, 
  CheckSquare, 
  Bell,
  ChevronRight,
  HardHat
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const Sidebar = () => {
  const { user } = useAuth();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/projects', icon: Briefcase, label: 'Projects' },
    { to: '/plots', icon: MapIcon, label: 'Plots' },
    { to: '/work-items', icon: ClipboardList, label: 'Work Items' },
    { to: '/job-items', icon: CheckSquare, label: 'Job Items' },
    { to: '/notifications', icon: Bell, label: 'Notifications', badge: 12 },
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
        }}>Ironwork</h2>
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
                    {item.badge && (
                      <span style={{
                        marginLeft: 'auto',
                        background: 'var(--brand-orange)',
                        color: '#fff',
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '10px'
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Profile */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '24px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
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
            Project Manager
          </p>
        </div>
        <ChevronRight size={16} color="var(--text-tertiary)" style={{ marginLeft: 'auto' }} />
      </div>
    </div>
  );
};

export default Sidebar;
