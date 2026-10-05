// One submission in full: who, where, when, every checklist answer, notes and photos.
// Used by both roles. A framer opening someone else's link gets "not found",
// because the database (RLS) simply doesn't return rows they aren't allowed to see.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { friendlyError, getSubmission } from '../lib/api.js'
import { CHECKLIST_GROUPS, CHECKLIST_ITEMS } from '../lib/checklist.js'
import { formatDate, formatTime } from '../lib/dates.js'
import PhotoGallery from '../components/PhotoGallery.jsx'
import { Alert, Loading, StatusBadge } from '../components/ui.jsx'

export default function SubmissionDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [submission, setSubmission] = useState(undefined) // undefined = loading, null = not found
  const [error, setError] = useState('')

  useEffect(() => {
    getSubmission(id)
      .then(setSubmission)
      .catch((err) => setError(friendlyError(err)))
  }, [id])

  const backTo = profile.role === 'admin' ? '/admin' : '/my-submissions'

  if (error) return <Alert type="error">{error}</Alert>
  if (submission === undefined) return <Loading />
  if (submission === null) {
    return (
      <>
        <Alert type="error">That submission was not found, or you don&apos;t have access to it.</Alert>
        <Link to={backTo}>Back</Link>
      </>
    )
  }

  return (
    <>
      <Link to={backTo} className="back">
        ← Back
      </Link>
      <h1>
        Safety form <StatusBadge status={submission.status} />
      </h1>

      <section className="card">
        <dl className="facts">
          <div>
            <dt>Worker</dt>
            <dd>{submission.framer?.full_name}</dd>
          </div>
          <div>
            <dt>Site</dt>
            <dd>{submission.site?.name}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(submission.work_date)}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{formatTime(submission.created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2>Checklist</h2>
        {CHECKLIST_GROUPS.map((group) => (
          <ul key={group} className="answers">
            {CHECKLIST_ITEMS.filter((item) => item.group === group).map((item) => (
              <li key={item.key} className={submission[item.key] ? 'yes' : 'no'}>
                <span>{item.label}</span>
                <strong>{submission[item.key] ? 'Yes' : 'No'}</strong>
              </li>
            ))}
          </ul>
        ))}
      </section>

      <section className="card">
        <h2>Notes</h2>
        <p className={submission.notes ? '' : 'muted'}>{submission.notes || 'No notes.'}</p>
      </section>

      <section className="card">
        <h2>Photos ({submission.photos.length})</h2>
        <PhotoGallery photos={submission.photos} />
      </section>
    </>
  )
}
