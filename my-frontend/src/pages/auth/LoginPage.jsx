import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const [form, set] = useState({ username: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await login(form.username, form.password)
      toast.success('Welcome back.')
      navigate('/projects')
    } catch (e) {
      setErr(e.response?.data?.detail || 'Invalid credentials')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel-left">
        <div className="auth-brand">Build<span>Track</span></div>
        <div className="auth-headline">
          <h2>Construction, managed with precision.</h2>
          <p>Track projects, sites, work items, and daily reports — all in one place for your entire team.</p>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--col-ink-4)', letterSpacing: '0.06em' }}>
          INFRASTRUCTURE · MANAGEMENT · REPORTING
        </div>
      </div>

      <div className="auth-panel-right">
        <div className="auth-form-wrap">
          <h1 className="auth-form-title">Sign in</h1>
          <p className="auth-form-sub">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="your_username"
                value={form.username}
                onChange={e => set(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => set(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>

            {err && <p className="form-error" style={{ marginBottom: 'var(--sp-4)' }}>{err}</p>}

            <button className="btn btn-primary btn-lg" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? <span className="spinner" /> : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-muted" style={{ textAlign: 'center', marginTop: 'var(--sp-6)' }}>
            No account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}