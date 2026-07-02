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
  view: 'map' | 'list'
  setView: (v: 'map' | 'list') => void
  resultCount: number
  actionOptions: string[]
}

export default function FilterBar({
  query, setQuery, state, setState, action, setAction,
  showNoise, setShowNoise, view, setView, resultCount, actionOptions,
}: Props) {
  return (
    <div className="border-b border-paper/10 bg-ink/95 backdrop-blur px-4 sm:px-5 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="font-display text-lg sm:text-xl tracking-tight text-paper whitespace-nowrap">
          Ledger<span className="text-marigold">.</span>
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="bg-paper/5 border border-paper/15 rounded px-2 py-1.5 text-paper focus:outline-none focus:border-marigold"
        >
          <option value="">All states</option>
          <option value="Telangana">Telangana</option>
          <option value="Andhra Pradesh">Andhra Pradesh</option>
        </select>

        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="bg-paper/5 border border-paper/15 rounded px-2 py-1.5 text-paper focus:outline-none focus:border-marigold"
        >
          <option value="">All actions</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-paper/60 cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={showNoise}
            onChange={(e) => setShowNoise(e.target.checked)}
            className="accent-marigold"
          />
          Include low-confidence matches
        </label>

        <span className="ml-auto font-mono text-paper/40">{resultCount.toLocaleString()} records</span>
      </div>
    </div>
  )
}
