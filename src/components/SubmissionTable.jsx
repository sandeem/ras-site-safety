// A list of submissions, used by the admin dashboard and by a framer's own history.
// On a phone it turns into stacked cards (see the CSS); on a desktop it is a table.

import { Link } from 'react-router-dom'
import { formatDate, formatTime } from '../lib/dates.js'
import { StatusBadge } from './ui.jsx'

export default function SubmissionTable({ submissions, showWorker = true }) {
  if (submissions.length === 0) {
    return <p className="muted empty">No submissions found.</p>
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            {showWorker && <th>Worker</th>}
            <th>Site</th>
            <th>Status</th>
            <th>Photos</th>
            <th>Submitted</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id}>
              <td data-label="Date">{formatDate(s.work_date)}</td>
              {showWorker && <td data-label="Worker">{s.framer?.full_name}</td>}
              <td data-label="Site">{s.site?.name}</td>
              <td data-label="Status">
                <StatusBadge status={s.status} />
              </td>
              <td data-label="Photos">{s.photos?.[0]?.count ?? 0}</td>
              <td data-label="Submitted">{formatTime(s.created_at)}</td>
              <td className="row-action">
                <Link to={`/submissions/${s.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
