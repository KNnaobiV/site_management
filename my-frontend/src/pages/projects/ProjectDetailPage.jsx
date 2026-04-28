import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProject, getSites, createSite, inviteToProject, getProjectInvitations } from '../../api/projects'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_BADGE = { 'Planned':'badge-planned','In Progress':'badge-in_progress','Completed':'badge-completed','On Hold':'badge-on_hold','Delayed':'badge-delayed','Cancelled':'badge-cancelled' }
const INV_BADGE = { pending:'badge-pending', accepted:'badge-accepted', declined:'badge-declined', revoked:'badge-revoked', expired:'badge-expired' }

export default function ProjectDetailPage() {
  const { projectId } = useParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState('sites')
  const [showSiteModal, setShowSiteModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  const { data: project, isLoading } = useQuery({ queryKey: ['project', projectId], queryFn: () => getProject(projectId) })
  const { data: sites = [] }          = useQuery({ queryKey: ['sites', projectId],   queryFn: () => getSites(projectId) })
  const { data: invitations = [] }    = useQuery({ queryKey: ['project-invitations', projectId], queryFn: () => getProjectInvitations(projectId), enabled: tab === 'invitations' })

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-16)' }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/projects">Projects</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{project?.project_name}</span>
      </div>

      <div className="detail-layout">
        <div>
          <div className="page-header">
            <div className="flex items-center gap-3" style={{ marginBottom: 'var(--sp-2)' }}>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{project?.project_name}</h1>
              <span className={`badge ${STATUS_BADGE[project?.project_status] || 'badge-planned'}`}>{project?.project_status}</span>
            </div>
            <p className="page-subtitle">{project?.project_description}</p>
          </div>

          <div className="tabs">
            {['sites','invitations'].map(t => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'sites' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="section-title">Construction sites</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowSiteModal(true)}>+ Add site</button>
              </div>
              {sites.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📍</div>
                  <div className="empty-state-title">No sites yet</div>
                  <p>Add the first construction site for this project.</p>
                </div>
              ) : (
                <div className="grid-2">
                  {sites.map(s => (
                    <Link key={s.id} to={`/projects/${projectId}/sites/${s.id}`} style={{ textDecoration: 'none' }}>
                      <div className="card" style={{ cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--col-ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-2)' }}>Site #{s.id}</div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', marginBottom: 'var(--sp-2)' }}>{s.address}</h3>
                        <div className="text-xs text-muted text-mono">Opened: {s.site_opening_date ? format(new Date(s.site_opening_date), 'MMM d, yyyy') : '—'}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'invitations' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="section-title">Project invitations</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowInviteModal(true)}>+ Invite member</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Invitee</th><th>Role</th><th>Status</th><th>Expires</th></tr></thead>
                  <tbody>
                    {invitations.map(inv => (
                      <tr key={inv.id}>
                        <td className="font-medium">{inv.invitee?.username ?? inv.invitee_id}</td>
                        <td><code>{inv.role}</code></td>
                        <td><span className={`badge ${INV_BADGE[inv.status] || ''}`}>{inv.status}</span></td>
                        <td className="text-xs text-mono text-muted">{inv.expires_at ? format(new Date(inv.expires_at), 'MMM d') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="detail-sidebar">
          <div className="card">
            <div className="card-header"><div className="card-title">Details</div></div>
            <div className="info-list">
              <div className="info-row">
                <div className="info-row-label">Client</div>
                <div className="info-row-value">{project?.client?.username ?? '—'}</div>
              </div>
              <div className="info-row">
                <div className="info-row-label">Project manager</div>
                <div className="info-row-value">{project?.project_manager?.username ?? '—'}</div>
              </div>
              <div className="info-row">
                <div className="info-row-label">Start date</div>
                <div className="info-row-value">{project?.project_start_date ? format(new Date(project.project_start_date), 'MMM d, yyyy') : '—'}</div>
              </div>
              <div className="info-row">
                <div className="info-row-label">End date</div>
                <div className="info-row-value">{project?.project_end_date ? format(new Date(project.project_end_date), 'MMM d, yyyy') : 'Ongoing'}</div>
              </div>
              {project?.consultants?.length > 0 && (
                <div className="info-row">
                  <div className="info-row-label">Consultants</div>
                  <div className="info-row-value">{project.consultants.map(c => c.username).join(', ')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSiteModal && <NewSiteModal projectId={projectId} qc={qc} onClose={() => setShowSiteModal(false)} />}
      {showInviteModal && <InviteModal projectId={projectId} qc={qc} onClose={() => setShowInviteModal(false)} />}
    </div>
  )
}

function NewSiteModal({ projectId, qc, onClose }) {
  const [form, set] = useState({ address: '' })
  const mutation = useMutation({
    mutationFn: (d) => createSite(projectId, d),
    onSuccess: () => { qc.invalidateQueries(['sites', projectId]); toast.success('Site added.'); onClose() },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to add site'),
  })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h2 className="modal-title">Add construction site</h2></div>
        <div className="form-group">
          <label className="form-label">Site address</label>
          <input className="form-input" value={form.address} onChange={e => set(f => ({ ...f, address: e.target.value }))} placeholder="12 Broad Street, Lagos" />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
            {mutation.isPending ? <span className="spinner" /> : 'Add site'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InviteModal({ projectId, qc, onClose }) {
  const [form, set] = useState({ invitee_id: '', role: 'Consultant' })
  const mutation = useMutation({
    mutationFn: (d) => inviteToProject(projectId, d),
    onSuccess: () => { qc.invalidateQueries(['project-invitations', projectId]); toast.success('Invitation sent.'); onClose() },
    onError: e => toast.error(e.response?.data?.detail || 'Failed to send invitation'),
  })
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h2 className="modal-title">Invite project member</h2></div>
        <div className="form-group">
          <label className="form-label">User ID</label>
          <input className="form-input" type="number" value={form.invitee_id} onChange={e => set(f => ({ ...f, invitee_id: e.target.value }))} placeholder="User ID" />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-select" value={form.role} onChange={e => set(f => ({ ...f, role: e.target.value }))}>
            <option>Project Manager</option>
            <option>Client</option>
            <option>Consultant</option>
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
