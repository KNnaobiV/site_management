import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Breadcrumb, Spinner, SearchableSelect, ChecklistEditor } from '../components';
import { Upload, X, ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const CreateWorkItemPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { plotId, workItemId } = useParams();
  const isEdit = Boolean(workItemId);
  const [loading, setLoading] = useState(false);
  const [fetchingPlot, setFetchingPlot] = useState(!!plotId);
  const [plot, setPlot] = useState(null);
  const [error, setError] = useState(null);
  const [plotsList, setPlotsList] = useState([]);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    construction_phase: '',
    foreman: '',
    description: '',
    proposed_start_date: new Date().toISOString().split('T')[0],
    proposed_end_date: '',
    start_date: '',
    end_date: '',
    priority: 'Medium',
    initial_progress: 0,
    work_status: 'Planned',
    checklist: []
  });

  useEffect(() => {
    if (workItemId) {
      // edit mode: load existing work item
      (async () => {
        try {
          const res = await apiFetch(`/workitems/${workItemId}/`, { token });
          if (res.ok) {
            const data = await res.json();
            setFormData(f => ({
              ...f,
              name: data.name || '',
              construction_phase: data.construction_phase || '',
              foreman: data.foreman?.id || '',
              description: data.description || '',
              proposed_start_date: data.proposed_start_date || f.proposed_start_date,
              proposed_end_date: data.proposed_end_date || '',
              start_date: data.start_date || '',
              end_date: data.end_date || '',
              priority: data.priority || 'Medium',
              initial_progress: data.initial_progress || 0,
              work_status: data.work_status || 'Planned',
              checklist: data.checklist || []
            }));

            // Prepopulate options with existing foreman
            if (data.foreman) {
              setUsers([{ id: data.foreman.id, label: data.foreman.username, avatar: data.foreman.avatar_url || null }]);
            }

            // fetch plot to show address
            const plid = data.construction_plot;
            if (plid) {
              const pRes = await apiFetch(`/plots/${plid}/`, { token });
              if (pRes.ok) setPlot(await pRes.json());
            }
          }
        } catch (err) { console.error('Failed to fetch workitem for editing', err); }
        setFetchingPlot(false);
      })();
    } else {
      fetchPlots();
    }
  }, [plotId]);

  const fetchPlot = async () => {
    try {
      const res = await apiFetch(`/plots/${plotId}/`, { token });
      if (res.ok) {
        const data = await res.json();
        setPlot(data);
      }
    } catch (err) {
      console.error("Failed to fetch plot", err);
    } finally {
      setFetchingPlot(false);
    }
  };

  const fetchPlots = async () => {
    try {
      const res = await apiFetch('/plots/', { token });
      if (res.ok) {
        const data = await res.json();
        setPlotsList(unwrapList(data).map(p => ({ id: p.id, label: p.address, projectId: p.construction_project })));
      }
    } catch (err) {
      console.error("Failed to fetch plots", err);
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
      name: formData.name,
      description: formData.description,
      proposed_start_date: formData.proposed_start_date,
      proposed_end_date: formData.proposed_end_date,
      work_status: formData.work_status,
      checklist: formData.checklist,
    };
    if (formData.start_date) payload.start_date = formData.start_date;
    if (formData.end_date) payload.end_date = formData.end_date;

    try {
      const targetPlotId = plotId || formData.construction_plot;
      const targetProjectId = plot?.construction_project || plotsList.find(p => p.id === formData.construction_plot)?.projectId;

      const res = await apiFetch(`/projects/${targetProjectId}/plots/${targetPlotId}/workitems/`, {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccessMessage("Work item created successfully!");
        navigate(`/plots/${targetPlotId}`);
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

  if (fetchingPlot) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[
          { label: 'Projects', path: '/projects' },
          { label: plot?.project_name || 'Project', path: `/projects/${plot?.construction_project}` },
          { label: plot?.address || 'Plot', path: `/plots/${plotId}` },
          { label: 'New Work Item' }
        ]} />
        <h1 style={{ fontSize: '64px', marginTop: '12px' }}>Create Work Item</h1>
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
              <label style={labelStyle}>Title *</label>
              <input
                type="text"
                placeholder="Enter work item title"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Assigned Foreman *</label>
                <SearchableSelect
                  options={users}
                  value={formData.foreman}
                  onChange={val => setFormData({...formData, foreman: val})}
                  onSearch={handleSearchUsers}
                  placeholder="Select foreman"
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                placeholder="Describe the work, scope, materials, and any important details..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                style={{ ...inputStyle, minHeight: '180px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Checklist</label>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>Build a checklist to track work completion.</p>
              <ChecklistEditor
                items={formData.checklist}
                onChange={items => setFormData({ ...formData, checklist: items })}
              />
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Parent Plot *</label>
              {plotId ? (
                <input
                  type="text"
                  disabled
                  value={plot?.address || 'Plot Address'}
                  style={{ ...inputStyle, background: 'var(--bg-canvas)', cursor: 'not-allowed' }}
                />
              ) : (
                <SearchableSelect
                  options={plotsList}
                  value={formData.construction_plot}
                  onChange={val => setFormData({ ...formData, construction_plot: val })}
                  placeholder="Select plot"
                />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Start Date *</label>
                <input
                  type="date"
                  required
                  value={formData.proposed_start_date}
                  onChange={e => setFormData({ ...formData, proposed_start_date: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Target End Date *</label>
                <input
                  type="date"
                  required
                  value={formData.proposed_end_date}
                  onChange={e => setFormData({ ...formData, proposed_end_date: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Actual Start <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="date"
                  value={formData.start_date}
                  disabled={isEdit && !!formData.start_date}
                  onChange={e => setFormData({...formData, start_date: e.target.value})}
                  style={{
                    ...inputStyle,
                    background: isEdit && !!formData.start_date ? 'var(--bg-canvas)' : inputStyle.background,
                    cursor: isEdit && !!formData.start_date ? 'not-allowed' : 'text'
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Actual End <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData({...formData, end_date: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Priority *</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Low', 'Medium', 'High', 'Urgent'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormData({...formData, priority: p})}
                    style={{
                      flex: 1,
                      padding: '12px 0',
                      borderRadius: '10px',
                      border: '1px solid var(--border-default)',
                      background: formData.priority === p ? 'var(--brand-orange)' : 'var(--bg-raised)',
                      color: formData.priority === p ? 'white' : 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '14px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Initial Progress *</label>
                <span style={{ fontWeight: 600 }}>{formData.initial_progress}%</span>
              </div>
              <div>
                <label style={labelStyle}>Actual End <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

          </div>

          <div>
            <label style={labelStyle}>Status *</label>
            <select
              value={formData.work_status}
              onChange={e => setFormData({ ...formData, work_status: e.target.value })}
              style={inputStyle}
            >
              <option value="Planned">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Reference Photos</label>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>Upload photos, drawings, or references.</p>
            <div style={{ ...dropzoneStyle, height: '160px' }}>
              <ImageIcon size={32} color="var(--border-strong)" style={{ marginBottom: '16px' }} />
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Drag and drop files here</p>
              <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>or</p>
              <button type="button" className="btn-ghost" style={{ padding: '8px 24px', fontSize: '14px' }}>Choose Files</button>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '12px' }}>JPG, PNG, PDF up to 25MB each</p>
            </div>
          </div>
        </div>

        {
    error && (
      <div style={{ marginTop: '24px', color: 'var(--status-delayed)', fontSize: '14px' }}>
        {error}
      </div>
    )
  }

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '48px' }}>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: '12px 32px' }}>Cancel</button>
          <button type="submit" className="btn-primary" style={{ padding: '12px 48px' }} disabled={loading}>
            {loading ? <Spinner size={20} /> : (typeof window !== 'undefined' && window.location.pathname.includes('/edit') ? 'Update Work Item' : 'Create Work Item')}
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
  borderRadius: '16px',
  border: '2px dashed var(--border-default)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-raised)',
  transition: 'all 0.2s'
};

export default CreateWorkItemPage;
