import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJobItem, getJobReports, createJobReport, approveReport, rejectReport } from '../../api/projects'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_BADGE = { 'Planned':'badge-planned','In Progress':'badge-in_progress','Completed':'badge-completed','On Hold':'badge-on_hold','Delayed':'badge-delayed','Cancelled':'badge-cancelled' }
const REP_BADGE = { Submitted:'badge-submitted', Approved:'badge-approved', Rejected:'badge-rejected' }

export default function JobItemDetailPage() {
  const { projectId, siteId, workItemId, jobItemId } = useParams()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: jobItem }        = useQuery({ queryKey: ['jobitem', jobItemId], queryFn: () => getJobItem(projectId, siteId, workItemId, jobItemId) })
  const { data: reports = [], isLoading: repLoading } = useQuery({ queryKey: ['reports', jobItemId], queryFn: () => getJobReports(projectId, siteId, workItemId, jobItemId) })

  const approveMut = useMutation({
    mutationFn: repId => approveReport(projectId, siteId, workItemId, jobItemId, repId),
    onSuccess: () => { qc.invalidateQueries(['reports', jobItemId]); toast.success('Report approved.') },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to approve'),
  })
  const rejectMut = useMutation({
    mutationFn: repId => rejectReport(projectId, siteId, workItemId, jobItemId, repId, {}),
    onSuccess: () => { qc.invalidateQueries(['reports', jobItemId]); toast.success('Report rejected.') },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to reject'),
  })

  const latestProgress = reports[0]?.percentage_job_progress ?? 0

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/projects">Projects</Link><span className="breadcrumb-sep">›</span>
        <Link to={`/projects/${projectId}`}>Project #{projectId}</Link><span className="breadcrumb-sep">›</span>
        <Link to={`/projects/${projectId}/sites/${siteId}`}>Site #{siteId}</Link><span className="breadcrumb-sep">›</span>
        <Link to={`/projects/${projectId}/sites/${siteId}/workitems/${workItemId}`}>Work item #{workItemId}</Link><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{jobItem?.job_name}</span>
      </div>

      <div className="detail-layout">
        <div>
          <div className="page-header">
            <div className="flex items-center gap-3" style={{ marginBottom: 'var(--sp-2)' }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{jobItem?.job_name}</h1>
              <span className={`badge ${STATUS_BADGE[jobItem?.work_status] || 'badge-planned'}`}>{jobItem?.work_status}</span>
            </div>
            <p className="page-subtitle">{jobItem?.job_description}</p>
          </div>

          {/* Progress */}
          <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--sp-3)' }}>
              <div className="card-title">Overall progress</div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--col-signal)' }}>{latestProgress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${latestProgress}%` }} />
            </div>
          </div>

          {/* Reports */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="section-title">Daily reports</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Submit report</button>
          </div>

          {repLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-8)' }}><div className="spinner" /></div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No reports yet</div>
              <p>Submit the first daily progress report.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {reports.map(rep => (
                <div key={rep.id} className="card">
                  <div className="card-header">
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--col-ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-1)' }}>
                        {rep.report_date ? format(new Date(rep.report_date), 'EEEE, MMM d yyyy') : '—'}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge ${REP_BADGE[rep.report_status] || ''}`}>{rep.report_status}</span>
                        <span className="text-sm text-muted">by <strong>{rep.reported_by?.username}</strong></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--col-signal)', lineHeight: 1 }}>{rep.percentage_job_progress}%</div>
                      <div className="text-xs text-muted">progress</div>
                    </div>
                  </div>

                  {rep.issues_encountered && (
                    <div style={{ marginBottom: 'var(--sp-3)' }}>
                      <div className="info-row-label" style={{ marginBottom: 'var(--sp-1)' }}>Issues encountered</div>
                      <p className="text-sm">{rep.issues_encountered}</p>
                    </div>
                  )}
                  {rep.notes && (
                    <div style={{ marginBottom: 'var(--sp-3)' }}>
                      <div className="info-row-label" style={{ marginBottom: 'var(--sp-1)' }}>Notes</div>
                      <p className="text-sm">{rep.notes}</p>
                    </div>
                  )}
                  {rep.external_comments && (
                    <div style={{ marginBottom: 'var(--sp-3)' }}>
                      <div className="info-row-label" style={{ marginBottom: 'var(--sp-1)' }}>Comments</div>
                      <p className="text-sm">{rep.external_comments}</p>
                    </div>
                  )}

                  {rep.report_status === 'Submitted' && (
                    <div className="flex gap-2 mt-4">
                      <button className="btn btn-sm" style={{ background: 'var(--col-green)', color: 'white' }} onClick={() => approveMut.mutate(rep.id)}>Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => rejectMut.mutate(rep.id)}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detail-sidebar">
          <div className="card">
            <div className="card-header"><div className="card-title">Job details</div></div>
            <div className="info-list">
              <div className="info-row"><div className="info-row-label">Artisan</div><div className="info-row-value">{jobItem?.job_artisan}</div></div>
              <div className="info-row"><div className="info-row-label">Projected start</div><div className="info-row-value">{jobItem?.projected_start_date ? format(new Date(jobItem.projected_start_date), 'MMM d, yyyy') : '—'}</div></div>
              <div className="info-row"><div className="info-row-label">Projected end</div><div className="info-row-value">{jobItem?.projected_end_date ? format(new Date(jobItem.projected_end_date), 'MMM d, yyyy') : '—'}</div></div>
              {jobItem?.actual_start_date && <div className="info-row"><div className="info-row-label">Actual start</div><div className="info-row-value">{format(new Date(jobItem.actual_start_date), 'MMM d, yyyy')}</div></div>}
              {jobItem?.actual_end_date && <div className="info-row"><div className="info-row-label">Actual end</div><div className="info-row-value">{format(new Date(jobItem.actual_end_date), 'MMM d, yyyy')}</div></div>}
              <div className="info-row"><div className="info-row-label">Total reports</div><div className="info-row-value">{reports.length}</div></div>
            </div>
          </div>
        </div>
      </div>

      {showModal && <NewReportModal projectId={projectId} siteId={siteId} workItemId={workItemId} jobItemId={jobItemId} qc={qc} onClose={() => setShowModal(false)} />}
    </div>
  )
}

function NewReportModal({ projectId, siteId, workItemId, jobItemId, qc, onClose }) {
  const [form, set] = useState({ percentage_job_progress: 0, expected_completion_date: '', issues_encountered: '', notes: '', external_comments: '' })
  const mutation = useMutation({
    mutationFn: d => createJobReport(projectId, siteId, workItemId, jobItemId, d),
    onSuccess: () => { qc.invalidateQueries(['reports', jobItemId]); toast.success('Report submitted.'); onClose() },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to submit report'),
  })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h2 className="modal-title">Submit daily report</h2></div>
        <div className="form-group">
          <label className="form-label">Progress: {form.percentage_job_progress}%</label>
          <input type="range" min="0" max="100" value={form.percentage_job_progress} onChange={e => set(f => ({ ...f, percentage_job_progress: +e.target.value }))} style={{ width: '100%', accentColor: 'var(--col-signal)' }} />
        </div>
        <div className="form-group"><label className="form-label">Expected completion</label><input className="form-input" type="date" value={form.expected_completion_date} onChange={e => set(f => ({ ...f, expected_completion_date: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Issues encountered</label><textarea className="form-textarea" value={form.issues_encountered} onChange={e => set(f => ({ ...f, issues_encountered: e.target.value }))} placeholder="Describe any obstacles..." /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => set(f => ({ ...f, notes: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Client-visible comments</label><textarea className="form-textarea" value={form.external_comments} onChange={e => set(f => ({ ...f, external_comments: e.target.value }))} /></div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
            {mutation.isPending ? <span className="spinner" /> : 'Submit report'}
          </button>
        </div>
      </div>
    </div>
  )
}