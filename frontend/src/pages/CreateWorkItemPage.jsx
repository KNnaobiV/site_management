import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Breadcrumb, Spinner, SearchableSelect } from '../components';
import { Upload, X, ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList, formatApiError } from '../api/client';
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

  const [workItemData, setWorkItemData] = useState(null);
  const [isProgressManual, setIsProgressManual] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: new Date().toISOString().split('T')[0],
    priority: 'Medium',
    work_status: 'Planned',
    budget_amount: '',
    budget_currency: 'NGN',
    manual_progress: 0,
  });

  useEffect(() => {
    if (workItemId) {
      // edit mode: load existing work item
      (async () => {
        try {
          const res = await apiFetch(`/workitems/${workItemId}/`, { token });
          if (res.ok) {
            const data = await res.json();
            setWorkItemData(data);
            setIsProgressManual(!!data.is_progress_manual);
            setCurrentProgress(data.progress || 0);
            setFormData(f => ({
              ...f,
              name: data.name || '',
              description: data.description || '',
              start_date: data.start_date || f.start_date,
              target_end_date: data.target_end_date || '',
              priority: data.priority || 'Medium',
              work_status: data.work_status || 'Planned',
              manual_progress: data.manual_progress !== null && data.manual_progress !== undefined ? data.manual_progress : (data.progress || 0),
            }));


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
    } else if (plotId) {
      fetchPlot();
    } else {
      fetchPlots();
    }
  }, [plotId, workItemId]);

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
    if (!query) {
      setUsers([]);
      return;
    }
    try {
      const res = await apiFetch(`/auth/users/?search=${encodeURIComponent(query)}`, { token });
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

    const targetPlotId = plotId || formData.construction_plot;
    const targetProjectId = plot?.construction_project?.id || plot?.construction_project || plotsList.find(p => p.id === formData.construction_plot)?.projectId;

    const canSetProgress = isEdit && (plot?.role === 'owner' || plot?.role === 'project_manager');

    const payload = {
      name: formData.name,
      description: formData.description,
      start_date: formData.start_date,
      target_end_date: formData.target_end_date,
      work_status: formData.work_status,
      construction_plot: targetPlotId,
    };

    if (isEdit && canSetProgress) {
      payload.manual_progress = isProgressManual ? parseInt(formData.manual_progress || 0) : null;
    }

    try {
      const url = isEdit
        ? `/workitems/${workItemId}/`
        : (targetProjectId
            ? `/projects/${targetProjectId}/plots/${targetPlotId}/workitems/`
            : `/workitems/`);
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        token,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showSuccessMessage(isEdit ? "Work updated successfully!" : "Work created successfully!");
        if (isEdit) {
          navigate(`/work-items/${workItemId}`);
        } else {
          navigate(`/plots/${targetPlotId}`);
        }
      } else {
        const data = await res.json();
        setError(formatApiError(data));
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
          { label: isEdit ? 'Edit Work' : 'New Work' }
        ]} />
        <h1 style={{ fontSize: '64px', marginTop: '12px' }}>{isEdit ? 'Edit Work' : 'Create Work'}</h1>
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
              <label style={labelStyle}>Title <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <input
                type="text"
                placeholder="Enter work title"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
              />
            </div>



            <div>
              <label style={labelStyle}>Description <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <textarea
                required
                placeholder="Describe the work, scope, materials, and any important details..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                style={{ ...inputStyle, minHeight: '180px', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Parent Plot <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
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

            <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Start Date <span style={{ color: "var(--brand-orange)" }}>*</span></label>
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Target End Date <span style={{ color: "var(--brand-orange)" }}>*</span></label>
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
              <label style={labelStyle}>Priority <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Low', 'Medium', 'High', 'Urgent'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p })}
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

            {/* Progress Section (Edit Mode) */}
            {isEdit && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--border-default)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Work Progress <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
                    <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                      {isProgressManual ? 'Manual Override active' : 'Calculated automatically from jobs'}
                    </span>
                  </div>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-orange)' }}>
                    {isProgressManual ? (formData.manual_progress ?? 0) : currentProgress}%
                  </span>
                </div>

                {(plot?.role === 'owner' || plot?.role === 'project_manager') ? (
                  <div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProgressManual(false);
                          setFormData(f => ({ ...f, manual_progress: null }));
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-default)',
                          background: !isProgressManual ? 'var(--brand-orange)' : 'var(--bg-raised)',
                          color: !isProgressManual ? 'white' : 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Automatic ({currentProgress}%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProgressManual(true);
                          setFormData(f => ({
                            ...f,
                            manual_progress: f.manual_progress !== null && f.manual_progress !== undefined ? f.manual_progress : currentProgress
                          }));
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-default)',
                          background: isProgressManual ? 'var(--brand-orange)' : 'var(--bg-raised)',
                          color: isProgressManual ? 'white' : 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Manual Override
                      </button>
                    </div>

                    {isProgressManual && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Set Progress Percentage:</span>
                          <span style={{ fontWeight: 700 }}>{formData.manual_progress ?? 0}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={formData.manual_progress ?? 0}
                          onChange={e => setFormData({ ...formData, manual_progress: parseInt(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--brand-orange)', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          <span>0%</span>
                          <span>50%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                    Only the Project Manager or Creator can override progress.
                  </p>
                )}
              </div>
            )}

            <div>
              <label style={labelStyle}>Status <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <select
                required
                value={formData.work_status}
                onChange={e => setFormData({ ...formData, work_status: e.target.value })}
                style={inputStyle}
              >
                {['Planned', 'In Progress', 'On Hold', 'Delayed', 'Cancelled'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Budget */}
            <div>
              <label style={labelStyle}>Budget <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2,000,000"
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
          <div style={{ marginTop: '24px', color: 'var(--status-delayed)', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '48px' }}>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: '12px 32px' }}>Cancel</button>
          <button type="submit" className="btn-primary" style={{ padding: '12px 48px' }} disabled={loading}>
            {loading ? <Spinner size={20} /> : (typeof window !== 'undefined' && window.location.pathname.includes('/edit') ? 'Update Work' : 'Create Work')}
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



export default CreateWorkItemPage;
