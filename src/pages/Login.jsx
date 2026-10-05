// Login page. Framers and admins use the same form; the role decides where they land.

import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { homePathFor, useAuth } from '../context/AuthContext.jsx'
import { Alert, Loading } from '../components/ui.jsx'

export default function Login() {
  const { session, profile, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <Loading />

  // Already logged in: go straight to the right home page.
  if (session && profile) return <Navigate to={homePathFor(profile.role)} replace />

  async function handleSubmit(event) {
    event.preventDefault() // stop the browser's default full-page form submit
    setError('')
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate('/', { replace: true }) // "/" redirects to the right home page
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email or password is incorrect.'
          : err.message || 'Could not log in. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <img src="/ras-logo.webp" alt="RAS Framing & Formwork" className="login-logo" />
        <h1>Site Safety Forms</h1>
        <p className="muted">Log in with the account your supervisor gave you.</p>

        {error && <Alert type="error">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button className="button primary block" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
    </main>
  )
}
