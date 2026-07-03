import type { Article, Confidence } from './types'

export const ACTION_LABELS: Record<string, string> = {
  sealed: 'Sealed',
  license_cancelled: 'License cancelled',
  fined: 'Fined',
  raided: 'Raided',
  food_seized: 'Food seized',
  closed: 'Closed down',
  notice_issued: 'Notice issued',
  samples_collected: 'Samples collected',
  poisoning_incident: 'Poisoning incident',
}

export const ACTION_COLORS: Record<string, string> = {
  sealed: '#A8382C',
  license_cancelled: '#A8382C',
  fined: '#C9862A',
  raided: '#E8A33D',
  food_seized: '#A8382C',
  closed: '#A8382C',
  notice_issued: '#4F6D5C',
  samples_collected: '#4F6D5C',
  poisoning_incident: '#7A2E22',
}

export function primaryAction(actions: string[]): string | null {
  const priority = [
    'poisoning_incident', 'sealed', 'license_cancelled', 'closed',
    'food_seized', 'fined', 'raided', 'notice_issued', 'samples_collected',
  ]
  for (const p of priority) if (actions.includes(p)) return p
  return actions[0] ?? null
}

export function formatDate(iso: string): string {
  if (!iso) return 'Undated'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'Confirmed enforcement action',
  medium: 'Likely enforcement action',
  low: 'Possibly related',
  noise: 'Unrelated match',
}

// ─── Severity model ──────────────────────────────────────────────────────
// Reader-facing "how bad is this place" score. A composite of the enforcement
// action taken and any violations that appeared in the headline. Higher =
// avoid; lower = routine / procedural. Used to color-grade map pins and
// render an at-a-glance risk badge on each record (dealKid's suggestion:
// visual gradient rather than yet another color-coded action list).

// Per-action severity weight, roughly: procedural (samples/notice) → mild
// (raided/fined) → shut down (sealed/closed/license_cancelled) → harm
// (poisoning_incident). Weights are ordinal, not physical.
const ACTION_SEVERITY: Record<string, number> = {
  poisoning_incident: 5,
  sealed: 4,
  license_cancelled: 4,
  closed: 4,
  food_seized: 3,
  fined: 3,
  raided: 2,
  notice_issued: 1,
  samples_collected: 1,
}

// Violation keywords bump severity when present in the headline's parsed
// violations[]. Matched case-insensitively as substrings so we tolerate the
// keyword-matching upstream pipeline being a bit fuzzy.
const VIOLATION_WEIGHTS: Array<[RegExp, number]> = [
  [/expired|stale|rotten|spoiled|adulterat/i, 2],
  [/pest|rat|rodent|insect|cockroach/i, 2],
  [/unhygien|filth|dirty|contamina/i, 2],
  [/without.*license|unlicensed|no.*license/i, 1],
  [/mislabel|misbrand|fake/i, 1],
]

export type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'procedural'

export interface SeverityInfo {
  level: Severity
  score: number       // 0–10, clamped
  color: string       // gradient stop for pins & badges
  label: string       // short human label
}

// Gradient goes green (procedural) → yellow → orange → red → dark red.
// Matches the paper/marigold/stamp-red palette so the map still looks like
// the rest of the site.
const SEVERITY_STOPS: Record<Severity, { color: string; label: string }> = {
  procedural: { color: '#4F6D5C', label: 'Procedural' },
  low:        { color: '#8FA34A', label: 'Low risk' },
  moderate:   { color: '#E8A33D', label: 'Moderate' },
  high:       { color: '#C9532A', label: 'High risk' },
  critical:   { color: '#7A2E22', label: 'Critical' },
}

export function severityFor(article: Pick<Article, 'action_taken' | 'violations'>): SeverityInfo {
  // Take the max action weight rather than summing — one "sealed" doesn't
  // stack with a "raided" on the same event (they describe the same visit).
  const actionMax = article.action_taken.reduce(
    (m, a) => Math.max(m, ACTION_SEVERITY[a] ?? 0),
    0
  )

  // Violations DO stack (multiple problems compound), but cap the bump so a
  // headline listing five buzzwords doesn't dwarf the action itself.
  const violationText = article.violations.join(' ')
  let violationBump = 0
  for (const [rx, w] of VIOLATION_WEIGHTS) {
    if (rx.test(violationText)) violationBump += w
  }
  violationBump = Math.min(violationBump, 3)

  const raw = actionMax + violationBump
  const score = Math.max(0, Math.min(10, raw))

  const level: Severity =
    raw >= 6 ? 'critical' :
    raw >= 4 ? 'high' :
    raw >= 3 ? 'moderate' :
    raw >= 2 ? 'low' :
    'procedural'

  return { level, score, ...SEVERITY_STOPS[level] }
}
