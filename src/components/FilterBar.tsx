import { ACTION_LABELS } from '../lib/format'

interface Props {
  query: string
  setQuery: (v: string) => void
  state: string
  setState: (v: string) => void
  action: string
  setAction: (v: string) => void
  showNoise: boolean
  setShowNoise: (v: boolean) => void
  view: 'map' | 'list' | 'stats'
  setView: (v: 'map' | 'list' | 'stats') => void
  resultCount: number
  actionOptions: string[]
}

export default function FilterBar({
  query, setQuery, state, setState, action, setAction,
  showNoise, setShowNoise, view, setView, resultCount, actionOptions,
}: Props) {
  return (
    <div className="border-b border-paper/10 bg-ink/95 backdrop-blur px-4 sm:px-5 py-2.5 sm:py-3 flex flex-col gap-2 sm:gap-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col leading-none whitespace-nowrap">
          <div className="font-display text-lg sm:text-xl tracking-tight text-paper">
            Ledger<span className="text-marigold">.</span>
          </div>
          <div className="hidden sm:block font-mono text-[0.55rem] text-paper/30 mt-0.5">by Rvind</div>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search district, restaurant, source…"
          className="flex-1 min-w-0 bg-paper/5 border border-paper/15 rounded-md px-3 py-2 text-sm text-paper placeholder:text-paper/40 focus:outline-none focus:border-marigold focus:ring-1 focus:ring-marigold"
        />
        <div className="hidden sm:flex items-center rounded-md border border-paper/15 overflow-hidden text-xs font-mono uppercase">
          <button
            onClick={() => setView('map')}
            className={`px-3 py-2 transition-colors ${view === 'map' ? 'bg-marigold text-ink' : 'text-paper/60 hover:text-paper'}`}
          >
            Map
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-2 transition-colors ${view === 'list' ? 'bg-marigold text-ink' : 'text-paper/60 hover:text-paper'}`}
          >
            List
          </button>
          <button
            onClick={() => setView('stats')}
            className={`px-3 py-2 transition-colors ${view === 'stats' ? 'bg-marigold text-ink' : 'text-paper/60 hover:text-paper'}`}
          >
            Stats
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs overflow-x-auto scrollbar-thin whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="shrink-0 bg-paper/5 border border-paper/15 rounded px-2 py-1.5 text-paper focus:outline-none focus:border-marigold"
        >
          <option value="">All states</option>
          <option value="Telangana">Telangana</option>
          <option value="Andhra Pradesh">Andhra Pradesh</option>
        </select>

        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="shrink-0 bg-paper/5 border border-paper/15 rounded px-2 py-1.5 text-paper focus:outline-none focus:border-marigold"
        >
          <option value="">All actions</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>

        <label className="shrink-0 flex items-center gap-1.5 text-paper/60 cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={showNoise}
            onChange={(e) => setShowNoise(e.target.checked)}
            className="accent-marigold"
          />
          <span className="hidden sm:inline">Include low-confidence matches</span>
          <span className="sm:hidden">Low-confidence</span>
        </label>

        <span className="shrink-0 sm:ml-auto font-mono text-paper/40">{resultCount.toLocaleString()} records</span>
      </div>
    </div>
  )
}
