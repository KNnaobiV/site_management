import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../../api/auth'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, set] = useState({ username: '', email: '', first_name: '', last_name: '', password: '', password2: '' })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.password2) {
      setErrors({ password2: 'Passwords do not match' })
      return
    }
    setBusy(true)
    setErrors({})
    try {
      await register(form)
      toast.success('Account created — sign in to continue.')
      navigate('/login')
    } catch (e) {
      setErrors(e.response?.data ?? { non_field_errors: 'Registration failed' })
    } finally {
      setBusy(false)
    }
  }

  const field = (name, label, type = 'text', placeholder = '') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        className="form-input"
        type={type}
        placeholder={placeholder}
        value={form[name]}
        onChange={e => set(f => ({ ...f, [name]: e.target.value }))}
        required={['username','email','password','password2'].includes(name)}
      />
      {errors[name] && <p className="form-error">{[].concat(errors[name]).join(', ')}</p>}
    </div>
  )

  return (
    <div className="auth-shell">
      <div className="auth-panel-left">
        <div className="auth-brand">Build<span>Track</span></div>
        <div className="auth-headline">
          <h2>Join your construction team.</h2>
          <p>Create your account to start collaborating on projects and sites.</p>
        </div>
      </div>

      <div className="auth-panel-right">
        <div className="auth-form-wrap">
          <h1 className="auth-form-title">Create account</h1>
          <p className="auth-form-sub">Fill in your details below</p>

          <form onSubmit={handleSubmit}>
            <div className="grid-2" style={{ gap: 'var(--sp-3)' }}>
              {field('first_name', 'First name', 'text', 'Jane')}
              {field('last_name',  'Last name',  'text', 'Smith')}
            </div>
            {field('username', 'Username', 'text', 'jane_smith')}
            {field('email',    'Email',    'email', 'jane@example.com')}
            {field('password',  'Password',         'password', '••••••••')}
            {field('password2', 'Confirm password', 'password', '••••••••')}

            {errors.non_field_errors && <p className="form-error" style={{ marginBottom: 'var(--sp-4)' }}>{errors.non_field_errors}</p>}

            <button className="btn btn-primary btn-lg" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? <span className="spinner" /> : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-muted" style={{ textAlign: 'center', marginTop: 'var(--sp-6)' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}