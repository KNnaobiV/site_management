import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getProjects, createProject } from '../../api/projects'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_BADGE = {
  'Planned':     'badge-planned',
  'In Progress': 'badge-in_progress',
  'Completed':   'badge-completed',
  'On Hold':     'badge-on_hold',
  'Delayed':     'badge-delayed',
  'Cancelled':   'badge-cancelled',
}

function NewProjectModal({ onClose }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => { qc.invalidateQueries(['projects']); toast.success('Project created.'); onClose() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create project'),
  })

  const [form, set] = useState({ project_name: '', project_description: '', project_end_date: '', client_id: '', project_manager_id: '' })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">New project</h2>
        </div>
        <div className="form-group">
          <label className="form-label">Project name</label>
          <input className="form-input" value={form.project_name} onChange={e => set(f => ({ ...f, project_name: e.target.value }))} placeholder="e.g. Maitama Residential Complex" />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={form.project_description} onChange={e => set(f => ({ ...f, project_description: e.target.value }))} placeholder="Brief overview of the project..." />
        </div>
        <div className="grid-2" style={{ gap: 'var(--sp-3)' }}>
          <div className="form-group">
            <label className="form-label">Client user ID</label>
            <input className="form-input" type="number" value={form.client_id} onChange={e => set(f => ({ ...f, client_id: e.target.value }))} placeholder="User ID" />
          </div>
          <div className="form-group">
            <label className="form-label">Project manager ID</label>
            <input className="form-input" type="number" value={form.project_manager_id} onChange={e => set(f => ({ ...f, project_manager_id: e.target.value }))} placeholder="User ID" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">End date (optional)</label>
          <input className="form-input" type="date" value={form.project_end_date} onChange={e => set(f => ({ ...f, project_end_date: e.target.value }))} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
            {mutation.isPending ? <span className="spinner" /> : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const [showModal, setShowModal] = useState(false)
  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: getProjects })

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">All construction projects you are part of</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New project</button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-16)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : projects?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏗️</div>
          <div className="empty-state-title">No projects yet</div>
          <p>Create your first construction project to get started.</p>
        </div>
      ) : (
        <div className="grid-3">
          {projects?.map(p => (
            <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow var(--t-fast)', ':hover': { boxShadow: 'var(--shadow-md)' } }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}>
                <div className="card-header" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--col-ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--sp-2)' }}>
                      Project #{p.id}
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', lineHeight: 1.3 }}>{p.project_name}</h3>
                  </div>
                  <span className={`badge ${STATUS_BADGE[p.project_status] || 'badge-planned'}`}>{p.project_status}</span>
                </div>
                <p className="text-sm text-muted" style={{ marginBottom: 'var(--sp-4)', lineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {p.project_description || 'No description provided.'}
                </p>
                <div className="divider" style={{ margin: 'var(--sp-4) 0' }} />
                <div className="flex gap-4 text-xs text-mono text-muted">
                  <span>Start: {p.project_start_date ? format(new Date(p.project_start_date), 'MMM d, yyyy') : '—'}</span>
                  <span>End: {p.project_end_date ? format(new Date(p.project_end_date), 'MMM d, yyyy') : 'Ongoing'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && <NewProjectModal onClose={() => setShowModal(false)} />}
    </div>
  )
}