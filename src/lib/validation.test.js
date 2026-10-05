import { describe, expect, it } from 'vitest'
import { CHECKLIST_ITEMS, computeStatus } from './checklist.js'
import { formatDate } from './dates.js'
import { MAX_PHOTO_BYTES, validatePhotos, validateSafetyForm } from './validation.js'

const TODAY = '2026-10-04'

// Helpers to build test data.
const photo = (overrides = {}) => ({ name: 'site.jpg', type: 'image/jpeg', size: 200_000, ...overrides })
const allAnswers = (value) => Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.key, value]))
const validForm = (overrides = {}) => ({
  siteId: 'site-1',
  workDate: TODAY,
  answers: allAnswers(true),
  notes: '',
  photos: [photo()],
  ...overrides,
})

describe('validateSafetyForm', () => {
  it('accepts a complete form', () => {
    expect(validateSafetyForm(validForm(), TODAY)).toEqual({})
  })

  it('requires a site and a date', () => {
    const errors = validateSafetyForm(validForm({ siteId: '', workDate: '' }), TODAY)
    expect(errors.siteId).toBeDefined()
    expect(errors.workDate).toBeDefined()
  })

  it('rejects a date in the future', () => {
    const errors = validateSafetyForm(validForm({ workDate: '2026-10-05' }), TODAY)
    expect(errors.workDate).toMatch(/future/)
  })

  it('requires every checklist item to be answered', () => {
    const answers = allAnswers(true)
    delete answers.ppe_hard_hat
    delete answers.hazards_identified
    const errors = validateSafetyForm(validForm({ answers }), TODAY)
    expect(errors.checklist).toMatch(/2 left/)
  })

  it('requires notes when any item is "No"', () => {
    const answers = { ...allAnswers(true), fall_protection_in_place: false }
    expect(validateSafetyForm(validForm({ answers, notes: '   ' }), TODAY).notes).toBeDefined()
    expect(validateSafetyForm(validForm({ answers, notes: 'Guardrail fixed' }), TODAY)).toEqual({})
  })
})

describe('validatePhotos', () => {
  it('requires at least one photo', () => {
    expect(validatePhotos([])).toMatch(/at least one/)
  })

  it('allows at most five photos', () => {
    expect(validatePhotos(Array.from({ length: 6 }, () => photo()))).toMatch(/up to 5/)
  })

  it('rejects files that are not JPG, PNG or WebP', () => {
    expect(validatePhotos([photo({ name: 'notes.pdf', type: 'application/pdf' })])).toMatch(/notes\.pdf/)
    expect(validatePhotos([photo({ name: 'phone.heic', type: 'image/heic' })])).toMatch(/phone\.heic/)
  })

  it('rejects files over the size limit', () => {
    expect(validatePhotos([photo({ size: MAX_PHOTO_BYTES + 1 })])).toMatch(/larger than/)
    expect(validatePhotos([photo({ size: MAX_PHOTO_BYTES })])).toBeNull()
  })
})

describe('computeStatus', () => {
  it('is complete only when every item is yes', () => {
    expect(computeStatus(allAnswers(true))).toBe('complete')
    expect(computeStatus({ ...allAnswers(true), ppe_eye_protection: false })).toBe('flagged')
  })
})

describe('formatDate', () => {
  it('formats a date without shifting it by the time zone', () => {
    expect(formatDate('2026-10-04')).toContain('Oct 4')
  })
})
