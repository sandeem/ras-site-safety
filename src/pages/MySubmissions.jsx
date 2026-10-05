// A framer's own history. We don't filter by user here: Row Level Security in the
// database already returns only the logged-in framer's submissions.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { friendlyError, listSubmissions } from '../lib/api.js'
import SubmissionTable from '../components/SubmissionTable.jsx'
import { Alert, Loading } from '../components/ui.jsx'

export default function MySubmissions() {
  const [submissions, setSubmissions] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listSubmissions()
      .then(setSubmissions)
      .catch((err) => setError(friendlyError(err)))
  }, [])

  return (
    <>
      <h1>My submissions</h1>
      {error && <Alert type="error">{error}</Alert>}
      {!submissions && !error && <Loading />}
      {submissions && (
        <>
          <SubmissionTable submissions={submissions} showWorker={false} />
          {submissions.length === 0 && (
            <Link className="button primary" to="/form">
              Fill in today&apos;s form
            </Link>
          )}
        </>
      )}
    </>
  )
}
