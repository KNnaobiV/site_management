import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWorkItem, getJobItems, createJobItem } from '../../api/projects'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const ARTISANS = ['Mason','Plumber','Electrician','Carpenter','Painter','Roofer','Iron Bender','Tiler','Glass Worker','Aluminium Worker','Other']
const STATUS_BADGE = { 'Planned':'badge-planned','In Progress':'badge-in_progress','Completed':'badge-completed','On Hold':'badge-on_hold','Delayed':'badge-delayed','Cancelled':'badge-cancelled' }

export default function WorkItemDetailPage() {
  const { projectId, siteId, workItemId } = useParams()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: workItem }       = useQuery({ queryKey: ['workitem', workItemId], queryFn: () => getWorkItem(projectId, siteId, workItemId) })
  const { data: jobItems = [] }  = useQuery({ queryKey: ['jobitems', workItemId], queryFn: () => getJobItems(projectId, siteId, workItemId) })

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/projects">Projects</Link><span className="breadcrumb-sep">›</span>
        <Link to={`/projects/${projectId}`}>Project #{projectId}</Link><span className="breadcrumb-sep">›</span>
        <Link to={`/projects/${projectId}/sites/${siteId}`}>Site #{siteId}</Link><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{workItem?.name}</span>
      </div>

      <div className="detail-layout">
        <div>
          <div className="page-header">
            <div className="flex items-center gap-3" style={{ marginBottom: 'var(--sp-2)' }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{workItem?.name}</h1>
              <span className={`badge ${STATUS_BADGE[workItem?.work_status] || 'badge-planned'}`}>{workItem?.work_status}</span>
            </div>
            <p className="page-subtitle">{workItem?.description}</p>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="section-title">Job items</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Add job item</button>
          </div>

          {jobItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚙️</div>
              <div className="empty-state-title">No job items yet</div>
              <p>Add specific tasks to this work item.</p>
            </div>
          ) : (
            <div className="grid-2">
              {jobItems.map(ji => (
                <Link key={ji.id} to={`/projects/${projectId}/sites/${siteId}/workitems/${workItemId}/jobitems/${ji.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}>
                    <div className="flex justify-between items-center" style={{ marginBottom: 'var(--sp-2)' }}>
                      <span className={`badge ${STATUS_BADGE[ji.work_status] || 'badge-planned'}`}>{ji.work_status}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', background: 'var(--col-surface-2)', padding: '2px 8px', borderRadius: 'var(--r-full)', color: 'var(--col-ink-3)' }}>{ji.job_artisan}</span>
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', marginBottom: 'var(--sp-2)' }}>{ji.job_name}</h3>
                    <p className="text-sm text-muted" style={{ marginBottom: 'var(--sp-3)' }}>{ji.job_description}</p>
                    <div className="divider" style={{ margin: 'var(--sp-3) 0' }} />
                    <div className="flex gap-4 text-xs text-mono text-muted">
                      <span>{ji.projected_start_date ? format(new Date(ji.projected_start_date), 'MMM d') : '—'}</span>
                      <span>→</span>
                      <span>{ji.projected_end_date ? format(new Date(ji.projected_end_date), 'MMM d, yyyy') : '—'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="detail-sidebar">
          <div className="card">
            <div className="card-header"><div className="card-title">Work item details</div></div>
            <div className="info-list">
              <div className="info-row"><div className="info-row-label">Proposed start</div><div className="info-row-value">{workItem?.proposed_start_date ? format(new Date(workItem.proposed_start_date), 'MMM d, yyyy') : '—'}</div></div>
              <div className="info-row"><div className="info-row-label">Proposed end</div><div className="info-row-value">{workItem?.proposed_end_date ? format(new Date(workItem.proposed_end_date), 'MMM d, yyyy') : '—'}</div></div>
              {workItem?.start_date && <div className="info-row"><div className="info-row-label">Actual start</div><div className="info-row-value">{format(new Date(workItem.start_date), 'MMM d, yyyy')}</div></div>}
              {workItem?.end_date && <div className="info-row"><div className="info-row-label">Actual end</div><div className="info-row-value">{format(new Date(workItem.end_date), 'MMM d, yyyy')}</div></div>}
              <div className="info-row"><div className="info-row-label">Total jobs</div><div className="info-row-value">{jobItems.length}</div></div>
            </div>
          </div>
        </div>
      </div>

      {showModal && <NewJobItemModal projectId={projectId} siteId={siteId} workItemId={workItemId} qc={qc} onClose={() => setShowModal(false)} />}
    </div>
  )
}

function NewJobItemModal({ projectId, siteId, workItemId, qc, onClose }) {
  const [form, set] = useState({ job_name: '', job_description: '', job_artisan: 'Mason', projected_start_date: '', projected_end_date: '' })
  const mutation = useMutation({
    mutationFn: d => createJobItem(projectId, siteId, workItemId, d),
    onSuccess: () => { qc.invalidateQueries(['jobitems', workItemId]); toast.success('Job item added.'); onClose() },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to create job item'),
  })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h2 className="modal-title">New job item</h2></div>
        <div className="form-group"><label className="form-label">Job name</label><input className="form-input" value={form.job_name} onChange={e => set(f => ({ ...f, job_name: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.job_description} onChange={e => set(f => ({ ...f, job_description: e.target.value }))} /></div>
        <div className="form-group">
          <label className="form-label">Artisan type</label>
          <select className="form-select" value={form.job_artisan} onChange={e => set(f => ({ ...f, job_artisan: e.target.value }))}>
            {ARTISANS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div className="grid-2" style={{ gap: 'var(--sp-3)' }}>
          <div className="form-group"><label className="form-label">Projected start</label><input className="form-input" type="date" value={form.projected_start_date} onChange={e => set(f => ({ ...f, projected_start_date: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Projected end</label><input className="form-input" type="date" value={form.projected_end_date} onChange={e => set(f => ({ ...f, projected_end_date: e.target.value }))} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
            {mutation.isPending ? <span className="spinner" /> : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}