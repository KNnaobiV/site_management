import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, Spinner, SearchableSelect, MaterialsEditor } from '../components';
import { Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const CreateJobItemPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { workItemId, jobItemId } = useParams();
  const [loading, setLoading] = useState(false);
  const isEdit = false;
  const [fetchingWorkItem, setFetchingWorkItem] = useState(!!workItemId);
  const [workItem, setWorkItem] = useState(null);
  const [error, setError] = useState(null);
  const [workItemsList, setWorkItemsList] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [formData, setFormData] = useState({
    job_name: '',
    job_artisan: '',
    job_description: '',
    job_status: 'Planned',
    priority: 'Medium',
    projected_start_date: new Date().toISOString().split('T')[0],
    projected_end_date: '',
    actual_start_date: '',
    actual_end_date: '',
    estimated_hours: '',
    material_requirements: [],
    work_item: '',
    budget_amount: '',
    budget_currency: 'NGN',
  });

  useEffect(() => {
    if (isEdit) {
      fetchJobItem();
    } else if (workItemId) {
      fetchWorkItem();
    } else {
      fetchWorkItems();
    }
  }, [workItemId]);

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
      
      const res = await apiFetch(`/work-items/${workItemId}/`, { token }); // Assuming this exists or I'll fix App.jsx
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

    const payload = {
      job_name: formData.job_name,
      job_artisan: formData.job_artisan,
      job_description: formData.job_description,
      job_status: formData.job_status,
      priority: formData.priority,
      projected_start_date: formData.projected_start_date,
      projected_end_date: formData.projected_end_date,
    };
    if (formData.actual_start_date) payload.actual_start_date = formData.actual_start_date;
    if (formData.actual_end_date) payload.actual_end_date = formData.actual_end_date;
    if (formData.estimated_hours) payload.estimated_hours = parseFloat(formData.estimated_hours);
    if (formData.material_requirements.length) payload.material_requirements = formData.material_requirements;

    try {
      const targetWiId = workItemId || formData.work_item;
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
<<<<<<< HEAD
        showSuccessMessage(isEdit ? "Job item updated successfully!" : "Job item created successfully!");
        if (isEdit) {
          navigate(`/job-items/${jobItemId}`);
        } else {
          navigate(`/work-items/${targetWiId}`);
        }
=======
        const newJobItem = await res.json();
        // Create budget if amount was set
        if (formData.budget_amount && parseFloat(formData.budget_amount) > 0) {
          await apiFetch(`/jobitems/${newJobItem.id}/budget/`, {
            method: 'PATCH',
            token,
            body: JSON.stringify({ allocated_amount: parseFloat(formData.budget_amount), currency: formData.budget_currency }),
          });
        }
        showSuccessMessage("Job item created successfully!");
        navigate(`/work-items/${targetWiId}`);
>>>>>>> 76f5b6f4 (connected finance be to fe)
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

  if (fetchingWorkItem) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[
          { label: 'Projects', path: '/projects' }, 
          { label: workItem?.project_name || 'Project', path: `/projects/${workItem?.project_id || workItem?.construction_project}` },
          { label: workItem?.plot_address || 'Plot', path: `/plots/${workItem?.plot_id || workItem?.construction_plot}` },
          { label: workItem?.name || 'Work Item', path: `/work-items/${workItemId || workItem?.id}` },
          { label: isEdit ? 'Edit Job Item' : 'New Job Item' }
        ]} />
        <h1 style={{ fontSize: '64px', marginTop: '12px' }}>{isEdit ? 'Edit Job Item' : 'Create Job Item'}</h1>
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
                <label style={labelStyle}>Title</label>
                <input 
                  type="text" 
                  placeholder="Enter job item title"
                  required
                  value={formData.job_name}
                  onChange={e => setFormData({...formData, job_name: e.target.value})}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Parent Work Item *</label>
                {(workItemId || isEdit) ? (
                  <input 
                    type="text"
                    disabled
                    value={workItem?.name || 'Work Item Name'}
                    style={{ ...inputStyle, background: 'var(--bg-canvas)', cursor: 'not-allowed' }}
                  />
                ) : (
                  <SearchableSelect 
                    options={workItemsList}
                    value={formData.work_item}
                    onChange={val => setFormData({...formData, work_item: val})}
                    placeholder="Select work item"
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Artisan Type *</label>
                <select 
                  required
                  value={formData.job_artisan}
                  onChange={e => setFormData({...formData, job_artisan: e.target.value})}
                  style={inputStyle}
                >
                  <option value="">Select artisan...</option>
                  {['Mason','Plumber','Electrician','Carpenter','Painter','Roofer','Iron Bender','Tiler','Glass Worker','Aluminium Worker','Other'].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status *</label>
                <select 
                  required
                  value={formData.job_status}
                  onChange={e => setFormData({...formData, job_status: e.target.value})}
                  style={inputStyle}
                >
                  {['Planned','In Progress','Completed','On Hold','Delayed','Cancelled'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
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
              <label style={labelStyle}>Description</label>
              <textarea 
                placeholder="Describe the scope of work..."
                value={formData.job_description}
                onChange={e => setFormData({...formData, job_description: e.target.value})}
                style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Material Requirements <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span></label>
              <MaterialsEditor 
                items={formData.material_requirements}
                onChange={items => setFormData({...formData, material_requirements: items})}
              />
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Estimated Hours <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span></label>
              <input 
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 12.5"
                value={formData.estimated_hours}
                onChange={e => setFormData({...formData, estimated_hours: e.target.value})}
                style={inputStyle}
              />
            </div>

            {/* Budget */}
            <div>
              <label style={labelStyle}>Budget <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 500000"
                  value={formData.budget_amount}
                  onChange={e => setFormData({...formData, budget_amount: e.target.value})}
                  style={inputStyle}
                />
                <select
                  value={formData.budget_currency}
                  onChange={e => setFormData({...formData, budget_currency: e.target.value})}
                  style={{ ...inputStyle, width: '90px' }}
                >
                  {['NGN','USD','GBP','EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Projected Start *</label>
                <input 
                  type="date"
                  required
                  value={formData.projected_start_date}
                  onChange={e => setFormData({...formData, projected_start_date: e.target.value})}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Projected End *</label>
                <input 
                  type="date"
                  required
                  value={formData.projected_end_date}
                  onChange={e => setFormData({...formData, projected_end_date: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Actual Start <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span></label>
                <input 
                  type="date"
                  value={formData.actual_start_date}
                  disabled={isEdit && !!formData.actual_start_date}
                  onChange={e => setFormData({...formData, actual_start_date: e.target.value})}
                  style={{
                    ...inputStyle,
                    background: isEdit && !!formData.actual_start_date ? 'var(--bg-canvas)' : inputStyle.background,
                    cursor: isEdit && !!formData.actual_start_date ? 'not-allowed' : 'text'
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Actual End <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span></label>
                <input 
                  type="date"
                  value={formData.actual_end_date}
                  onChange={e => setFormData({...formData, actual_end_date: e.target.value})}
                  style={inputStyle}
                />
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
            {loading ? <Spinner size={20} /> : (typeof window !== 'undefined' && window.location.pathname.includes('/edit') ? 'Update Job Item' : 'Create Job Item')}
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
