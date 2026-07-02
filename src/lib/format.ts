import type { Confidence } from './types'

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
