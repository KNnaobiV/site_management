import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSite, getWorkItems, createWorkItem, inviteToSite } from '../../api/projects'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_BADGE = { 'Planned':'badge-planned','In Progress':'badge-in_progress','Completed':'badge-completed','On Hold':'badge-on_hold','Delayed':'badge-delayed','Cancelled':'badge-cancelled' }

export default function SiteDetailPage() {
  const { projectId, siteId } = useParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState('workitems')
  const [showWiModal, setShowWiModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  const { data: site }            = useQuery({ queryKey: ['site', projectId, siteId], queryFn: () => getSite(projectId, siteId) })
  const { data: workItems = [] }  = useQuery({ queryKey: ['workitems', projectId, siteId], queryFn: () => getWorkItems(projectId, siteId) })

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/projects">Projects</Link>
        <span className="breadcrumb-sep">›</span>
        <Link to={`/projects/${projectId}`}>Project #{projectId}</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{site?.address}</span>
      </div>

      <div className="detail-layout">
        <div>
          <div className="page-header">
            <h1 className="page-title">{site?.address}</h1>
            <p className="page-subtitle text-mono text-xs">Site #{siteId}</p>
          </div>

          <div className="tabs">
            {['workitems', 'invitations'].map(t => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'workitems' ? 'Work Items' : 'Invitations'}
              </button>
            ))}
          </div>

          {tab === 'workitems' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="section-title">Work items</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowWiModal(true)}>+ Add work item</button>
              </div>
              {workItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔨</div>
                  <div className="empty-state-title">No work items</div>
                  <p>Break down this site into work phases.</p>
                </div>
              ) : (
                <div className="table-wrap card" style={{ padding: 0 }}>
                  <table>
                    <thead><tr><th>#</th><th>Name</th><th>Status</th><th>Proposed start</th><th>Proposed end</th><th></th></tr></thead>
                    <tbody>
                      {workItems.map(wi => (
                        <tr key={wi.id} style={{ cursor: 'pointer' }}>
                          <td className="text-mono text-xs text-muted">{wi.id}</td>
                          <td>
                            <Link to={`/projects/${projectId}/sites/${siteId}/workitems/${wi.id}`} style={{ color: 'var(--col-ink)', fontWeight: 500, textDecoration: 'none' }}>
                              {wi.name}
                            </Link>
                          </td>
                          <td><span className={`badge ${STATUS_BADGE[wi.work_status] || 'badge-planned'}`}>{wi.work_status}</span></td>
                          <td className="text-sm text-muted">{wi.proposed_start_date ? format(new Date(wi.proposed_start_date), 'MMM d, yyyy') : '—'}</td>
                          <td className="text-sm text-muted">{wi.proposed_end_date ? format(new Date(wi.proposed_end_date), 'MMM d, yyyy') : '—'}</td>
                          <td>
                            <Link to={`/projects/${projectId}/sites/${siteId}/workitems/${wi.id}`} className="btn btn-ghost btn-sm">View →</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="detail-sidebar">
          <div className="card">
            <div className="card-header"><div className="card-title">Site info</div></div>
            <div className="info-list">
              <div className="info-row"><div className="info-row-label">Address</div><div className="info-row-value">{site?.address}</div></div>
              <div className="info-row"><div className="info-row-label">Opened</div><div className="info-row-value">{site?.site_opening_date ? format(new Date(site.site_opening_date), 'MMM d, yyyy') : '—'}</div></div>
              {site?.foreman && <div className="info-row"><div className="info-row-label">Foreman</div><div className="info-row-value">{site.foreman.username}</div></div>}
              {site?.storekeeper && <div className="info-row"><div className="info-row-label">Storekeeper</div><div className="info-row-value">{site.storekeeper.username}</div></div>}
            </div>
            <div className="divider" />
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowInviteModal(true)}>Invite site member</button>
          </div>
        </div>
      </div>

      {showWiModal && <NewWorkItemModal projectId={projectId} siteId={siteId} qc={qc} onClose={() => setShowWiModal(false)} />}
      {showInviteModal && <SiteInviteModal projectId={projectId} siteId={siteId} qc={qc} onClose={() => setShowInviteModal(false)} />}
    </div>
  )
}

function NewWorkItemModal({ projectId, siteId, qc, onClose }) {
  const [form, set] = useState({ name: '', description: '', proposed_end_date: '' })
  const mutation = useMutation({
    mutationFn: d => createWorkItem(projectId, siteId, d),
    onSuccess: () => { qc.invalidateQueries(['workitems', projectId, siteId]); toast.success('Work item added.'); onClose() },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to create work item'),
  })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h2 className="modal-title">New work item</h2></div>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={e => set(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Foundation works" /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={e => set(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Proposed end date</label><input className="form-input" type="date" value={form.proposed_end_date} onChange={e => set(f => ({ ...f, proposed_end_date: e.target.value }))} /></div>
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

function SiteInviteModal({ projectId, siteId, qc, onClose }) {
  const [form, set] = useState({ invitee_id: '', role: 'Foreman' })
  const mutation = useMutation({
    mutationFn: d => inviteToSite(projectId, siteId, d),
    onSuccess: () => { toast.success('Site invitation sent.'); onClose() },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to send invitation'),
  })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h2 className="modal-title">Invite site member</h2></div>
        <div className="form-group"><label className="form-label">User ID</label><input className="form-input" type="number" value={form.invitee_id} onChange={e => set(f => ({ ...f, invitee_id: e.target.value }))} /></div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-select" value={form.role} onChange={e => set(f => ({ ...f, role: e.target.value }))}>
            <option>Foreman</option>
            <option>Storekeeper</option>
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
            {mutation.isPending ? <span className="spinner" /> : 'Send invitation'}
          </button>
        </div>
      </div>
    </div>
  )
}