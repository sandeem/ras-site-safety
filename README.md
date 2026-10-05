# RAS Site Safety — Daily Safety Forms

A small internal tool for Ron Anderson & Sons (RAS). Framers complete a daily safety checklist for
the site they are on (with photos); an administrator reviews who submitted what, where and when.

Built with React, Vite and Supabase. Access control is enforced in the database with PostgreSQL
**Row Level Security**, not only in the UI.

- **Live app:** _add the deployed URL here_ (see [Deploying](#deploying))
- **Entity-Relationship Diagram:** [`docs/erd.svg`](docs/erd.svg)

---

## Demo accounts

The seed script creates the demo logins — one admin and four framers — and prints their usernames and
passwords when it finishes. They are not listed here; the credentials are provided separately to the
reviewer. See [Local setup](#local-setup) to create them.

---

## What it does

**Framer (worker)**

- Logs in and lands on the daily safety form.
- Picks the job site and date; their name is taken from the logged-in account.
- Completes an eight-item safety checklist (hard hat, hi-vis vest, safety boots, eye protection,
  fall protection, ladders/scaffolding, tools and cords, hazards identified) plus a free-text notes field.
- Attaches one or more photos (JPEG/PNG/WebP, up to 10 MB each) with a live preview.
- Gets clear validation and success/error messages, and can revisit their own past submissions,
  including the photos.

**Admin (supervisor)**

- Dashboard with a summary (submissions in range, complete vs flagged, who has not submitted today).
- Filters by **site**, **worker** and **date range**.
- Per-site breakdown that shows how many forms came from each site **and who submitted them**.
- Bar chart of submissions per site.
- Opens any submission to read the checklist, notes and photos.

A submission is **flagged** automatically when any checklist answer is "No", so the status can
never disagree with the answers themselves.

---

## Tech stack

| Layer     | Choice                                                            |
| --------- | ----------------------------------------------------------------- |
| Frontend  | React 18, React Router 6, Vite 6                                  |
| Backend   | Supabase (hosted Postgres + Auth + Storage) — no custom server    |
| Database  | PostgreSQL with Row Level Security on every table                 |
| Testing   | Vitest (unit tests) + a SQL script that exercises the RLS policies |
| Hosting   | Vercel (static build), Supabase for data                          |

Only four runtime dependencies: `react`, `react-dom`, `react-router-dom` and `@supabase/supabase-js`.

---

## Data model

Four tables, documented in full in [`docs/erd.svg`](docs/erd.svg)
(source: [`docs/erd.mmd`](docs/erd.mmd)):

- **profiles** — one row per login user (name + role `framer`/`admin`), linked to `auth.users`.
- **sites** — the job sites.
- **submissions** — one daily safety form: the eight checklist answers, notes, the site, the framer and
  the date. `status` is a **generated column** (`complete` / `flagged`). A unique constraint allows only
  one form per framer, per site, per day.
- **submission_photos** — the photos attached to a submission. The files themselves live in a private
  Storage bucket; the table stores the path and metadata.

---

## Security model

The browser only ever holds the public **anon key**, so it can do nothing beyond what the policies allow.

- A framer can **read and create only their own** submissions, photos and profile.
- An admin can **read everything** (but the schema still prevents a framer from escalating their own role).
- Any logged-in user can read the site list; a logged-out visitor can read nothing.
- Photo files live in a **private** bucket (`safety-photos`) under `{user_id}/{submission_id}/{file}` and are
  served through short-lived signed URLs. A framer may upload to, and delete from, only their own folder.
- New sign-ups are always framers. Becoming an admin requires the service key (the seed script or the
  Supabase dashboard), so it cannot be done from the app.

The policies are exercised by [`supabase/security_checks.sql`](supabase/security_checks.sql) — it acts as
each user the way Supabase does and asserts what that user can and cannot see or change.

---

## Local setup

**Requirements:** Node 20+, and either Docker (for local Supabase) or a free hosted Supabase project.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create the database schema**

   *Local (Docker):*

   ```bash
   npx supabase start
   npx supabase db reset   # applies supabase/migrations/*.sql
   ```

   *Hosted:* create a project, then paste `supabase/migrations/20261004000000_initial_schema.sql`
   into the SQL editor and run it. (Or run `npx supabase link` then `npx supabase db push`.)

3. **Point the app at Supabase** — copy `.env.example` to `.env.local` and fill in the API URL and
   anon/publishable key (`npx supabase status` for local, or Project Settings → API for hosted).

4. **Seed demo data** (sites, users, about two weeks of submissions with photos) — copy
   `.env.seed.example` to `.env.seed`, add the **service role** key, then run:

   ```bash
   npm run seed
   ```

   The seed is safe to run more than once: it reuses existing users, sites and submissions.

5. **Run the app**

   ```bash
   npm run dev     # http://localhost:5173
   ```

   Log in with a demo account (the seed script prints the usernames and passwords — see [Demo accounts](#demo-accounts)).

---

## Scripts

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `npm run dev`     | Start the Vite dev server                                 |
| `npm run build`   | Production build into `dist/`                             |
| `npm run preview` | Serve the production build locally                        |
| `npm test`        | Run the unit tests (Vitest)                               |
| `npm run seed`    | Fill the database with demo data (needs `.env.seed`)      |

---

## Tests

```bash
npm test
```

Unit tests cover the shared form logic (checklist definition, validation, date helpers). The database
security rules are checked separately:

```bash
docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) \
  psql -U postgres -v ON_ERROR_STOP=1 -f - < supabase/security_checks.sql
```

Every line should print `PASS`.

---

## Deploying

**Supabase (data):** create a hosted project, run the migration (step 2 above), then run the seed
against it by pointing `.env.seed` at the hosted project.

**Vercel (app):**

1. Import this repository.
2. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings →
   Environment Variables).
3. Build command `npm run build`, output directory `dist` (already set in `vercel.json`, which also
   contains the SPA rewrite so client-side routes work on refresh).
4. Copy the deployed URL into the **Live app** line at the top of this README.

**Netlify instead of Vercel:** import the repository, set the same two environment variables, use build
command `npm run build` and publish directory `dist`, and add a redirect rule of `/*  /index.html  200`
(Netlify's equivalent of the SPA rewrite already in `vercel.json`).

---

## Project structure

```
src/
  components/   Layout, ProtectedRoute, SubmissionTable, PhotoGallery, shared ui
  context/      AuthContext (session + profile + role)
  lib/          supabaseClient, api (data access), checklist, dates, validation
  pages/        Login, SafetyForm, MySubmissions, SubmissionDetail, AdminDashboard
  App.jsx       routes, main.jsx entry, styles.css (mobile-first)
scripts/
  seed.mjs      demo data + photo uploads
  seed-photos/  the sample photos used by the seed
supabase/
  migrations/   schema, RLS policies and the private storage bucket
  security_checks.sql
 docs/
  erd.svg, erd.mmd
public/         RAS logo assets and favicon
```

---

## Assumptions

Where the brief left room, these decisions were made:

1. **One form per framer, per site, per day.** The brief describes a daily form filled in before work
   starts, so a unique constraint enforces this and the form reports it clearly if a framer tries again.
2. **Roles are fixed at creation.** New sign-ups are always framers; admins are promoted out-of-band
   (service key / dashboard). The app never lets a user change their own role.
3. **Status is computed by the database.** `complete` only when all eight answers are "yes", otherwise
   `flagged` — so the dashboard can never show a status that contradicts the checklist.
4. **Sites are a managed list.** Rather than free text, sites are rows in the database (seeded with four
   BC sites), which keeps the dashboard filters and the form consistent.
5. **Photos are private.** They are served through signed URLs rather than public links.
6. **No delete UI.** Deleting submissions is not part of the brief, so it is deliberately left out; the
   schema and policies would support adding it safely later.
7. **"Today"** means the server's local date, and the dashboard's default range covers the last two weeks.
