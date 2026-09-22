import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, Spinner, SearchableSelect } from '../components';
import { Upload, MapPin, Camera, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList, formatApiError } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const CreatePlotPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { projectId, plotId } = useParams();
  const isEditing = !!plotId;
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [fetchingProject, setFetchingProject] = useState(!!projectId);
  const [fetchingPlot, setFetchingPlot] = useState(isEditing);
  const [project, setProject] = useState(null);
  const [plot, setPlot] = useState(null);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [fieldsUpdated, setFieldsUpdated] = useState(false);

  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [existingCoverImage, setExistingCoverImage] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [plotData, setPlotData] = useState(null);
  const [isProgressManual, setIsProgressManual] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);

  const [formData, setFormData] = useState({
    plot_number: '',
    construction_project: projectId || '',
    address: '',
    gps_latitude: '',
    gps_longitude: '',
    status: 'Planned',
    foremen: [],
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: '',
    notes: '',
    budget_amount: '',
    budget_currency: 'NGN',
    manual_progress: 0,
  });

  useEffect(() => {
    if (projectId) {
      setFormData(prev => ({ ...prev, construction_project: projectId }));
      fetchProject();
      handleSearchUsers('', projectId);
    } else {
      fetchProjects();
      handleSearchUsers('');
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
        setPlotData(plotData);
        setIsProgressManual(!!plotData.is_progress_manual);
        setCurrentProgress(plotData.progress || 0);
        setFormData({
          plot_number: plotData.plot_number || '',
          construction_project: plotData.construction_project?.id || plotData.construction_project || '',
          address: plotData.address || '',
          gps_latitude: plotData.gps_latitude || '',
          gps_longitude: plotData.gps_longitude || '',
          status: plotData.status || 'Planned',
          foremen: plotData.foremen ? plotData.foremen.map(f => f.id) : [],
          start_date: plotData.start_date || new Date().toISOString().split('T')[0],
          target_end_date: plotData.target_end_date || '',
          notes: plotData.notes || '',
          budget_amount: plotData.budget?.allocated_amount || '',
          budget_currency: plotData.budget?.currency || 'NGN',
          manual_progress: plotData.manual_progress !== null && plotData.manual_progress !== undefined ? plotData.manual_progress : (plotData.progress || 0),
        });

        if (plotData.cover_image?.img) {
          setExistingCoverImage(plotData.cover_image.img);
        } else if (typeof plotData.cover_image === 'string') {
          setExistingCoverImage(plotData.cover_image);
        }

        // Prepopulate users select list with the existing foremen
        const initialUsers = [];
        if (plotData.foremen && Array.isArray(plotData.foremen)) {
          plotData.foremen.forEach(f => {
            initialUsers.push({ id: f.id, label: f.username, avatar: f.avatar_url || null });
          });
        }
        if (initialUsers.length > 0) {
          setUsers(initialUsers);
        }

        const hasValues = !!(plotData.plot_number || plotData.address || plotData.construction_project);
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

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      setCoverImagePreview(URL.createObjectURL(file));
    }
  };

  const handleUploadCoverImage = async () => {
    if (!coverImageFile || !isEditing) return;
    setUploadingCover(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('cover_image', coverImageFile);
      const res = await apiFetch(`/plots/${plotId}/`, {
        method: 'PATCH',
        token,
        body: fd
      });
      if (res.ok) {
        const updated = await res.json();
        setExistingCoverImage(updated.cover_image?.img || coverImagePreview);
        setCoverImageFile(null);
        setCoverImagePreview(null);
        showSuccessMessage("Plot cover image uploaded successfully ✅");
      } else {
        const data = await res.json();
        setError(formatApiError(data));
      }
    } catch (err) {
      setError("Failed to upload plot cover image.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleRemoveCoverImage = async () => {
    if (coverImageFile) {
      setCoverImageFile(null);
      setCoverImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (isEditing && existingCoverImage) {
      setUploadingCover(true);
      try {
        const fd = new FormData();
        fd.append('cover_image', '');
        await apiFetch(`/plots/${plotId}/`, {
          method: 'PATCH',
          token,
          body: fd
        });
        setExistingCoverImage(null);
        showSuccessMessage("Plot cover image removed");
      } catch (err) {
        console.error(err);
      } finally {
        setUploadingCover(false);
      }
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

  const handleSearchUsers = async (query = '', overrideProjectId = null) => {
    try {
      const targetProjectId = overrideProjectId !== null ? overrideProjectId : (projectId || formData.construction_project);
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

    const canSetProgress = isEditing && (plotData?.role === 'owner' || plotData?.role === 'project_manager');

    const payload = {
      plot_number: formData.plot_number || '',
      construction_project: formData.construction_project || null,
      address: formData.address || '',
      gps_latitude: formData.gps_latitude || null,
      gps_longitude: formData.gps_longitude || null,
      status: formData.status || 'Planned',
      foremen_ids: formData.foremen && formData.foremen.length > 0 ? formData.foremen : [],
      start_date: formData.start_date || null,
      target_end_date: formData.target_end_date || null,
      notes: formData.notes || '',
    };

    if (isEditing && canSetProgress) {
      payload.manual_progress = isProgressManual ? parseInt(formData.manual_progress || 0) : null;
    }

    let body;
    if (coverImageFile) {
      body = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          if (Array.isArray(v)) {
            v.forEach(item => body.append(k, item));
          } else {
            body.append(k, v);
          }
        }
      });
      body.append('cover_image', coverImageFile);
    } else {
      body = JSON.stringify(payload);
    }

    try {
      const url = isEditing ? `/plots/${plotId}/` : `/projects/${formData.construction_project}/plots/`;
      const method = isEditing ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        token,
        body,
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
        showSuccessMessage(isEditing ? "Plot updated successfully!" : "Plot created successfully!");
        if (isEditing) {
          navigate(`/plots/${plotId}`);
        } else {
          navigate(`/projects/${formData.construction_project}`);
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
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Plot Number <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <input
                type="text"
                placeholder="Enter plot number"
                required
                value={formData.plot_number}
                onChange={e => setFormData({ ...formData, plot_number: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Parent Project <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
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
                  onChange={val => {
                    setFormData({ ...formData, construction_project: val });
                    handleSearchUsers('', val);
                  }}
                  placeholder="Select project"
                />
              )}
            </div>

            <div>
              <label style={labelStyle}>Foremen <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <SearchableSelect
                isMulti={true}
                options={users}
                value={formData.foremen}
                onChange={val => setFormData({ ...formData, foremen: val })}
                onSearch={handleSearchUsers}
                placeholder="Select foremen"
              />
            </div>

            <div>
              <label style={labelStyle}>Address <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <textarea
                placeholder="Enter site address"
                required
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Status <span style={{ color: "var(--brand-orange)" }}>*</span></label>
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
              <label style={labelStyle}>GPS Coordinates <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
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
              <label style={labelStyle}>Notes <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <textarea
                placeholder="Add any additional notes about this plot"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
              />
            </div>

            {/* Cover Image */}
            <div>
              <label style={labelStyle}>Cover Image <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleCoverSelect}
                style={{ display: 'none' }}
              />
              <div style={{
                borderRadius: '16px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-canvas)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px'
              }}>
                {(coverImagePreview || existingCoverImage) ? (
                  <div style={{ position: 'relative', width: '100%', height: '160px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <img
                      src={coverImagePreview || existingCoverImage}
                      alt="Plot cover"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      height: '110px',
                      border: '2px dashed var(--border-default)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      background: 'var(--bg-raised)'
                    }}
                  >
                    <ImageIcon size={26} color="var(--text-tertiary)" />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Click to upload plot cover image</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    <Camera size={14} /> {(coverImagePreview || existingCoverImage) ? 'Change Image' : 'Select Image'}
                  </button>

                  {coverImageFile && isEditing && (
                    <button
                      type="button"
                      onClick={handleUploadCoverImage}
                      disabled={uploadingCover}
                      className="btn-primary"
                      style={{ padding: '8px 18px', fontSize: '13px' }}
                    >
                      {uploadingCover ? <Spinner size={14} /> : <><Upload size={14} /> Upload</>}
                    </button>
                  )}

                  {(coverImageFile || existingCoverImage) && (
                    <button
                      type="button"
                      onClick={handleRemoveCoverImage}
                      disabled={uploadingCover}
                      className="btn-ghost"
                      style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--status-delayed)' }}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Budget */}
            <div>
              <label style={labelStyle}>Plot Budget <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
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

            {/* Progress Section (Edit Mode) */}
            {isEditing && (
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
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Plot Progress <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
                    <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                      {isProgressManual ? 'Manual Override active' : 'Calculated automatically from works'}
                    </span>
                  </div>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-orange)' }}>
                    {isProgressManual ? (formData.manual_progress ?? 0) : currentProgress}%
                  </span>
                </div>

                {(plotData?.role === 'owner' || plotData?.role === 'project_manager') ? (
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
