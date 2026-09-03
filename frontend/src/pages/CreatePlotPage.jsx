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
  const { projectId, plotId } = useParams();
  const isEditing = !!plotId;
  const [loading, setLoading] = useState(false);
  const [fetchingProject, setFetchingProject] = useState(!!projectId);
  const [fetchingPlot, setFetchingPlot] = useState(isEditing);
  const [project, setProject] = useState(null);
  const [plot, setPlot] = useState(null);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [fieldsUpdated, setFieldsUpdated] = useState(false);
  const [formData, setFormData] = useState({
    plot_name: '',
    construction_project: projectId || '',
    address: '',
    gps_latitude: '',
    gps_longitude: '',
    status: 'Planned',
    foreman: '',
    storekeeper: '',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: '',
    notes: '',
    budget_amount: '',
    budget_currency: 'NGN',
  });

  useEffect(() => {
    if (projectId) {
      setFormData(prev => ({ ...prev, construction_project: projectId }));
      fetchProject();
    } else {
      fetchProjects();
    }
    if (isEditing) {
      fetchPlot();
    }
  }, [projectId, plotId]);

  const fetchPlot = async () => {
    try {
      const res = await apiFetch(`/plots/${plotId}/`, { token });
      if (res.ok) {
        const plotData = await res.json();
        setFormData({
          plot_name: plotData.plot_name || '',
          construction_project: plotData.construction_project?.id || '',
          address: plotData.address || '',
          gps_latitude: plotData.gps_latitude || '',
          gps_longitude: plotData.gps_longitude || '',
          status: plotData.status || 'Planned',
          foreman: plotData.foreman?.id || '',
          storekeeper: plotData.storekeeper?.id || '',
          start_date: plotData.start_date || new Date().toISOString().split('T')[0],
          target_end_date: plotData.target_end_date || '',
          notes: plotData.notes || ''
        });

        // Prepopulate users select list with the existing foreman and storekeeper
        const initialUsers = [];
        if (plotData.foreman) {
          initialUsers.push({ id: plotData.foreman.id, label: plotData.foreman.username, avatar: plotData.foreman.avatar_url || null });
        }
        if (plotData.storekeeper) {
          initialUsers.push({ id: plotData.storekeeper.id, label: plotData.storekeeper.username, avatar: plotData.storekeeper.avatar_url || null });
        }
        if (initialUsers.length > 0) {
          setUsers(initialUsers);
        }

        const hasValues = !!(plotData.plot_number || plotData.plot_name || plotData.address || plotData.construction_project);
        setFieldsUpdated(hasValues);
      } else {
        setError('Failed to load plot for editing.');
      }
    } catch (err) {
      setError('Connection error while loading plot.');
    } finally {
      setFetchingPlot(false);
    }
  };

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

  const handleSearchUsers = async (query) => {
    try {
      const targetProjectId = projectId || formData.construction_project;
      let url = `/auth/users/search/?q=${encodeURIComponent(query)}`;
      if (targetProjectId) {
        url += `&project_id=${targetProjectId}`;
      }
      const res = await apiFetch(url, { token });
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
      construction_project: formData.construction_project,
      address: formData.address,
      start_date: formData.start_date,
      target_end_date: formData.target_end_date,
      gps_latitude: formData.gps_latitude || null,
      gps_longitude: formData.gps_longitude || null,
      notes: formData.notes,
      foreman: formData.foreman || null,
      storekeeper: formData.storekeeper || null,
    };

    try {
      const url = isEditing ? `/plots/${plotId}/` : `/projects/${formData.construction_project}/plots/`;
      const method = isEditing ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        token,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const savedPlot = await res.json();
        if (formData.budget_amount && parseFloat(formData.budget_amount) > 0) {
          await apiFetch(`/plots/${savedPlot.id}/budget/`, {
            method: 'PATCH',
            token,
            body: JSON.stringify({ allocated_amount: parseFloat(formData.budget_amount), currency: formData.budget_currency }),
          });
        }
        const savedPlot = await res.json();
        if (formData.budget_amount && parseFloat(formData.budget_amount) > 0) {
          await apiFetch(`/plots/${savedPlot.id}/budget/`, {
            method: 'PATCH',
            token,
            body: JSON.stringify({ allocated_amount: parseFloat(formData.budget_amount), currency: formData.budget_currency }),
          });
        }
        showSuccessMessage(isEditing ? "Plot updated successfully!" : "Plot created successfully!");
        if (isEditing) {
          navigate(`/plots/${plotId}`);
        } else {
          navigate(`/projects/${formData.construction_project}`);
        }
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

  if (fetchingProject || fetchingPlot) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[
          { label: 'Projects', path: '/projects' },
          { label: project?.project_name || 'Project', path: `/projects/${projectId}` },
          { label: isEditing ? 'Edit Plot' : 'New Plot' }
        ]} />
        <h1 style={{ fontSize: '64px', marginTop: '12px' }}>{isEditing ? 'Edit Plot' : 'Create Plot'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="mobile-padding" style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        border: '1px solid var(--border-default)',
        padding: '48px',
        maxWidth: '1200px'
      }}>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
          <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Plot Number *</label>
                    <input
                      type="text"
                      placeholder="Enter plot number"
                      required
                      value={formData.plot_number}
                      onChange={e => setFormData({ ...formData, plot_number: e.target.value })}
                      disabled={isEditing && fieldsUpdated}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Plot Name *</label>
                    <input
                      type="text"
                      placeholder="Enter plot name"
                      value={formData.plot_name}
                      onChange={e => setFormData({ ...formData, plot_name: e.target.value })}
                      disabled={isEditing && fieldsUpdated}
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
                      onChange={val => setFormData({ ...formData, construction_project: val })}
                      placeholder="Select project"
                      disabled={isEditing && fieldsUpdated}
                    />
                  )}
                </div>

                <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={labelStyle}>Foreman</label>
                      <SearchableSelect
                        options={users}
                        value={formData.foreman}
                        onChange={val => setFormData({ ...formData, foreman: val })}
                        onSearch={handleSearchUsers}
                        placeholder="Select foreman"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Storekeeper</label>
                      <SearchableSelect
                        options={users}
                        value={formData.storekeeper}
                        onChange={val => setFormData({ ...formData, storekeeper: val })}
                        onSearch={handleSearchUsers}
                        placeholder="Select storekeeper"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Address</label>
                    <textarea
                      placeholder="Enter site address"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      disabled={isEditing && fieldsUpdated}
                      style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Status *</label>
                    <select
                      required
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
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
                    <label style={labelStyle}>GPS Coordinates</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <MapPin size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px', top: '18px' }} />
                        <input
                          type="text"
                          placeholder="Latitude (e.g. 40.7128)"
                          value={formData.gps_latitude}
                          onChange={e => setFormData({ ...formData, gps_latitude: e.target.value })}
                          style={{ ...inputStyle, paddingLeft: '44px' }}
                        />
                      </div>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <MapPin size={16} color="var(--text-tertiary)" style={{ position: 'absolute', left: '16px', top: '18px' }} />
                        <input
                          type="text"
                          placeholder="Longitude (e.g. -74.0060)"
                          value={formData.gps_longitude}
                          onChange={e => setFormData({ ...formData, gps_longitude: e.target.value })}
                          style={{ ...inputStyle, paddingLeft: '44px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>Start Date *</label>
                        <input
                          type="date"
                          required
                          value={formData.start_date}
                          onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Target End Date *</label>
                        <input
                          type="date"
                          required
                          value={formData.target_end_date}
                          onChange={e => setFormData({ ...formData, target_end_date: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Notes</label>
                      <textarea
                        placeholder="Add any additional notes about this plot"
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                      />
                    </div>

                    {/* Budget */}
                    <div>
                      <label style={labelStyle}>Plot Budget <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span></label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g. 50,000,000"
                          value={formData.budget_amount}
                          onChange={e => setFormData({ ...formData, budget_amount: e.target.value })}
                          style={inputStyle}
                        />
                        <select
                          value={formData.budget_currency}
                          onChange={e => setFormData({ ...formData, budget_currency: e.target.value })}
                          style={{ ...inputStyle, width: '90px' }}
                        >
                          {['NGN', 'USD', 'GBP', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
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
                    {loading ? <Spinner size={20} /> : (isEditing ? 'Update Plot' : 'Create Plot')}
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



            export default CreatePlotPage;
