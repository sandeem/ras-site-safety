// The RAS-branded frame around every logged-in page: header, navigation, footer.

import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const isAdmin = profile.role === 'admin'

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <img src="/ras-mark-white.webp" alt="RAS" className="brand-logo" />
            <span className="brand-title">Site Safety</span>
          </div>

          <div className="header-user">
            <span className="user-name">{profile.full_name}</span>
            <span className="role-tag">{isAdmin ? 'Admin' : 'Framer'}</span>
            <button className="link-button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>

        <nav className="nav">
          {isAdmin ? (
            <NavLink to="/admin">Dashboard</NavLink>
          ) : (
            <>
              <NavLink to="/form">New safety form</NavLink>
              <NavLink to="/my-submissions">My submissions</NavLink>
            </>
          )}
        </nav>
      </header>

      <main className="page">{children}</main>

      <footer className="footer">RAS Ron Anderson &amp; Sons Ltd. · Framing &amp; Formwork · Internal safety tool</footer>
    </div>
  )
}
