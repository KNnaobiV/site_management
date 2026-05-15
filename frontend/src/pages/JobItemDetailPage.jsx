import React, { useState, useEffect } from 'react';
// Optimized Job Item Detail View
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Image as ImageIcon, ArrowLeft, CheckCircle2, Loader as SpinnerIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { Breadcrumb, Avatar, MaterialsEditor, Spinner } from '../components';
import { showSuccessMessage } from '../utils/successMessage';

const statusColors = {
  'Planned':    { bg: '#e8e8e8', text: '#555' },
  'In Progress':{ bg: '#fef3ec', text: '#c14a1e' },
  'Completed':  { bg: '#e8f5e9', text: '#2d5a27' },
  'On Hold':    { bg: '#fff3e0', text: '#e65100' },
  'Delayed':    { bg: '#fce4ec', text: '#a32a2a' },
  'Cancelled':  { bg: '#f5f5f5', text: '#9e9e9e' },
};
const StatusPill = ({ status }) => {
  const c = statusColors[status] || statusColors['Planned'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '100px', background: c.bg, color: c.text, fontWeight: 600, fontSize: '13px' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.text, flexShrink: 0 }} />{status}
    </span>
  );
};

const inputStyle = { width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'var(--font-sans)' };
const labelStyle = { display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)', letterSpacing: '0.04em' };

// ─── Main Component ───────────────────────────────────────────────────────────
const JobItemDetailPage = () => {
  const { projectId: pidFromUrl, plotId: plidFromUrl, workItemId: wiidFromUrl, jobItemId } = useParams();
  const id = jobItemId;
  const [projectId, setProjectId] = useState(pidFromUrl);
  const [plotId, setPlotId] = useState(plidFromUrl);
  const [workItemId, setWorkItemId] = useState(wiidFromUrl);
  const { token } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [plot, setPlot] = useState(null);
  const [workItem, setWorkItem] = useState(null);
  const [jobItem, setJobItem] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, [projectId, plotId, workItemId, id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const jiRes = await apiFetch(`/jobitems/${id}/`, { token });
      if (jiRes.ok) {
        const jiData = await jiRes.json();
        setJobItem(jiData);
        
        const pid = pidFromUrl || jiData.construction_project;
        const plid = plidFromUrl || jiData.construction_plot;
        const wiid = wiidFromUrl || jiData.work_item;
        
        setProjectId(pid);
        setPlotId(plid);
        setWorkItemId(wiid);

        const [projRes, plotRes, wiRes, repRes] = await Promise.all([
          apiFetch(`/projects/${pid}/`, { token }),
          apiFetch(`/projects/${pid}/plots/${plid}/`, { token }),
          apiFetch(`/projects/${pid}/plots/${plid}/workitems/${wiid}/`, { token }),
          apiFetch(`/jobitems/${id}/reports/`, { token }),
        ]);
        if (projRes.ok) setProject(await projRes.json());
        if (plotRes.ok) setPlot(await plotRes.json());
        if (wiRes.ok) setWorkItem(await wiRes.json());
        if (repRes.ok) setReports(unwrapList(await repRes.json()));
      }
    } catch (e) { 
      console.error("JobItemDetailPage fetch error:", e); 
    } finally { setLoading(false); }
  };

  const handleMarkComplete = async () => {
    if (!window.confirm("Mark this job as completed?")) return;
    try {
      const res = await apiFetch(`/jobitems/${id}/`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ job_status: 'Completed', actual_end_date: new Date().toISOString().split('T')[0] })
      });
      if (res.ok) {
        showSuccessMessage("Job marked as completed! 🏗️");
        fetchAll();
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (!jobItem) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Job item not found.</div>;

  const materials = jobItem.material_requirements || [];

  return (
    <div className="fade-up" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 0 60px' }}>
      <Breadcrumb items={[
        { label: 'Projects', to: '/projects' },
        { label: project?.project_name || '...', to: `/projects/${projectId}` },
        { label: plot?.address || '...', to: `/plots/${plotId}` },
        { label: workItem?.name || '...', to: `/work-items/${workItemId}` },
        { label: jobItem.job_name },
      ]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '32px', marginTop: '12px' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(24px,4vw,42px)', marginBottom: '10px', lineHeight: 1.05 }}>{jobItem.job_name}</h1>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusPill status={jobItem.job_status} />
            <span style={{ fontSize: '14px', color: 'var(--text-tertiary)', padding: '5px 14px', borderRadius: '100px', background: 'var(--bg-raised)', fontWeight: 500 }}>{jobItem.job_artisan}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {jobItem.job_status !== 'Completed' && (
            <button className="btn-ghost" onClick={handleMarkComplete} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} /> Mark Complete
            </button>
          )}
          <button className="btn-primary" onClick={() => navigate(`/job-items/${id}/reports/new`)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={15} /> Write Report
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Description */}
          {jobItem.job_description && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 12px' }}>Scope of Work</p>
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: '15px' }}>{jobItem.job_description}</p>
            </div>
          )}

          {/* Dates & Hours */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Projected Start</p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.projected_start_date}</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Projected End</p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.projected_end_date}</p>
            </div>
            {jobItem.actual_start_date && <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Actual Start</p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.actual_start_date}</p>
            </div>}
            {jobItem.estimated_hours && <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Est. Hours</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '20px', color: 'var(--brand-orange)' }}>{jobItem.estimated_hours}<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-tertiary)' }}>h</span></p>
            </div>}
          </div>

          {/* Materials */}
          {materials.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 16px' }}>Material Requirements</p>
              <MaterialsEditor items={materials} onChange={() => {}} readOnly />
            </div>
          )}
        </div>

        {/* Daily Reports Timeline */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', position: 'sticky', top: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Daily Reports ({reports.length})</p>
            <button className="btn-ghost" onClick={() => navigate(`/job-items/${id}/reports/new`)} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Plus size={12} /> New
            </button>
          </div>

          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
              <p style={{ fontWeight: 600, fontSize: '14px' }}>No reports yet</p>
              <p style={{ fontSize: '13px', marginBottom: '16px' }}>Start logging daily progress.</p>
              <button className="btn-primary" onClick={() => navigate(`/job-items/${id}/reports/new`)} style={{ justifyContent: 'center', width: '100%' }}>Write First Report</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto' }}>
              {reports.map(r => (
                <div key={r.id} style={{ padding: '16px', background: 'var(--bg-raised)', borderRadius: '14px', position: 'relative', paddingLeft: '20px' }}>
                  <div style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '60%', background: 'var(--brand-orange)', borderRadius: '4px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{r.report_date}</p>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-orange)' }}>{r.percentage_job_progress}%</span>
                  </div>
                  {r.notes && <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.notes}</p>}
                  {r.issues_encountered && <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--status-delayed)', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>⚠ {r.issues_encountered}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <StatusPill status={r.priority} />
                    {r.images?.length > 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ImageIcon size={12} /> {r.images.length} photo{r.images.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobItemDetailPage;
