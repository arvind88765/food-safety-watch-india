import { useMemo } from 'react'
import type { Article } from '../lib/types'
import { ACTION_LABELS, ACTION_COLORS } from '../lib/format'

function monthKey(iso: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export default function StatsView({ articles }: { articles: Article[] }) {
  const stats = useMemo(() => {
    const byState: Record<string, number> = {}
    const byDistrict: Record<string, number> = {}
    const byAction: Record<string, number> = {}
    const byMonth: Record<string, number> = {}
    let sealedOrClosed = 0
    let fined = 0
    let poisoning = 0

    for (const a of articles) {
      byState[a.state] = (byState[a.state] ?? 0) + 1
      byDistrict[a.district] = (byDistrict[a.district] ?? 0) + 1
      for (const act of a.action_taken) {
        byAction[act] = (byAction[act] ?? 0) + 1
      }
      if (a.action_taken.includes('sealed') || a.action_taken.includes('closed')) sealedOrClosed++
      if (a.action_taken.includes('fined')) fined++
      if (a.action_taken.includes('poisoning_incident')) poisoning++

      const mk = monthKey(a.published)
      if (mk) byMonth[mk] = (byMonth[mk] ?? 0) + 1
    }

    const topDistricts = Object.entries(byDistrict)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    const topActions = Object.entries(byAction).sort((a, b) => b[1] - a[1])

    const months = Object.keys(byMonth).sort().slice(-12)
    const trend = months.map((k) => ({ key: k, count: byMonth[k] }))

    return {
      total: articles.length,
      byState,
      sealedOrClosed,
      fined,
      poisoning,
      topDistricts,
      topActions,
      trend,
    }
  }, [articles])

  const maxDistrict = stats.topDistricts[0]?.[1] ?? 1
  const maxAction = stats.topActions[0]?.[1] ?? 1
  const maxTrend = Math.max(1, ...stats.trend.map((t) => t.count))

  if (articles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-paper/40 text-sm px-6 text-center">
        No records match. Try widening your filters.
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-4 sm:px-6 py-5 sm:py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total records" value={stats.total} />
          <StatCard label="Sealed / closed" value={stats.sealedOrClosed} color="var(--color-stamp-red)" />
          <StatCard label="Fined" value={stats.fined} color="var(--color-marigold)" />
          <StatCard label="Poisoning incidents" value={stats.poisoning} color="#7A2E22" />
        </div>

        {/* State split */}
        <section>
          <SectionTitle>By state</SectionTitle>
          <div className="flex flex-col gap-2">
            {Object.entries(stats.byState)
              .sort((a, b) => b[1] - a[1])
              .map(([state, count]) => (
                <BarRow
                  key={state}
                  label={state === 'Telangana' ? 'Telangana' : 'Andhra Pradesh'}
                  count={count}
                  max={stats.total}
                  color="var(--color-marigold)"
                />
              ))}
          </div>
        </section>

        {/* Top districts */}
        <section>
          <SectionTitle>Top districts</SectionTitle>
          <div className="flex flex-col gap-2">
            {stats.topDistricts.map(([district, count]) => (
              <BarRow key={district} label={district} count={count} max={maxDistrict} color="var(--color-sage)" />
            ))}
          </div>
        </section>

        {/* Action breakdown */}
        <section>
          <SectionTitle>By action taken</SectionTitle>
          <div className="flex flex-col gap-2">
            {stats.topActions.map(([action, count]) => (
              <BarRow
                key={action}
                label={ACTION_LABELS[action] ?? action}
                count={count}
                max={maxAction}
                color={ACTION_COLORS[action] ?? 'var(--color-sage)'}
              />
            ))}
          </div>
        </section>

        {/* Monthly trend */}
        {stats.trend.length > 1 && (
          <section>
            <SectionTitle>Monthly trend</SectionTitle>
            <div className="flex items-end gap-1.5 h-28 border-b border-paper/10 pb-1">
              {stats.trend.map((t) => (
                <div key={t.key} className="flex-1 flex flex-col items-center justify-end gap-1 group">
                  <span className="text-[0.6rem] font-mono text-paper/50 group-hover:text-marigold transition-colors">
                    {t.count}
                  </span>
                  <div
                    className="w-full rounded-t-sm bg-marigold/70 group-hover:bg-marigold transition-colors"
                    style={{ height: `${Math.max(4, (t.count / maxTrend) * 90)}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mt-1">
              {stats.trend.map((t) => (
                <span
                  key={t.key}
                  className="flex-1 text-center text-[0.6rem] font-mono text-paper/40 whitespace-nowrap"
                >
                  {monthLabel(t.key)}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-paper/5 border border-paper/10 rounded-lg px-4 py-3">
      <div className="font-display text-2xl sm:text-3xl leading-none" style={color ? { color } : undefined}>
        {value.toLocaleString()}
      </div>
      <div className="text-[0.7rem] font-mono uppercase tracking-wide text-paper/50 mt-1.5">{label}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[0.7rem] uppercase tracking-wide text-paper/50 mb-2.5">{children}</h2>
  )
}

function BarRow({
  label,
  count,
  max,
  color,
}: {
  label: string
  count: number
  max: number
  color: string
}) {
  const pct = Math.max(3, (count / max) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 sm:w-36 shrink-0 text-sm text-paper/80 truncate" title={label}>
        {label}
      </div>
      <div className="flex-1 h-5 bg-paper/5 rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="w-10 shrink-0 text-right text-sm font-mono text-paper/60">{count}</div>
    </div>
  )
}
