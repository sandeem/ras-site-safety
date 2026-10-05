// The daily safety form a framer fills in on their phone:
// site + date, 8 yes/no checklist items, notes, and 1 to 5 photos.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { createSubmission, friendlyError, listSites } from '../lib/api.js'
import { CHECKLIST_GROUPS, CHECKLIST_ITEMS, computeStatus } from '../lib/checklist.js'
import { todayLocal } from '../lib/dates.js'
import { MAX_PHOTO_MB, MAX_PHOTOS, validateSafetyForm } from '../lib/validation.js'
import { Alert, Loading } from '../components/ui.jsx'

export default function SafetyForm() {
  const { user, profile } = useAuth()

  const [sites, setSites] = useState(null)
  const [siteId, setSiteId] = useState('')
  const [workDate, setWorkDate] = useState(todayLocal())
  const [answers, setAnswers] = useState({}) // { ppe_hard_hat: true, ... }
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState([]) // File objects

  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const topRef = useRef(null)

  useEffect(() => {
    listSites()
      .then(setSites)
      .catch((err) => setSubmitError(friendlyError(err)))
  }, [])

  // Preview URLs for the chosen photos. Rebuilt when the photo list changes, and
  // released on cleanup so the browser can free the memory.
  const previews = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])

  const anyNo = CHECKLIST_ITEMS.some((item) => answers[item.key] === false)

  function addPhotos(event) {
    const chosen = Array.from(event.target.files)
    event.target.value = '' // lets the framer pick the same file again later
    setPhotos((current) => [...current, ...chosen])
    setErrors((current) => ({ ...current, photos: undefined }))
  }

  function removePhoto(index) {
    setPhotos((current) => current.filter((_, i) => i !== index))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')

    const found = validateSafetyForm({ siteId, workDate, answers, notes, photos }, todayLocal())
    setErrors(found)
    if (Object.keys(found).length > 0) {
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    try {
      const id = await createSubmission({ userId: user.id, siteId, workDate, answers, notes, photos })
      setSavedId(id)
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (err) {
      setSubmitError(friendlyError(err))
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  function startAnother() {
    setSiteId('')
    setWorkDate(todayLocal())
    setAnswers({})
    setNotes('')
    setPhotos([])
    setErrors({})
    setSavedId(null)
  }

  if (!sites && !submitError) return <Loading label="Loading sites..." />

  // Success screen
  if (savedId) {
    return (
      <div className="card center" ref={topRef}>
        <Alert type="success">
          <strong>Safety form submitted.</strong> Thank you, {profile.full_name}.
          {computeStatus(answers) === 'flagged' && ' It was flagged for your supervisor because of a "No" answer.'}
        </Alert>
        <div className="actions">
          <Link className="button primary" to={`/submissions/${savedId}`}>
            View submission
          </Link>
          <button className="button secondary" onClick={startAnother}>
            Submit for another site
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div ref={topRef} />
      <h1>Daily safety form</h1>

      {submitError && <Alert type="error">{submitError}</Alert>}
      {Object.keys(errors).length > 0 && (
        <Alert type="error">Please fix the highlighted items below and submit again.</Alert>
      )}

      {/* Who / where / when */}
      <section className="card">
        <div className="field">
          <span>Worker</span>
          <div className="readonly">{profile.full_name}</div>
        </div>

        <label className={`field ${errors.siteId ? 'has-error' : ''}`}>
          <span>Job site</span>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Select your site...</option>
            {sites?.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          {errors.siteId && <small className="error-text">{errors.siteId}</small>}
        </label>

        <label className={`field ${errors.workDate ? 'has-error' : ''}`}>
          <span>Date</span>
          <input type="date" value={workDate} max={todayLocal()} onChange={(e) => setWorkDate(e.target.value)} />
          {errors.workDate && <small className="error-text">{errors.workDate}</small>}
        </label>
      </section>

      {/* Checklist */}
      <section className={`card ${errors.checklist ? 'has-error' : ''}`}>
        <h2>Safety checklist</h2>
        {errors.checklist && <small className="error-text">{errors.checklist}</small>}

        {CHECKLIST_GROUPS.map((group) => (
          <fieldset key={group} className="checklist-group">
            <legend>{group === 'PPE' ? 'Personal protective equipment' : 'Site conditions'}</legend>

            {CHECKLIST_ITEMS.filter((item) => item.group === group).map((item) => (
              <div className="check-row" key={item.key} role="radiogroup" aria-label={item.label}>
                <span className="check-label">{item.label}</span>
                <div className="yes-no">
                  <button
                    type="button"
                    className={`yn yes ${answers[item.key] === true ? 'selected' : ''}`}
                    aria-pressed={answers[item.key] === true}
                    onClick={() => setAnswers({ ...answers, [item.key]: true })}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`yn no ${answers[item.key] === false ? 'selected' : ''}`}
                    aria-pressed={answers[item.key] === false}
                    onClick={() => setAnswers({ ...answers, [item.key]: false })}
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </fieldset>
        ))}
      </section>

      {/* Notes */}
      <section className={`card ${errors.notes ? 'has-error' : ''}`}>
        <label className="field">
          <span>Notes {anyNo ? '(required: you answered "No")' : '(optional)'}</span>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hazards found, what was done about them, anything the supervisor should know."
          />
          {errors.notes && <small className="error-text">{errors.notes}</small>}
        </label>
      </section>

      {/* Photos */}
      <section className={`card ${errors.photos ? 'has-error' : ''}`}>
        <h2>Photos</h2>
        <p className="muted">
          Add 1 to {MAX_PHOTOS} photos (site conditions, PPE, hazards). JPG, PNG or WebP, up to {MAX_PHOTO_MB} MB each.
        </p>

        <div className="photo-buttons">
          <label className="button secondary">
            Take photo
            <input type="file" accept="image/*" capture="environment" onChange={addPhotos} hidden />
          </label>
          <label className="button secondary">
            Choose from library
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} hidden />
          </label>
        </div>
        {errors.photos && <small className="error-text">{errors.photos}</small>}

        {photos.length > 0 && (
          <ul className="previews">
            {photos.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <img src={previews[index]} alt={`Preview of ${file.name}`} />
                <button type="button" className="remove" onClick={() => removePhoto(index)} aria-label={`Remove ${file.name}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="button primary block" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit safety form'}
      </button>
    </form>
  )
}
