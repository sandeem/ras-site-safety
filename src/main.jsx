// App entry point: mounts React into index.html and sets up routing + login state.

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { isSupabaseConfigured } from './lib/supabaseClient.js'
import './styles.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

if (!isSupabaseConfigured) {
  // Friendly message instead of a blank page when the environment variables are missing.
  root.render(
    <main className="page narrow">
      <div className="alert alert-error" role="alert">
        <strong>Supabase is not configured.</strong> Copy <code>.env.example</code> to <code>.env.local</code> and set{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>.
      </div>
    </main>
  )
} else {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
}
