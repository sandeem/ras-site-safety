// The route table: which page shows for which URL, and who may open it.

import { Navigate, Route, Routes } from 'react-router-dom'
import { homePathFor, useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { Loading } from './components/ui.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Login from './pages/Login.jsx'
import MySubmissions from './pages/MySubmissions.jsx'
import SafetyForm from './pages/SafetyForm.jsx'
import SubmissionDetail from './pages/SubmissionDetail.jsx'

// "/" sends people to the right place for their role.
function Home() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Loading />
  if (!session || !profile) return <Navigate to="/login" replace />
  return <Navigate to={homePathFor(profile.role)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* Framer pages */}
      <Route path="/form" element={<ProtectedRoute role="framer"><SafetyForm /></ProtectedRoute>} />
      <Route path="/my-submissions" element={<ProtectedRoute role="framer"><MySubmissions /></ProtectedRoute>} />

      {/* Admin page */}
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

      {/* Shared: either role (the database decides whether they may see that submission) */}
      <Route path="/submissions/:id" element={<ProtectedRoute><SubmissionDetail /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
