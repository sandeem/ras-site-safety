// Form validation as plain functions (no React), so they are easy to unit test.
// The database and storage bucket enforce the same limits again on the server.

import { CHECKLIST_ITEMS } from './checklist.js'

export const MAX_PHOTOS = 5
export const MAX_PHOTO_MB = 10
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Returns an error message, or null if the photos are fine.
export function validatePhotos(photos) {
  if (photos.length === 0) return 'Add at least one photo of the site.'
  if (photos.length > MAX_PHOTOS) return `You can attach up to ${MAX_PHOTOS} photos.`

  for (const photo of photos) {
    if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
      return `"${photo.name}" is not a JPG, PNG or WebP image.`
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return `"${photo.name}" is larger than ${MAX_PHOTO_MB} MB.`
    }
  }
  return null
}

// Checks the whole safety form.
// Returns an object of { fieldName: message }. An empty object means the form is valid.
export function validateSafetyForm({ siteId, workDate, answers, notes, photos }, today) {
  const errors = {}

  if (!siteId) errors.siteId = 'Choose your job site.'

  if (!workDate) errors.workDate = 'Choose the date.'
  else if (workDate > today) errors.workDate = "The date can't be in the future."

  const unanswered = CHECKLIST_ITEMS.filter((item) => typeof answers[item.key] !== 'boolean')
  if (unanswered.length > 0) {
    errors.checklist = `Answer every checklist item (${unanswered.length} left).`
  }

  const anyNo = CHECKLIST_ITEMS.some((item) => answers[item.key] === false)
  if (anyNo && !notes.trim()) {
    errors.notes = 'You answered "No" to an item. Describe the problem and what was done about it.'
  }

  const photoError = validatePhotos(photos)
  if (photoError) errors.photos = photoError

  return errors
}
