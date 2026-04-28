import { useMyInvitations, useInvitationActions } from '../../hooks/useInvitations'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_BADGE = { pending:'badge-pending', accepted:'badge-accepted', declined:'badge-declined', revoked:'badge-revoked', expired:'badge-expired' }

function InvitationCard({ inv, type, actions }) {
  const isPending = inv.status === 'pending'

  async function handle(action) {
    try {
      await action(inv.id)
      toast.success('Done.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed')
    }
  }

  return (
    <div className="card">
      <div className="card-header" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--col-ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-1)' }}>
            {type === 'project' ? '🏗 Project invitation' : '📍 Site invitation'}
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
            {type === 'project' ? inv.project?.project_name ?? `Project #${inv.project}` : `Site #${inv.site}`}
          </h3>
          <div className="text-sm text-muted" style={{ marginTop: 'var(--sp-1)' }}>
            Role: <code>{inv.role}</code> · Invited by <strong>{inv.invited_by?.username}</strong>
          </div>
        </div>
        <span className={`badge ${STATUS_BADGE[inv.status] || ''}`}>{inv.status}</span>
      </div>

      <div className="divider" style={{ margin: 'var(--sp-3) 0' }} />

      <div className="flex justify-between items-center">
        <span className="text-xs text-mono text-muted">
          Expires: {inv.expires_at ? format(new Date(inv.expires_at), 'MMM d, yyyy') : '—'}
        </span>
        {isPending && (
          <div className="flex gap-2">
            <button
              className="btn btn-sm"
              style={{ background: 'var(--col-green)', color: 'white' }}
              onClick={() => handle(type === 'project' ? actions.acceptProject.mutateAsync : actions.acceptSite.mutateAsync)}
            >Accept</button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => handle(type === 'project' ? actions.declineProject.mutateAsync : actions.declineSite.mutateAsync)}
            >Decline</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function InvitationsPage() {
  const { projectInvitations, siteInvitations, isLoading } = useMyInvitations()
  const actions = useInvitationActions()

  const all = [
    ...projectInvitations.map(i => ({ ...i, _type: 'project' })),
    ...siteInvitations.map(i => ({ ...i, _type: 'site' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const pending  = all.filter(i => i.status === 'pending')
  const past     = all.filter(i => i.status !== 'pending')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Invitations</h1>
        <p className="page-subtitle">Project and site invitations sent to you</p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-16)' }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: 'var(--sp-8)' }}>
              <h2 className="section-title">Pending ({pending.length})</h2>
              <div className="grid-2">
                {pending.map(inv => <InvitationCard key={`${inv._type}-${inv.id}`} inv={inv} type={inv._type} actions={actions} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="section-title">Past invitations</h2>
              <div className="grid-2">
                {past.map(inv => <InvitationCard key={`${inv._type}-${inv.id}`} inv={inv} type={inv._type} actions={actions} />)}
              </div>
            </div>
          )}

          {all.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">✉️</div>
              <div className="empty-state-title">No invitations</div>
              <p>When someone invites you to a project or site, it will appear here.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}