import { ACTION_LABELS, ACTION_COLORS } from '../lib/format'

export default function StampBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? '#4F6D5C'
  return (
    <span className="stamp" style={{ color }}>
      {ACTION_LABELS[action] ?? action}
    </span>
  )
}
