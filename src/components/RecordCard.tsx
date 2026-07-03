import type { Article } from '../lib/types'
import { formatDate, primaryAction, severityFor } from '../lib/format'
import StampBadge from './StampBadge'

interface Props {
  article: Article
  selected?: boolean
  onSelect: (article: Article) => void
}

// A row in the list. Previously this was an <a> that jumped straight to the
// source — one click, but you lost the app and the context. Now it's a
// button that opens the in-app detail panel; the source link lives inside
// that panel. Same number of clicks to actually read the article, but you
// see the full record along the way, and severity is visible up-front.
export default function RecordCard({ article, selected, onSelect }: Props) {
  const main = primaryAction(article.action_taken)
  const severity = severityFor(article)
  return (
    <button
      onClick={() => onSelect(article)}
      className={`group w-full text-left border-b border-paper/10 px-5 py-4 transition-colors ${
        selected ? 'bg-paper/10' : 'hover:bg-paper/5'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Severity spine — thin colored bar so the whole list reads as a heatmap when scanned */}
        <span
          className="mt-1 w-1 h-10 rounded-sm shrink-0"
          style={{ background: severity.color }}
          aria-label={`${severity.label} severity`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[0.7rem] font-mono text-marigold/80 mb-1.5">
            <span>{article.district}, {article.state === 'Telangana' ? 'TG' : 'AP'}</span>
            <span className="text-paper/30">·</span>
            <span>{formatDate(article.published)}</span>
            <span className="text-paper/30">·</span>
            <span style={{ color: severity.color }}>{severity.label}</span>
          </div>
          <h3 className="font-display text-[0.98rem] leading-snug text-paper group-hover:text-marigold transition-colors">
            {article.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {main && <StampBadge action={main} />}
            {article.fine_amount && (
              <span className="text-[0.68rem] font-mono text-paper/50">{article.fine_amount}</span>
            )}
            <span className="text-[0.68rem] text-paper/40">{article.source}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
