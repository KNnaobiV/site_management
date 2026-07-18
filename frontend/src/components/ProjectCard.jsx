import React from 'react';
import StatusBadge from './StatusBadge';
import Avatar from './Avatar';
import { Calendar, Users } from 'lucide-react';

const ProjectCard = ({ project, onClick }) => {
  const progress = project.progress || 0;

  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
      {/* Thumbnail */}
      <div style={{ 
        height: '160px', 
        background: '#e0e0e0', 
        position: 'relative',
        backgroundImage: `url(https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=800)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
        <div style={{ position: 'absolute', top: '16px', left: '16px' }}>
          <StatusBadge status={project.project_status} />
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>{project.project_name}</h3>
        <p style={{ fontSize: '14px', marginBottom: '16px' }}>Client: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{project.client_name || 'N/A'}</span></p>
        
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Overall Progress</span>
            <span style={{ fontWeight: 600 }}>{progress}%</span>
          </div>
          <div style={{ height: '6px', background: 'var(--bg-raised)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${progress}%`, 
              height: '100%', 
              background: 'var(--brand-orange)',
              borderRadius: '3px'
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
            <Calendar size={14} />
            <span>Due: {project.proposed_end_date || 'TBD'}</span>
          </div>
          
          <div style={{ display: 'flex', marginLeft: 'auto' }}>
            {[1, 2, 3].map((_, i) => (
              <div key={i} style={{ marginLeft: i === 0 ? 0 : -8, border: '2px solid #fff', borderRadius: '50%' }}>
                <Avatar name={`User ${i}`} size={24} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
