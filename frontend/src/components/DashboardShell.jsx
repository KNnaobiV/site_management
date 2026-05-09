import React from 'react';
import Sidebar from './Sidebar';

const DashboardShell = ({ children }) => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      <Sidebar />
      <main style={{ 
        flex: 1, 
        marginLeft: '280px', 
        padding: '48px 64px',
        minHeight: '100vh'
      }}>
        {children}
      </main>
    </div>
  );
};

export default DashboardShell;
