import type { Article } from '../lib/types'
import { CONFIDENCE_LABEL, formatDate, severityFor } from '../lib/format'
import StampBadge from './StampBadge'

// Full-record detail panel. Slides in over the list on mobile, replaces the
// list on desktop. Everything you'd previously have had to click-through to
// see (source, all actions, all violations, authority, fine, confidence,
// derived severity) is here in one shot — cutting the "too many clicks"
// complaint down to one click.

interface Props {
  article: Article
  onClose: () => void
}

export default function DetailPanel({ article, onClose }: Props) {
  const severity = severityFor(article)
  return (
    <div className="h-full w-full bg-ink flex flex-col overflow-hidden">
      {/* Header strip — severity-colored so the reader clocks risk before reading */}
      <div
        className="px-5 py-3 border-b border-paper/10 flex items-center justify-between gap-3"
        style={{ background: `linear-gradient(90deg, ${severity.color}20, transparent 60%)` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="inline-block w-3 h-3 rounded-full shrink-0"
            style={{ background: severity.color, boxShadow: `0 0 0 3px ${severity.color}25` }}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="font-mono text-[0.6rem] uppercase tracking-widest text-paper/50">
              {severity.label} · score {severity.score}/10
            </div>
            <div className="font-mono text-[0.7rem] text-paper/70 truncate">
              {article.district}, {article.state === 'Telangana' ? 'TG' : 'AP'} · {formatDate(article.published)}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-paper/60 hover:text-paper text-xl leading-none px-2 -mr-2"
          aria-label="Close detail"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
        <h2 className="font-display text-lg leading-tight text-paper mb-3">
          {article.title}
        </h2>

        {article.action_taken.length > 0 && (
          <section className="mb-5">
            <div className="font-mono text-[0.6rem] uppercase tracking-widest text-paper/40 mb-2">
              Enforcement
            </div>
            <div className="flex flex-wrap gap-2">
              {article.action_taken.map((a) => <StampBadge key={a} action={a} />)}
            </div>
          </section>
        )}

        {article.violations.length > 0 && (
          <section className="mb-5">
            <div className="font-mono text-[0.6rem] uppercase tracking-widest text-paper/40 mb-2">
              Violations flagged
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {article.violations.map((v) => (
                <li
                  key={v}
                  className="text-[0.72rem] font-mono px-2 py-0.5 rounded bg-paper/5 border border-paper/10 text-paper/70"
                >
                  {v}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-5 grid grid-cols-2 gap-4 text-[0.78rem]">
          {article.authority && (
            <div>
              <div className="font-mono text-[0.58rem] uppercase tracking-widest text-paper/40 mb-1">Authority</div>
              <div className="text-paper/85">{article.authority}</div>
            </div>
          )}
          {article.fine_amount && (
            <div>
              <div className="font-mono text-[0.58rem] uppercase tracking-widest text-paper/40 mb-1">Fine</div>
              <div className="text-paper/85 font-mono">{article.fine_amount}</div>
            </div>
          )}
          <div>
            <div className="font-mono text-[0.58rem] uppercase tracking-widest text-paper/40 mb-1">Source</div>
            <div className="text-paper/85">{article.source}</div>
          </div>
          <div>
            <div className="font-mono text-[0.58rem] uppercase tracking-widest text-paper/40 mb-1">Confidence</div>
            <div className="text-paper/85">
              {CONFIDENCE_LABEL[article.confidence]}
            </div>
          </div>
        </section>

        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 border border-marigold/70 text-marigold font-mono text-xs uppercase tracking-widest px-4 py-2 rounded hover:bg-marigold hover:text-ink transition-colors"
        >
          Read the source →
        </a>

        <p className="mt-6 text-[0.7rem] text-paper/35 leading-relaxed">
          Severity is derived from the reported enforcement action and any violation
          keywords in the headline — it's a rough indicator, not an official grade.
          Because entries come from news headlines, exact restaurant identity may be
          missing; the pin sits at the district's rough center.
        </p>
      </div>
    </div>
  )
}
