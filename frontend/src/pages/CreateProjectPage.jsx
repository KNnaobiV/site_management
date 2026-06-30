import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, Spinner, SearchableSelect } from '../components';
import { Upload, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const CreateProjectPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const isEditing = !!projectId;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [clientUpdated, setClientUpdated] = useState(false);
  
  const [formData, setFormData] = useState({
    project_name: '',
    client: '',
    project_description: '',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: '',
    project_manager: '',
    address: '',
    project_status: 'Planned',
    cover_image: null
  });

  useEffect(() => {
    if (isEditing) {
      fetchProject();
    }
  }, []);

  const fetchProject = async () => {
    try {
      const res = await apiFetch(`/projects/${projectId}/`, { token });
      if (res.ok) {
        const project = await res.json();
        const hasClient = !!project.client;
        setFormData({
          project_name: project.project_name || '',
          client: project.client?.id || '',
          project_description: project.project_description || '',
          project_status: project.project_status || 'Planned',
          start_date: project.start_date || new Date().toISOString().split('T')[0],
          target_end_date: project.target_end_date || '',
          project_manager: project.project_manager?.id || '',
          address: project.address || '',
          cover_image: null
        });
        
        // Ensure the selected users are prepopulated in the searchable options
        const initialUsers = [];
        if (project.client) {
          initialUsers.push({ id: project.client.id, label: project.client.username, avatar: project.client.avatar_url || null });
        }
        if (project.project_manager) {
          initialUsers.push({ id: project.project_manager.id, label: project.project_manager.username, avatar: project.project_manager.avatar_url || null });
        }
        if (initialUsers.length > 0) {
          setUsers(initialUsers);
        }
        setClientUpdated(hasClient);
      } else {
        setError('Failed to load project for editing.');
      }
    } catch (err) {
      setError('Connection error while loading project.');
    } finally {
      setFetching(false);
    }
  };

  const handleSearchUsers = async (query) => {
    try {
      const res = await apiFetch(`/auth/users/search/?q=${encodeURIComponent(query)}`, { token });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.map(u => ({ id: u.id, label: u.username, avatar: u.avatar_url || null })));
      }
    } catch (err) {
      console.error("Failed to search users", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      project_name: formData.project_name,
      project_description: formData.project_description,
      project_status: formData.project_status,
      start_date: formData.start_date,
      target_end_date: formData.target_end_date,
      address: formData.address,
      project_manager: formData.project_manager || null,
      client: formData.client || null,
    };

    let bodyData;
    if (formData.cover_image) {
      bodyData = new FormData();
      Object.keys(payload).forEach(key => {
        if (payload[key] !== null) bodyData.append(key, payload[key]);
      });
      bodyData.append('cover_image', formData.cover_image);
    } else {
      bodyData = JSON.stringify(payload);
    }

    try {
      const res = await apiFetch(isEditing ? `/projects/${projectId}/` : '/projects/', {
        method: isEditing ? 'PUT' : 'POST',
        token,
        body: bodyData,
      });

      if (res.ok) {
        showSuccessMessage(isEditing ? "Project updated successfully!" : "Project created successfully!");
        navigate('/projects');
      } else {
        const data = await res.json();
        setError(Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(', '));
      }
    } catch (err) {
      setError("A connection error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[{ label: 'Projects', path: '/projects' }, { label: isEditing ? 'Edit Project' : 'New Project' }]} />
        <h1 style={{ fontSize: '64px', marginTop: '12px' }}>{isEditing ? 'Edit Project' : 'Create Project'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="mobile-padding" style={{ 
        background: 'var(--bg-card)', 
        borderRadius: '24px', 
        border: '1px solid var(--border-default)',
        padding: '48px',
        maxWidth: '1200px'
      }}>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Project Name</label>
              <input 
                type="text" 
                placeholder="Enter project name"
                required
                value={formData.project_name}
                onChange={e => setFormData({...formData, project_name: e.target.value})}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Address</label>
              <textarea 
                placeholder="Enter project address"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                disabled={isEditing && clientUpdated}
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
              />
            </div>

            <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Start Date *</label>
                <input 
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={e => setFormData({...formData, start_date: e.target.value})}
                  disabled={isEditing && clientUpdated}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Target End Date *</label>
                <input 
                  type="date"
                  required
                  value={formData.target_end_date}
                  onChange={e => setFormData({...formData, target_end_date: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select 
                value={formData.project_status}
                onChange={e => setFormData({...formData, project_status: e.target.value})}
                style={inputStyle}
              >
                {['Planned', 'In Progress', 'Completed', 'On Hold', 'Delayed', 'Cancelled'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea 
                placeholder="Enter project description"
                value={formData.project_description}
                onChange={e => setFormData({...formData, project_description: e.target.value})}
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Cover Image</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={e => {
                  if (e.target.files.length > 0) {
                    setFormData({...formData, cover_image: e.target.files[0]});
                  }
                }}
                style={inputStyle}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                Optional. JPG, PNG or WEBP up to 10MB
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '24px', color: 'var(--status-delayed)', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '48px' }}>
          <button type="button" onClick={() => navigate('/projects')} className="btn-ghost" style={{ padding: '12px 32px' }}>Cancel</button>
          <button type="submit" className="btn-primary" style={{ padding: '12px 48px' }} disabled={loading}>
            {loading ? <Spinner size={20} /> : (isEditing ? 'Update Project' : 'Create Project')}
          </button>
        </div>
      </form>
    </div>
  );
};

const labelStyle = {
  display: 'block',
  marginBottom: '10px',
  fontWeight: 600,
  fontSize: '15px',
  color: 'var(--text-primary)'
};

const inputStyle = {
  width: '100%',
  padding: '16px',
  borderRadius: '12px',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-raised)',
  color: 'var(--text-primary)',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s'
};



export default CreateProjectPage;
