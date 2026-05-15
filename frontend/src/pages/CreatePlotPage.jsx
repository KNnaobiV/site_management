import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, Spinner, SearchableSelect } from '../components';
import { Upload, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const CreatePlotPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [loading, setLoading] = useState(false);
  const [fetchingProject, setFetchingProject] = useState(!!projectId);
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  
  const [formData, setFormData] = useState({
    plot_number: '',
    plot_name: '',
    construction_project: projectId || '',
    address: '',
    gps_latitude: '',
    gps_longitude: '',
    status: 'Planned',
    foreman: '',
    plot_opening_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: ''
  });

  useEffect(() => {
    if (projectId) {
      setFormData(prev => ({ ...prev, construction_project: projectId }));
      fetchProject();
    } else {
      fetchProjects();
    }
    fetchUsers();
  }, [projectId]);

  const fetchProjects = async () => {
    try {
      const res = await apiFetch('/projects/', { token });
      if (res.ok) {
        const data = await res.json();
        setProjectsList(unwrapList(data).map(p => ({ id: p.id, label: p.project_name })));
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  const fetchProject = async () => {
    try {
      const res = await apiFetch(`/projects/${projectId}/`, { token });
      if (res.ok) {
        const data = await res.json();
        setProject(data);
      }
    } catch (err) {
      console.error("Failed to fetch project", err);
    } finally {
      setFetchingProject(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/auth/users/search/?q= ', { token });
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
      construction_project: formData.construction_project,
      plot_number: formData.plot_number,
      address: formData.address,
      plot_opening_date: formData.plot_opening_date,
      gps_latitude: formData.gps_latitude || null,
      gps_longitude: formData.gps_longitude || null,
      notes: formData.notes,
      foreman: formData.foreman || null,
    };

    try {
      const res = await apiFetch(`/projects/${formData.construction_project}/plots/`, {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccessMessage("Plot created successfully!");
        navigate(`/projects/${formData.construction_project}`);
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

  if (fetchingProject) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[
          { label: 'Projects', path: '/projects' }, 
          { label: project?.project_name || 'Project', path: `/projects/${projectId}` },
          { label: 'New Plot' }
        ]} />
        <h1 style={{ fontSize: '64px', marginTop: '12px' }}>Create Plot</h1>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Plot Number *</label>
                <input 
                  type="text" 
                  placeholder="Enter plot number"
                  required
                  value={formData.plot_number}
                  onChange={e => setFormData({...formData, plot_number: e.target.value})}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Plot Name *</label>
                <input 
                  type="text" 
                  placeholder="Enter plot name"
                  value={formData.plot_name}
                  onChange={e => setFormData({...formData, plot_name: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Parent Project *</label>
              {projectId ? (
                <input 
                  type="text"
                  disabled
                  value={project?.project_name || 'Project Name'}
                  style={{ ...inputStyle, background: 'var(--bg-canvas)', cursor: 'not-allowed' }}
                />
              ) : (
                <SearchableSelect 
                  options={projectsList}
                  value={formData.construction_project}
                  onChange={val => setFormData({...formData, construction_project: val})}
                  placeholder="Select project"
                />
              )}
            </div>

            <div>
              <label style={labelStyle}>Address</label>
              <textarea 
                placeholder="Enter site address"
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Status *</label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value})}
                  style={inputStyle}
                >
                  <option value="Planned">Planned</option>
                  <option value="In Progress">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Assigned Foreman</label>
                <SearchableSelect 
                  options={users}
                  value={formData.foreman}
                  onChange={val => setFormData({...formData, foreman: val})}
                  placeholder="Select foreman"
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={labelStyle}>GPS Coordinates *</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <MapPin size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px', top: '18px' }} />
                  <input 
                    type="text"
                    placeholder="Latitude (e.g. 40.7128)"
                    value={formData.gps_latitude}
                    onChange={e => setFormData({...formData, gps_latitude: e.target.value})}
                    style={{ ...inputStyle, paddingLeft: '44px' }}
                  />
                </div>
                <div style={{ position: 'relative', flex: 1 }}>
                  <MapPin size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px', top: '18px' }} />
                  <input 
                    type="text"
                    placeholder="Longitude (e.g. -74.0060)"
                    value={formData.gps_longitude}
                    onChange={e => setFormData({...formData, gps_longitude: e.target.value})}
                    style={{ ...inputStyle, paddingLeft: '44px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Estimated Start Date</label>
                <input 
                  type="date"
                  value={formData.plot_opening_date}
                  onChange={e => setFormData({...formData, plot_opening_date: e.target.value})}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Estimated End Date</label>
                <input 
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData({...formData, end_date: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Notes</label>
              <textarea 
                placeholder="Add any additional notes about this plot"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Site Photos</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                <div style={{ ...dropzoneSmallStyle, borderStyle: 'dashed' }}>
                  <Upload size={20} color="var(--brand-orange)" />
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '4px' }}>Upload Photos</span>
                </div>
                {[1,2,3,4].map(i => (
                  <div key={i} style={dropzoneSmallStyle}>
                    <span style={{ fontSize: '24px', color: 'var(--border-strong)' }}>+</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ 
            marginTop: '24px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid var(--status-delayed)', 
            color: 'var(--status-delayed)', 
            padding: '20px', 
            borderRadius: '12px',
            fontSize: '14px'
          }}>
            <p style={{ fontWeight: 700, margin: '0 0 10px' }}>The plot could not be created:</p>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {error.split(', ').map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '48px' }}>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: '12px 32px' }}>Cancel</button>
          <button type="submit" className="btn-primary" style={{ padding: '12px 48px' }} disabled={loading}>
            {loading ? <Spinner size={20} /> : 'Create Plot'}
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

const dropzoneSmallStyle = {
  aspectRatio: '1',
  borderRadius: '12px',
  border: '2px solid var(--border-default)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-raised)',
  cursor: 'pointer'
};

export default CreatePlotPage;
