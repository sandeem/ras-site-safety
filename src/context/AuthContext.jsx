// Keeps track of who is logged in, and their profile (name + role), for the whole app.
// Any component can read it with:  const { user, profile, signOut } = useAuth()

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { getProfile } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileFor, setProfileFor] = useState(null) // which user id `profile` belongs to

  // 1. On start-up, read any saved login, then listen for log in / log out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionChecked(true)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // 2. Whenever the logged-in user changes, load their profile.
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return
    let ignore = false // stops an old request from overwriting a newer one

    getProfile(userId)
      .then((result) => !ignore && setProfile(result))
      .catch(() => !ignore && setProfile(null))
      .finally(() => !ignore && setProfileFor(userId))

    return () => {
      ignore = true
    }
  }, [userId])

  // Still loading if we haven't checked for a session yet, or we have a user
  // but their profile hasn't arrived.
  const loading = !sessionChecked || (Boolean(userId) && profileFor !== userId)

  const value = {
    session,
    user: session?.user ?? null,
    profile: userId && profileFor === userId ? profile : null,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

// Where each role lands after logging in.
export function homePathFor(role) {
  return role === 'admin' ? '/admin' : '/form'
}
