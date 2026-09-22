import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, Spinner, SearchableSelect, MaterialsEditor } from '../components';
import { Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList, formatApiError } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const CreateJobItemPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { workItemId, jobItemId } = useParams();
  const [loading, setLoading] = useState(false);
  const isEdit = !!jobItemId;
  const [fetchingWorkItem, setFetchingWorkItem] = useState(!!workItemId || !!jobItemId);
  const [workItem, setWorkItem] = useState(null);
  const [error, setError] = useState(null);
  const [workItemsList, setWorkItemsList] = useState([]);
  const [users, setUsers] = useState([]);

  const [jobItemData, setJobItemData] = useState(null);
  const [isProgressManual, setIsProgressManual] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);

  const [formData, setFormData] = useState({
    job_name: '',
    job_artisan: '',
    custom_artisan: '',
    job_description: '',
    job_status: 'Planned',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: '',
    work_item: '',
    budget_amount: '',
    budget_currency: 'NGN',
    manual_progress: 0,
  });

  useEffect(() => {
    if (jobItemId) {
      fetchJobItem();
    } else if (workItemId) {
      fetchWorkItem();
    } else {
      fetchWorkItems();
    }
  }, [workItemId, jobItemId]);

  const fetchJobItem = async () => {
    try {
      const res = await apiFetch(`/jobitems/${jobItemId}/`, { token });
      if (res.ok) {
        const data = await res.json();
        setJobItemData(data);
        setIsProgressManual(!!data.is_progress_manual);
        setCurrentProgress(data.progress || 0);
        setFormData(f => ({
          ...f,
          job_name: data.job_name || '',
          job_artisan: data.job_artisan || '',
          custom_artisan: data.custom_artisan || '',
          job_description: data.job_description || '',
          job_status: data.job_status || 'Planned',
          start_date: data.start_date || f.start_date,
          target_end_date: data.target_end_date || '',
          work_item: data.work_item || '',
          manual_progress: data.manual_progress !== null && data.manual_progress !== undefined ? data.manual_progress : (data.progress || 0),
        }));

        // If it returns work_item ID, we can fetch it to show breadcrumb
        if (data.work_item) {
          const wiRes = await apiFetch(`/workitems/${data.work_item}/`, { token });
          if (wiRes.ok) setWorkItem(await wiRes.json());
        }
      }
    } catch (err) {
      console.error("Failed to fetch job item for editing", err);
    } finally {
      setFetchingWorkItem(false);
    }
  };

  const fetchWorkItems = async () => {
    try {
      const res = await apiFetch('/workitems/', { token });
      if (res.ok) {
        const data = await res.json();
        setWorkItemsList(unwrapList(data).map(wi => ({
          id: wi.id,
          label: wi.name,
          plotId: wi.construction_plot,
          projectId: wi.construction_project // Assuming these are available in the workitem object
        })));
      }
    } catch (err) {
      console.error("Failed to fetch work items", err);
    }
  };

  const fetchWorkItem = async () => {
    try {
      // In our backend, work item is at /projects/{p}/plots/{pl}/workitems/{w}/
      // But we might have a top-level detail if we know the ID?
      // Let's assume we can fetch it via /work-items/{id}/ if it exists, or we need to find its parent IDs.
      // Looking at viewset, it's nested.
      // However, usually we can also have a non-nested retrieve. 
      // Let's check views again. WorkItemViewSet is PlotScopedMixin.
      // If we don't have project/plot IDs, we might need to fetch them first.

      // Let's try a generic fetch if available, or just fetch all work items and find it.
      // Or we can assume the URL has them if we restructure App.jsx routes.
      // Current route: /work-items/:workItemId/job-items/new
      // I should probably have: /projects/:projectId/plots/:plotId/work-items/:workItemId/job-items/new

      const res = await apiFetch(`/workitems/${workItemId}/`, { token });
      if (res.ok) {
        const data = await res.json();
        setWorkItem(data);
      }
    } catch (err) {
      console.error("Failed to fetch work item", err);
    } finally {
      setFetchingWorkItem(false);
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

    const canSetProgress = isEdit && (workItem?.role === 'owner' || workItem?.role === 'project_manager' || jobItemData?.role === 'owner' || jobItemData?.role === 'project_manager');

    const payload = {
      job_name: formData.job_name,
      job_artisan: formData.job_artisan,
      custom_artisan: formData.job_artisan === 'Other' ? formData.custom_artisan : '',
      job_description: formData.job_description,
      job_status: formData.job_status,
      start_date: formData.start_date,
      target_end_date: formData.target_end_date,
    };

    if (isEdit && canSetProgress) {
      payload.manual_progress = isProgressManual ? parseInt(formData.manual_progress || 0) : null;
    }

    try {
      const targetWiId = workItemId || formData.work_item || workItem?.id;
      const selectedWi = workItem || workItemsList.find(wi => wi.id === formData.work_item);
      const targetPlotId = selectedWi?.construction_plot || selectedWi?.plotId;
      const targetProjectId = selectedWi?.construction_project || selectedWi?.projectId;

      const url = isEdit ? `/jobitems/${jobItemId}/` : `/projects/${targetProjectId}/plots/${targetPlotId}/workitems/${targetWiId}/jobitems/`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        token,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        
        if (formData.budget_amount) {
          try {
            await apiFetch(`/jobitems/${data.id}/budget/`, {
              method: 'PATCH',
              token,
              body: JSON.stringify({
                allocated_amount: formData.budget_amount,
                currency: formData.budget_currency || 'NGN'
              })
            });
          } catch (e) {
            console.error("Failed to set budget", e);
          }
        }

        showSuccessMessage(isEdit ? "Job updated successfully!" : "Job created successfully!");
        if (isEdit) {
          navigate(`/job-items/${jobItemId}`);
        } else {
          navigate(`/work-items/${targetWiId}`);
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

  if (fetchingWorkItem) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[
          { label: 'Projects', path: '/projects' },
          { label: workItem?.project_name || 'Project', path: `/projects/${workItem?.project_id}` },
          { label: workItem?.plot_address || 'Plot', path: `/plots/${workItem?.plot_id}` },
          { label: workItem?.name || 'Work', path: `/work-items/${workItemId}` },
          { label: isEdit ? 'Edit Job' : 'New Job' }
        ]} />
        <h1 style={{ fontSize: '64px', marginTop: '12px' }}>{isEdit ? 'Edit Job' : 'Create Job'}</h1>
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
            <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Title <span style={{ color: "var(--brand-orange)" }}>*</span></label>
                <input
                  type="text"
                  placeholder="Enter job title"
                  required
                  value={formData.job_name}
                  onChange={e => setFormData({ ...formData, job_name: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Parent Work <span style={{ color: "var(--brand-orange)" }}>*</span></label>
                {workItemId ? (
                  <input
                    type="text"
                    disabled
                    value={workItem?.name || 'Work Name'}
                    style={{ ...inputStyle, background: 'var(--bg-canvas)', cursor: 'not-allowed' }}
                  />
                ) : (
                  <SearchableSelect
                    options={workItemsList}
                    value={formData.work_item}
                    onChange={val => setFormData({ ...formData, work_item: val })}
                    placeholder="Select work"
                  />
                )}
              </div>
            </div>

            <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Artisan Type <span style={{ color: "var(--brand-orange)" }}>*</span></label>
                <select
                  required
                  value={formData.job_artisan}
                  onChange={e => setFormData({ ...formData, job_artisan: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Select artisan...</option>
                  {['Mason', 'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Roofer', 'Iron Bender', 'Tiler', 'Glass Worker', 'Aluminium Worker', 'Labourer', 'Other'].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                {formData.job_artisan === 'Other' && (
                  <div style={{ marginTop: '12px' }}>
                    <input
                      type="text"
                      placeholder="Enter custom artisan type..."
                      required
                      value={formData.custom_artisan}
                      onChange={e => setFormData({ ...formData, custom_artisan: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Status <span style={{ color: "var(--brand-orange)" }}>*</span></label>
                <select
                  required
                  value={formData.job_status}
                  onChange={e => setFormData({ ...formData, job_status: e.target.value })}
                  style={inputStyle}
                >
                  {['Planned', 'In Progress', 'On Hold', 'Delayed', 'Cancelled'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <textarea
                placeholder="Describe the scope of work..."
                value={formData.job_description}
                onChange={e => setFormData({ ...formData, job_description: e.target.value })}
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
              />
            </div>


          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Estimated Hours <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 12.5"
                value={formData.estimated_hours}
                onChange={e => setFormData({ ...formData, estimated_hours: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Budget <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  value={formData.budget_currency} 
                  onChange={e => setFormData({ ...formData, budget_currency: e.target.value })}
                  style={{ ...inputStyle, width: '100px' }}
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={formData.budget_amount}
                  onChange={e => setFormData({ ...formData, budget_amount: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
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
                  onChange={e => setFormData({ ...formData, target_end_date: e.target_end_date })}
                  style={inputStyle}
                />
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
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Job Progress <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
                    <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                      {isProgressManual ? 'Manual Override active' : 'Calculated automatically from daily reports'}
                    </span>
                  </div>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-orange)' }}>
                    {isProgressManual ? (formData.manual_progress ?? 0) : currentProgress}%
                  </span>
                </div>

                {(workItem?.role === 'owner' || workItem?.role === 'project_manager' || jobItemData?.role === 'owner' || jobItemData?.role === 'project_manager') ? (
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
            {loading ? <Spinner size={20} /> : (typeof window !== 'undefined' && window.location.pathname.includes('/edit') ? 'Update Job' : 'Create Job')}
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

export default CreateJobItemPage;
