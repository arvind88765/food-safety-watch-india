import type { Article } from '../lib/types'
import { formatDate, primaryAction } from '../lib/format'
import StampBadge from './StampBadge'

export default function RecordCard({ article }: { article: Article }) {
  const main = primaryAction(article.action_taken)
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block border-b border-paper/10 px-5 py-4 hover:bg-paper/5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[0.7rem] font-mono text-marigold/80 mb-1.5">
            <span>{article.district}, {article.state === 'Telangana' ? 'TG' : 'AP'}</span>
            <span className="text-paper/30">·</span>
            <span>{formatDate(article.published)}</span>
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
    </a>
  )
}
