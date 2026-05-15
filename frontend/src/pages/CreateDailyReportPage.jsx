import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb, Spinner, ImageUploader } from '../components';
import { Calendar, AlertCircle, MessageSquare, Camera, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const CreateDailyReportPage = () => {
  const { jobItemId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [jobItem, setJobItem] = useState(null);
  
  const [formData, setFormData] = useState({
    report_date: new Date().toISOString().split('T')[0],
    priority: 'Normal',
    percentage_job_progress: '0',
    expected_completion_date: '',
    issues_encountered: '',
    notes: '',
    external_comments: '',
    internal_comments: '',
  });
  const [reportImages, setReportImages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJobItem();
  }, [jobItemId]);

  const fetchJobItem = async () => {
    try {
      const res = await apiFetch(`/jobitems/${jobItemId}/`, { token });
      if (res.ok) setJobItem(await res.json());
    } catch (err) { console.error(err); }
    finally { setFetching(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      report_date: formData.report_date,
      priority: formData.priority,
      percentage_job_progress: parseInt(formData.percentage_job_progress),
      expected_completion_date: formData.expected_completion_date,
      issues_encountered: formData.issues_encountered,
      notes: formData.notes,
      external_comments: formData.external_comments,
      internal_comments: formData.internal_comments,
    };

    try {
      const projectId = jobItem.construction_project;
      const plotId = jobItem.construction_plot;
      const workItemId = jobItem.work_item;
      const url = `/projects/${projectId}/plots/${plotId}/workitems/${workItemId}/jobitems/${jobItemId}/reports/`;
      const res = await apiFetch(url, {
        method: 'POST',
        token,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const report = await res.json();
        // Upload images
        for (const img of reportImages) {
          const fd = new FormData();
          fd.append('image', img);
          await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${workItemId}/jobitems/${jobItemId}/reports/${report.id}/images/`, {
            method: 'POST',
            token,
            body: fd
          });
        }
        showSuccessMessage("Daily report submitted successfully ✅");
        navigate(-1);
      } else {
        const d = await res.json();
        setError(Object.entries(d).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | '));
      }
    } catch (err) {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;
  if (!jobItem) return <div style={{ padding: '60px', textAlign: 'center' }}>Job Item not found.</div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[
          { label: 'Work Items', path: '/work-items' },
          { label: jobItem.work_item_name || '...', path: `/work-items/${jobItem.work_item}` },
          { label: jobItem.job_name, path: `/job-items/${jobItem.id}` },
          { label: 'New Report' }
        ]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
          <button onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: '8px' }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ fontSize: '56px', margin: 0 }}>Daily Progress Report</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '18px', marginLeft: '52px' }}>
          Site activity for <strong>{jobItem.job_name}</strong>
        </p>
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '16px', borderRadius: '12px', marginBottom: '24px', maxWidth: '800px' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ 
        background: 'var(--bg-card)', 
        borderRadius: '24px', 
        border: '1px solid var(--border-default)',
        padding: '48px',
        maxWidth: '1000px',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
      }}>
        {/* Core Info Section */}
        <section>
          <h3 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={20} color="var(--brand-orange)" />
            Schedule & Priority
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Report Date *</label>
              <input 
                type="date" required 
                value={formData.report_date} 
                onChange={e => setFormData({...formData, report_date: e.target.value})} 
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>Priority Level *</label>
              <select 
                required 
                value={formData.priority} 
                onChange={e => setFormData({...formData, priority: e.target.value})} 
                style={inputStyle}
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
        </section>

        {/* Progress Section */}
        <section>
          <h3 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="var(--brand-orange)" />
            Work Completion
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Job Progress (%) *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
                <input 
                  type="range" min="0" max="100" step="5" 
                  value={formData.percentage_job_progress} 
                  onChange={e => setFormData({...formData, percentage_job_progress: e.target.value})} 
                  style={{ flex: 1, accentColor: 'var(--brand-orange)' }} 
                />
                <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--brand-orange)', minWidth: '60px' }}>
                  {formData.percentage_job_progress}%
                </span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Target Completion Date *</label>
              <input 
                type="date" required 
                value={formData.expected_completion_date} 
                onChange={e => setFormData({...formData, expected_completion_date: e.target.value})} 
                style={inputStyle} 
              />
            </div>
          </div>
        </section>

        {/* Issues Section */}
        <section>
          <h3 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare size={20} color="var(--brand-orange)" />
            Field Notes & Observations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Issues Encountered</label>
              <textarea 
                placeholder="Describe any blockers, weather issues, or material shortages..."
                value={formData.issues_encountered}
                onChange={e => setFormData({...formData, issues_encountered: e.target.value})}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>
            <div>
              <label style={labelStyle}>General Observations</label>
              <textarea 
                placeholder="What was accomplished today? Any specific wins or notes..."
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>
          </div>
        </section>

        {/* Comments Section */}
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={labelStyle}>External Comments <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(for Client)</span></label>
              <textarea 
                placeholder="Publicly visible comments for stakeholders..."
                value={formData.external_comments}
                onChange={e => setFormData({...formData, external_comments: e.target.value})}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Internal Comments <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(for Office)</span></label>
              <textarea 
                placeholder="Internal team notes and sensitive information..."
                value={formData.internal_comments}
                onChange={e => setFormData({...formData, internal_comments: e.target.value})}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>
          </div>
        </section>

        {/* Media Section */}
        <section>
          <h3 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Camera size={20} color="var(--brand-orange)" />
            Progress Photos
          </h3>
          <ImageUploader files={reportImages} onChange={setReportImages} label="Upload site photos" max={12} />
        </section>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '40px', marginTop: '12px' }}>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: '14px 40px' }}>Cancel</button>
          <button type="submit" className="btn-primary" style={{ padding: '14px 64px', minWidth: '220px' }} disabled={loading}>
            {loading ? <Spinner size={22} /> : 'Submit Daily Report'}
          </button>
        </div>
      </form>
    </div>
  );
};

const labelStyle = { display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' };
const inputStyle = { width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'var(--font-sans)' };

export default CreateDailyReportPage;
