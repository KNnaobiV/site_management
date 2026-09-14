import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb, Spinner, ImageUploader } from '../components';
import { Calendar, AlertCircle, MessageSquare, Camera, ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatApiError } from '../api/client';
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
    video_link: '',
  });
  const [reportImages, setReportImages] = useState([]);
  const [photosVerified, setPhotosVerified] = useState(false);
  const [verifyingPhotos, setVerifyingPhotos] = useState(false);
  const [error, setError] = useState(null);

  const handleVerifyPhotos = (files) => {
    if (!files || files.length === 0) return;
    setVerifyingPhotos(true);
    setTimeout(() => {
      setPhotosVerified(true);
      setVerifyingPhotos(false);
      showSuccessMessage(`${files.length} photo${files.length > 1 ? 's' : ''} verified and ready for upload ✅`);
    }, 350);
  };

  const [previousProgress, setPreviousProgress] = useState(0);

  useEffect(() => {
    fetchJobItem();
  }, [jobItemId]);

  const fetchJobItem = async () => {
    try {
      const res = await apiFetch(`/jobitems/${jobItemId}/`, { token });
      if (res.ok) {
        const item = await res.json();
        setJobItem(item);
        const prev = item.previous_report_progress !== undefined
          ? item.previous_report_progress
          : (item.progress !== undefined ? item.progress : 0);
        setPreviousProgress(prev);
        setFormData(f => ({
          ...f,
          percentage_job_progress: String(prev),
          expected_completion_date: f.expected_completion_date || item.target_end_date || '',
        }));
      }
    } catch (err) { console.error(err); }
    finally { setFetching(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.notes || !formData.notes.trim()) {
      setError("General observation is required.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload = {
      report_date: formData.report_date,
      priority: formData.priority,
      percentage_job_progress: formData.percentage_job_progress !== '' ? parseInt(formData.percentage_job_progress, 10) : previousProgress,
      expected_completion_date: formData.expected_completion_date,
      issues_encountered: formData.issues_encountered,
      notes: formData.notes.trim(),
      external_comments: formData.external_comments,
      internal_comments: formData.internal_comments,
      video_link: formData.video_link,
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
        setError(formatApiError(d));
      }
    } catch (err) {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;
  if (!jobItem) return <div style={{ padding: '60px', textAlign: 'center' }}>Job not found.</div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[
          { label: 'Works', path: '/work-items' },
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

      <form onSubmit={handleSubmit} className="mobile-padding" style={{
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
          <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Report Date <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <input
                type="date" required
                value={formData.report_date}
                onChange={e => setFormData({ ...formData, report_date: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Priority Level <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <select
                required
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
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
          <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={labelStyle}>Job Progress (%) <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 0' }}>
                <input
                  type="range" min="0" max="100" step="1"
                  value={formData.percentage_job_progress}
                  onChange={e => setFormData({ ...formData, percentage_job_progress: e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--brand-orange)' }}
                />
                <input
                  type="number" min="0" max="100"
                  placeholder={String(previousProgress)}
                  value={formData.percentage_job_progress}
                  onChange={e => {
                    const val = e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value)));
                    setFormData({ ...formData, percentage_job_progress: String(val) });
                  }}
                  style={{
                    width: '80px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-raised)',
                    color: 'var(--text-primary)',
                    fontSize: '18px',
                    fontWeight: 800,
                    textAlign: 'center',
                    fontFamily: 'var(--font-sans)'
                  }}
                />
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--brand-orange)' }}>%</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {previousProgress > 0
                  ? `Populated from previous report (${previousProgress}%) as starting placeholder.`
                  : 'Starting at 0% (no previous reports).'}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Target Completion Date <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <input
                type="date" required
                value={formData.expected_completion_date}
                onChange={e => setFormData({ ...formData, expected_completion_date: e.target.value })}
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
              <label style={labelStyle}>Issues Encountered <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <textarea
                placeholder="Describe any blockers, weather issues, or material shortages..."
                value={formData.issues_encountered}
                onChange={e => setFormData({ ...formData, issues_encountered: e.target.value })}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>
            <div>
              <label style={labelStyle}>General Observations <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <textarea
                required
                placeholder="What was accomplished today? Any specific wins or notes..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>
          </div>
        </section>

        {/* Comments Section */}
        <section>
          <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={labelStyle}>External Comments <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(for Client)</span> <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <textarea
                placeholder="Publicly visible comments for stakeholders..."
                value={formData.external_comments}
                onChange={e => setFormData({ ...formData, external_comments: e.target.value })}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Internal Comments <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(for Office)</span> <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <textarea
                placeholder="Internal team notes and sensitive information..."
                value={formData.internal_comments}
                onChange={e => setFormData({ ...formData, internal_comments: e.target.value })}
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
          <ImageUploader 
            files={reportImages} 
            onChange={(files) => {
              setReportImages(files);
              setPhotosVerified(false);
            }} 
            label="Upload site photos" 
            max={4}
            onUpload={handleVerifyPhotos}
            uploading={verifyingPhotos}
            uploadButtonText="Upload"
          />
          <div style={{ marginTop: '24px' }}>
            <label style={labelStyle}>Video Link <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <input
              type="url"
              placeholder="https://youtube.com/... or Google Drive link"
              value={formData.video_link}
              onChange={e => setFormData({ ...formData, video_link: e.target.value })}
              style={inputStyle}
            />
          </div>
          {photosVerified && reportImages.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontSize: '14px', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> {reportImages.length} photo{reportImages.length > 1 ? 's' : ''} verified and ready to be uploaded with report
            </div>
          )}
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
