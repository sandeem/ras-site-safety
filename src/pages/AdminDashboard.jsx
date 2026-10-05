// The admin dashboard: summary, chart, filters, "who submitted at each site", and the list.
// The admin sees every submission because the database's RLS policies allow admins to read all rows.

import { useEffect, useMemo, useState } from 'react'
import { friendlyError, listFramers, listSites, listSubmissions } from '../lib/api.js'
import { localDateString, todayLocal } from '../lib/dates.js'
import SubmissionTable from '../components/SubmissionTable.jsx'
import { Alert, Loading } from '../components/ui.jsx'

// By default show the last 14 days.
const defaultFilters = () => ({ siteId: '', framerId: '', from: localDateString(-13), to: todayLocal() })

export default function AdminDashboard() {
  const [filters, setFilters] = useState(defaultFilters)
  const [sites, setSites] = useState([])
  const [framers, setFramers] = useState([])
  const [submissions, setSubmissions] = useState(null)
  const [todaySubmissions, setTodaySubmissions] = useState(null)
  const [error, setError] = useState('')

  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to)

  // Load the dropdown options and today's submissions once.
  useEffect(() => {
    Promise.all([listSites(), listFramers(), listSubmissions({ from: todayLocal(), to: todayLocal() })])
      .then(([siteList, framerList, today]) => {
        setSites(siteList)
        setFramers(framerList)
        setTodaySubmissions(today)
      })
      .catch((err) => setError(friendlyError(err)))
  }, [])

  // Reload the list whenever a filter changes.
  useEffect(() => {
    if (rangeInvalid) return
    let ignore = false // ignore answers from an older, slower request
    setSubmissions(null)
    listSubmissions(filters)
      .then((result) => !ignore && setSubmissions(result))
      .catch((err) => !ignore && setError(friendlyError(err)))
    return () => {
      ignore = true
    }
  }, [filters, rangeInvalid])

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  // ---- Numbers derived from the loaded data ----
  const summary = useMemo(() => {
    const list = submissions ?? []
    const perSite = sites.map((site) => {
      const forSite = list.filter((s) => s.site_id === site.id)
      // Who submitted at this site, and how many times.
      const counts = new Map()
      for (const s of forSite) {
        const name = s.framer?.full_name ?? 'Unknown'
        counts.set(name, (counts.get(name) ?? 0) + 1)
      }
      return { site, total: forSite.length, workers: [...counts.entries()] }
    })
    return {
      total: list.length,
      flagged: list.filter((s) => s.status === 'flagged').length,
      perSite,
      maxPerSite: Math.max(1, ...perSite.map((row) => row.total)),
    }
  }, [submissions, sites])

  const submittedTodayIds = new Set((todaySubmissions ?? []).map((s) => s.framer_id))
  const notSubmittedToday = framers.filter((f) => !submittedTodayIds.has(f.id))

  return (
    <>
      <h1>Admin dashboard</h1>
      {error && <Alert type="error">{error}</Alert>}

      {/* Summary cards */}
      <section className="stats">
        <div className="stat">
          <strong>{submissions ? summary.total : '...'}</strong>
          <span>Submissions in range</span>
        </div>
        <div className="stat">
          <strong>{submissions ? summary.total - summary.flagged : '...'}</strong>
          <span>Complete</span>
        </div>
        <div className="stat warn">
          <strong>{submissions ? summary.flagged : '...'}</strong>
          <span>Flagged</span>
        </div>
        <div className="stat">
          <strong>
            {todaySubmissions ? `${framers.length - notSubmittedToday.length} / ${framers.length}` : '...'}
          </strong>
          <span>Framers submitted today</span>
        </div>
      </section>

      {/* Who has not submitted today */}
      {todaySubmissions && (
        <section className="card">
          <h2>Not submitted today</h2>
          {notSubmittedToday.length === 0 ? (
            <p className="muted">Everyone has submitted today.</p>
          ) : (
            <ul className="chips">
              {notSubmittedToday.map((f) => (
                <li key={f.id}>{f.full_name}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Filters */}
      <section className="card">
        <h2>Filters</h2>
        <div className="filters">
          <label className="field">
            <span>Site</span>
            <select value={filters.siteId} onChange={(e) => setFilter('siteId', e.target.value)}>
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Worker</span>
            <select value={filters.framerId} onChange={(e) => setFilter('framerId', e.target.value)}>
              <option value="">All workers</option>
              {framers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>From</span>
            <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </label>

          <label className="field">
            <span>To</span>
            <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </label>

          <button className="button secondary" onClick={() => setFilters(defaultFilters())}>
            Reset
          </button>
        </div>
        {rangeInvalid && <small className="error-text">The "From" date must be on or before the "To" date.</small>}
      </section>

      {/* Chart + who submitted per site */}
      <section className="card">
        <h2>Submissions per site</h2>
        {!submissions ? (
          <Loading />
        ) : (
          <ul className="bars">
            {summary.perSite.map(({ site, total, workers }) => (
              <li key={site.id}>
                <div className="bar-head">
                  <span>{site.name}</span>
                  <strong>{total}</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(total / summary.maxPerSite) * 100}%` }} />
                </div>
                <p className="bar-workers">
                  {workers.length === 0
                    ? 'No submissions in this range.'
                    : workers.map(([name, count]) => `${name} (${count})`).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Full list */}
      <section className="card">
        <h2>All submissions</h2>
        {!submissions && !rangeInvalid && <Loading />}
        {submissions && <SubmissionTable submissions={submissions} />}
        {submissions?.length === 500 && <p className="muted">Showing the latest 500. Narrow the filters to see others.</p>}
      </section>
    </>
  )
}
