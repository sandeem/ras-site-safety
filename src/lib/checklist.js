// The safety checklist, defined once and used by the form, the detail page and the tests.
// Each `key` matches a boolean column in the `submissions` table.

export const CHECKLIST_ITEMS = [
  { key: 'ppe_hard_hat', label: 'Hard hat worn', group: 'PPE' },
  { key: 'ppe_hi_vis_vest', label: 'Hi-vis vest worn', group: 'PPE' },
  { key: 'ppe_safety_boots', label: 'Safety boots worn', group: 'PPE' },
  { key: 'ppe_eye_protection', label: 'Eye protection worn', group: 'PPE' },
  { key: 'fall_protection_in_place', label: 'Fall protection in place', group: 'Site' },
  { key: 'ladders_scaffolding_inspected', label: 'Ladders and scaffolding inspected', group: 'Site' },
  { key: 'tools_cords_good_condition', label: 'Tools and cords in good condition', group: 'Site' },
  { key: 'hazards_identified', label: 'Site hazards identified and shared with the crew', group: 'Site' },
]

export const CHECKLIST_GROUPS = ['PPE', 'Site']

// Same rule as the `status` column in the database: every item "yes" means complete.
// The form uses this only to warn the framer early; the database value is the real one.
export function computeStatus(answers) {
  return CHECKLIST_ITEMS.every((item) => answers[item.key] === true) ? 'complete' : 'flagged'
}
