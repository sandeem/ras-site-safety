// Wraps a page that needs a login (and optionally a specific role).
// This controls what the UI SHOWS. The real protection is Row Level Security in
// the database: even if someone bypassed this, they would get no data.

import { Navigate } from 'react-router-dom'
import { homePathFor, useAuth } from '../context/AuthContext.jsx'
import Layout from './Layout.jsx'
import { Alert, Loading } from './ui.jsx'

export default function ProtectedRoute({ role, children }) {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) return <Loading label="Loading your account..." />

  if (!session) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <main className="page narrow">
        <Alert type="error">
          Your login worked, but no profile was found for this account. Ask an admin to set one up.
        </Alert>
        <button className="button secondary" onClick={signOut}>
          Sign out
        </button>
      </main>
    )
  }

  // Logged in, but this page is for the other role: send them to their own home page.
  if (role && profile.role !== role) return <Navigate to={homePathFor(profile.role)} replace />

  return <Layout>{children}</Layout>
}
