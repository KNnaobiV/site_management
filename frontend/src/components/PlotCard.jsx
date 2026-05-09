import React from 'react';
import StatusBadge from './StatusBadge';
import Avatar from './Avatar';
import { MapPin, User, Calendar } from 'lucide-react';

const PlotCard = ({ plot, onClick }) => {
  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
      <div style={{ 
        height: '140px', 
        background: '#eee',
        backgroundImage: `url(https://api.mapbox.com/styles/v1/mapbox/light-v10/static/pin-s+c14a1e(3.38,6.45)/3.38,6.45,14/400x200?access_token=pk.placeholder)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
          <StatusBadge status="Planned" />
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '20px', marginBottom: '4px' }}>{plot.address}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>Project: {plot.project_name || 'Project Name'}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <MapPin size={14} color="var(--brand-orange)" />
            <span>Lagos, Nigeria</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar name="Foreman" size={24} />
              <div style={{ fontSize: '11px' }}>
                <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>Foreman</p>
                <p style={{ margin: 0, fontWeight: 500 }}>J. Adeyemi</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar name="Storekeeper" size={24} />
              <div style={{ fontSize: '11px' }}>
                <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>Storekeeper</p>
                <p style={{ margin: 0, fontWeight: 500 }}>M. Bello</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlotCard;
