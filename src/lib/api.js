// Every database and storage call the app makes lives in this file.
// Pages call these functions instead of talking to Supabase directly, so the
// data logic is in one place and the pages stay focused on the UI.
//
// Security note: these queries do NOT have to filter by user for safety.
// Row Level Security in the database already limits what each user gets back.

import { supabase } from './supabaseClient.js'

const PHOTO_BUCKET = 'safety-photos'

// Supabase returns { data, error }. This turns an error into a thrown exception,
// so pages can use a normal try/catch.
function unwrap({ data, error }) {
  if (error) throw error
  return data
}

// Turns database errors into messages a framer can act on.
export function friendlyError(error) {
  if (error?.code === '23505') {
    return 'You have already submitted a safety form for this site on this date.'
  }
  if (error?.message?.toLowerCase().includes('failed to fetch')) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return error?.message || 'Something went wrong. Please try again.'
}

// ---------------------------------------------------------------------------
// Profiles and sites
// ---------------------------------------------------------------------------

export async function getProfile(userId) {
  return unwrap(
    await supabase.from('profiles').select('id, full_name, role').eq('id', userId).maybeSingle()
  )
}

export async function listSites() {
  return unwrap(
    await supabase.from('sites').select('id, name, address').eq('is_active', true).order('name')
  )
}

// Admin only (RLS returns just your own profile to a framer).
export async function listFramers() {
  return unwrap(
    await supabase.from('profiles').select('id, full_name').eq('role', 'framer').order('full_name')
  )
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

// List submissions with optional filters. Used by both the admin dashboard and
// a framer's "My submissions" page.
export async function listSubmissions({ siteId, framerId, from, to } = {}) {
  let query = supabase
    .from('submissions')
    .select(
      'id, work_date, status, created_at, framer_id, site_id, ' +
        'site:sites(name), framer:profiles(full_name), photos:submission_photos(count)'
    )
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (siteId) query = query.eq('site_id', siteId)
  if (framerId) query = query.eq('framer_id', framerId)
  if (from) query = query.gte('work_date', from)
  if (to) query = query.lte('work_date', to)

  return unwrap(await query)
}

// One submission with its site, worker and photo records. Returns null if it
// doesn't exist OR the user isn't allowed to see it (RLS hides it).
export async function getSubmission(id) {
  return unwrap(
    await supabase
      .from('submissions')
      .select(
        '*, site:sites(name, address), framer:profiles(full_name), ' +
          'photos:submission_photos(id, storage_path, file_name)'
      )
      .eq('id', id)
      .maybeSingle()
  )
}

// Saves a new safety form:
//   1. upload each photo to Storage, in the framer's own folder
//   2. insert the submission row
//   3. insert one submission_photos row per uploaded file
// Returns the new submission id.
export async function createSubmission({ userId, siteId, workDate, answers, notes, photos }) {
  // A unique folder for this form's photos, e.g. "<user id>/2026-10-04-1759600000000"
  const folder = `${userId}/${workDate}-${Date.now()}`

  const photoRows = []
  for (const [index, photo] of photos.entries()) {
    const safeName = photo.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
    const path = `${folder}/${index + 1}-${safeName}`

    unwrap(
      await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: photo.type })
    )
    photoRows.push({
      storage_path: path,
      file_name: photo.name,
      mime_type: photo.type,
      size_bytes: photo.size,
    })
  }

  try {
    const submission = unwrap(
      await supabase
        .from('submissions')
        .insert({
          framer_id: userId,
          site_id: siteId,
          work_date: workDate,
          notes: notes.trim() || null,
          ...answers,
        })
        .select('id')
        .single()
    )

    unwrap(
      await supabase
        .from('submission_photos')
        .insert(photoRows.map((row) => ({ ...row, submission_id: submission.id })))
    )

    return submission.id
  } catch (error) {
    // The form was not saved (for example a duplicate for that day), so remove the
    // photos we just uploaded instead of leaving orphaned files behind.
    await supabase.storage.from(PHOTO_BUCKET).remove(photoRows.map((row) => row.storage_path))
    throw error
  }
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

// The bucket is private, so photos are shown through signed links that expire
// after an hour. Returns { storage_path: url }.
export async function getPhotoUrls(paths) {
  if (paths.length === 0) return {}
  const signed = unwrap(await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60))
  return Object.fromEntries(signed.map((item) => [item.path, item.signedUrl]))
}
