// scripts/seed.mjs
//
// Fills the database with demo data so the form and dashboard have something to show:
//   - 4 job sites
//   - 1 admin and 4 framer login accounts (the test credentials in the README)
//   - about two weeks of safety submissions, some of them flagged, each with photos
//
// It uses the SERVICE ROLE key, which bypasses Row Level Security. That key must
// never be used in the browser app; it only lives in your local .env.seed file.
//
// Run:  npm run seed      (reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.seed)
// Safe to run more than once: existing users, sites and submissions are reused, not duplicated.

import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.seed.example to .env.seed and fill it in.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BUCKET = 'safety-photos'

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const SITES = [
  { name: 'Chemainus Townhomes', address: 'Chemainus, BC' },
  { name: 'Nanaimo Harbourview Apartments', address: 'Nanaimo, BC' },
  { name: 'Duncan Commons', address: 'Duncan, BC' },
  { name: 'Langford Station Rentals', address: 'Langford, BC' },
]

const ADMIN = { email: 'admin@example.com', password: 'RasAdmin2026!', full_name: 'Morgan Lee', role: 'admin' }

const FRAMER_PASSWORD = 'RasFramer2026!'
const FRAMERS = [
  { email: 'jordan.framer@example.com', full_name: 'Jordan Miller', site: 'Chemainus Townhomes' },
  { email: 'sam.framer@example.com', full_name: 'Sam Patel', site: 'Nanaimo Harbourview Apartments' },
  { email: 'alex.framer@example.com', full_name: 'Alex Chen', site: 'Duncan Commons' },
  { email: 'taylor.framer@example.com', full_name: 'Taylor Brooks', site: 'Chemainus Townhomes' },
]

const PHOTOS = ['site-conditions.webp', 'ppe-check.webp', 'fall-protection.webp', 'hazard-cord.webp']

const CHECKLIST_KEYS = [
  'ppe_hard_hat',
  'ppe_hi_vis_vest',
  'ppe_safety_boots',
  'ppe_eye_protection',
  'fall_protection_in_place',
  'ladders_scaffolding_inspected',
  'tools_cords_good_condition',
  'hazards_identified',
]

// Problems a flagged submission can report: [checklist item that is "No", note].
const ISSUES = [
  ['tools_cords_good_condition', 'Damaged extension cord on level 2 walkway. Tagged out and replaced before work started.'],
  ['ladders_scaffolding_inspected', 'Scaffold tag missing on the north elevation. Supervisor notified, scaffold not used until inspected.'],
  ['ppe_eye_protection', 'Two crew members arrived without safety glasses. Spares issued from the site trailer.'],
  ['fall_protection_in_place', 'Guardrail removed at stair opening for material delivery. Reinstalled at 9:15.'],
]

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// The same "random" numbers every run, so the demo data is predictable.
let seed = 42
function random() {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}

// Local date as YYYY-MM-DD, n days from today (negative = in the past).
function localDate(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function fail(step, error) {
  console.error(`\n${step} failed:`, error.message ?? error)
  process.exit(1)
}

// Create the login user, or reuse it if it already exists. Returns the user id.
async function upsertUser({ email, password, full_name }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })
  if (!error) return data.user.id

  // Already exists: find it and reset its password so the README credentials always work.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) fail(`Looking up ${email}`, listError)
  const existing = list.users.find((u) => u.email === email)
  if (!existing) fail(`Creating ${email}`, error)
  await supabase.auth.admin.updateUserById(existing.id, { password, user_metadata: { full_name } })
  return existing.id
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding', SUPABASE_URL)

  // 1. Sites
  const { data: sites, error: siteError } = await supabase
    .from('sites')
    .upsert(SITES, { onConflict: 'name' })
    .select('id, name')
  if (siteError) fail('Creating sites', siteError)
  const siteIdByName = Object.fromEntries(sites.map((s) => [s.name, s.id]))
  console.log(`  sites: ${sites.length}`)

  // 2. Users. The database trigger creates each profile as 'framer'; we set the real name and role.
  const people = [ADMIN, ...FRAMERS.map((f) => ({ ...f, password: FRAMER_PASSWORD, role: 'framer' }))]
  for (const person of people) {
    person.id = await upsertUser(person)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: person.full_name, role: person.role })
      .eq('id', person.id)
    if (error) fail(`Updating profile for ${person.email}`, error)
  }
  console.log(`  users: ${people.length} (1 admin, ${FRAMERS.length} framers)`)

  // 3. Photo files (read once, uploaded once per submission).
  const photoFiles = {}
  for (const name of PHOTOS) {
    photoFiles[name] = await readFile(new URL(`./seed-photos/${name}`, import.meta.url))
  }

  // 4. Submissions for the last 13 days plus today.
  //    Today only two framers have submitted, so the dashboard shows who is missing.
  let created = 0
  let skipped = 0
  const framers = people.filter((p) => p.role === 'framer')

  for (let offset = -13; offset <= 0; offset++) {
    const workDate = localDate(offset)
    const isSunday = new Date(`${workDate}T12:00:00`).getDay() === 0
    if (isSunday) continue

    for (const [index, framer] of framers.entries()) {
      if (offset === 0 && index >= 2) continue           // Alex and Taylor haven't submitted today
      if (offset < 0 && random() < 0.12) continue        // the odd missed day

      // Alex sometimes works the Langford site.
      const siteName = framer.site === 'Duncan Commons' && offset % 3 === 0 ? 'Langford Station Rentals' : framer.site
      const siteId = siteIdByName[siteName]

      // Decide this submission's answers BEFORE checking if it exists, so every run
      // draws the same random numbers in the same order (keeps re-runs identical).
      const answers = Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, true]))
      let notes = random() < 0.4 ? 'All clear. Toolbox talk held at start of shift.' : null
      let photoNames = [PHOTOS[0], PHOTOS[1]]

      if (random() < 0.18) {
        const [badItem, note] = ISSUES[Math.floor(random() * ISSUES.length)]
        answers[badItem] = false
        notes = note
        photoNames = [PHOTOS[0], badItem === 'tools_cords_good_condition' ? PHOTOS[3] : PHOTOS[2]]
      } else if (random() < 0.3) {
        photoNames = [PHOTOS[0]]
      }

      const { data: existing } = await supabase
        .from('submissions')
        .select('id')
        .eq('framer_id', framer.id)
        .eq('site_id', siteId)
        .eq('work_date', workDate)
        .maybeSingle()
      if (existing) {
        skipped++
        continue
      }

      const submissionId = crypto.randomUUID()

      // Upload the photos first, into {user_id}/{submission_id}/...
      const photoRows = []
      for (const [i, name] of photoNames.entries()) {
        const path = `${framer.id}/${submissionId}/${i + 1}-${name}`
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, photoFiles[name], { contentType: 'image/webp', upsert: true })
        if (error) fail(`Uploading ${path}`, error)
        photoRows.push({
          submission_id: submissionId,
          storage_path: path,
          file_name: name,
          mime_type: 'image/webp',
          size_bytes: photoFiles[name].length,
        })
      }

      const { error: insertError } = await supabase.from('submissions').insert({
        id: submissionId,
        framer_id: framer.id,
        site_id: siteId,
        work_date: workDate,
        notes,
        ...answers,
        // Spread the submit time across the morning so the list looks realistic.
        created_at: new Date(`${workDate}T0${6 + (index % 3)}:${String(10 + index * 7).padStart(2, '0')}:00`).toISOString(),
      })
      if (insertError) fail(`Inserting submission for ${framer.email} on ${workDate}`, insertError)

      const { error: photoError } = await supabase.from('submission_photos').insert(photoRows)
      if (photoError) fail('Inserting photo rows', photoError)

      created++
    }
  }

  console.log(`  submissions: ${created} created, ${skipped} already existed`)
  console.log('\nDone. Test logins:')
  console.log(`  Admin:  ${ADMIN.email} / ${ADMIN.password}`)
  console.log(`  Framer: ${FRAMERS[0].email} / ${FRAMER_PASSWORD}  (also sam, alex, taylor)`)
}

main().catch((error) => fail('Seed', error))
