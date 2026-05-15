import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, Spinner, SearchableSelect } from '../components';
import { Upload, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const CreateProjectPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  
  const [formData, setFormData] = useState({
    project_name: '',
    client: '',
    project_description: '',
    project_status: 'Planned',
    proposed_start_date: new Date().toISOString().split('T')[0],
    proposed_end_date: '',
    project_manager: '',
    foreman: '',
    address: '',
    cover_image: null
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // For now fetching a broad list, or we could use the search endpoint
      // Let's try to get some users for the selectors
      const res = await apiFetch('/auth/users/search/?q= ', { token }); // empty space to get some users
      if (res.ok) {
        const data = await res.json();
        setUsers(data.map(u => ({ id: u.id, label: u.username, avatar: u.avatar_url || null })));
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
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
      proposed_start_date: formData.proposed_start_date,
      proposed_end_date: formData.proposed_end_date || null,
      address: formData.address,
      // The backend expects project_manager and client as IDs
      project_manager: formData.project_manager || null,
      client: formData.client || null,
    };

    try {
      const res = await apiFetch('/projects/', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccessMessage("Project created successfully!");
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

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[{ label: 'Projects', path: '/projects' }, { label: 'New Project' }]} />
        <h1 style={{ fontSize: '64px', marginTop: '12px' }}>Create Project</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ 
        background: 'var(--bg-card)', 
        borderRadius: '24px', 
        border: '1px solid var(--border-default)',
        padding: '48px',
        maxWidth: '1200px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
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
              <label style={labelStyle}>Client</label>
              <SearchableSelect 
                options={users}
                value={formData.client}
                onChange={val => setFormData({...formData, client: val})}
                placeholder="Select client"
              />
            </div>

            <div>
              <label style={labelStyle}>Address</label>
              <textarea 
                placeholder="Enter project address"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input 
                  type="date"
                  value={formData.proposed_start_date}
                  onChange={e => setFormData({...formData, proposed_start_date: e.target.value})}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input 
                  type="date"
                  value={formData.proposed_end_date}
                  onChange={e => setFormData({...formData, proposed_end_date: e.target.value})}
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
                <option value="Planned">Planning</option>
                <option value="In Progress">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                Planning / Active / On Hold / Completed
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Project Manager</label>
              <SearchableSelect 
                options={users}
                value={formData.project_manager}
                onChange={val => setFormData({...formData, project_manager: val})}
                placeholder="Select project manager"
              />
            </div>

            <div>
              <label style={labelStyle}>Foreman</label>
              <SearchableSelect 
                options={users}
                value={formData.foreman}
                onChange={val => setFormData({...formData, foreman: val})}
                placeholder="Select foreman"
              />
            </div>

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
              <div style={dropzoneStyle}>
                <Upload size={32} color="var(--brand-orange)" style={{ marginBottom: '16px' }} />
                <p style={{ margin: 0, fontWeight: 500 }}>Drag and drop an image here</p>
                <p style={{ margin: '4px 0 0', color: 'var(--brand-orange)', cursor: 'pointer' }}>or click to browse</p>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '12px' }}>JPG, PNG or WEBP up to 10MB</p>
              </div>
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
            {loading ? <Spinner size={20} /> : 'Create Project'}
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

const dropzoneStyle = {
  width: '100%',
  height: '180px',
  borderRadius: '16px',
  border: '2px dashed var(--border-default)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-raised)',
  transition: 'all 0.2s'
};

export default CreateProjectPage;
