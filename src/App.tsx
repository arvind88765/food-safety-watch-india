import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import type { Article } from './lib/types'
import FilterBar from './components/FilterBar'
import MapView from './components/MapView'
import RecordCard from './components/RecordCard'
import StatsView from './components/StatsView'
import LandingPage from './components/LandingPage'
import DetailPanel from './components/DetailPanel'

export default function App() {
  const [entered, setEntered] = useState(
    typeof window !== 'undefined' && sessionStorage.getItem('ledger-entered') === '1'
  )
  const [data, setData] = useState<Article[] | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [action, setAction] = useState('')
  const [showNoise, setShowNoise] = useState(false)
  const [view, setView] = useState<'map' | 'list' | 'stats'>(
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'map'
  )
  // Currently-open record. null = list is showing. When set, DetailPanel
  // replaces the list column on both mobile and desktop. Keeps everything
  // one-click away without a full route change.
  const [selected, setSelected] = useState<Article | null>(null)

  useEffect(() => {
    fetch('/data.json')
      .then((r) => r.json())
      .then((d: Article[]) => setData(d))
      .catch(() => setError(true))
  }, [])

  const fuse = useMemo(() => {
    if (!data) return null
    return new Fuse(data, { keys: ['title', 'district', 'source'], threshold: 0.32 })
  }, [data])

  const allActions = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.flatMap((d) => d.action_taken))).sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    let base: Article[] = query.trim() && fuse
      ? fuse.search(query.trim()).map((r) => r.item)
      : data

    if (!showNoise) base = base.filter((a) => a.confidence !== 'noise')
    if (state) base = base.filter((a) => a.state === state)
    if (action) base = base.filter((a) => a.action_taken.includes(action))

    return [...base].sort((a, b) => (b.published || '').localeCompare(a.published || ''))
  }, [data, query, state, action, showNoise, fuse])

  // If filters change and the selected record is no longer visible, drop
  // it — otherwise the detail panel outlives its listing context.
  useEffect(() => {
    if (selected && !filtered.some((a) => a.id === selected.id)) {
      setSelected(null)
    }
  }, [filtered, selected])

  if (!entered) {
    return (
      <LandingPage
        onEnter={() => {
          sessionStorage.setItem('ledger-entered', '1')
          setEntered(true)
        }}
      />
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-paper/60 text-sm px-6 text-center">
        Couldn't load the dataset. Check that <code className="font-mono">public/data.json</code> exists and reload.
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center text-paper/50 text-sm font-mono">
        Loading records…
      </div>
    )
  }

  // Clicking a record on the map switches to list view on mobile so the
  // detail panel is actually visible (map full-screens the map on phones).
  const handleSelect = (a: Article) => {
    setSelected(a)
    if (typeof window !== 'undefined' && window.innerWidth < 640 && view === 'map') {
      setView('list')
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <FilterBar
        query={query} setQuery={setQuery}
        state={state} setState={setState}
        action={action} setAction={setAction}
        showNoise={showNoise} setShowNoise={setShowNoise}
        view={view} setView={setView}
        resultCount={filtered.length}
        actionOptions={allActions}
        onGoHome={() => {
          sessionStorage.removeItem('ledger-entered')
          setEntered(false)
        }}
      />

      <div className="sm:hidden">
        <div className="px-4 pt-2.5 pb-1.5 font-mono text-sm uppercase tracking-wide text-paper/50 bg-ink text-center">
          Views
        </div>
        <div className="flex border-b border-paper/10 text-xs font-mono uppercase">
          <button
            onClick={() => setView('map')}
            className={`flex-1 py-2 ${view === 'map' ? 'bg-marigold text-ink' : 'text-paper/60'}`}
          >
            Map
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex-1 py-2 ${view === 'list' ? 'bg-marigold text-ink' : 'text-paper/60'}`}
          >
            List ({filtered.length})
          </button>
          <button
            onClick={() => setView('stats')}
            className={`flex-1 py-2 ${view === 'stats' ? 'bg-marigold text-ink' : 'text-paper/60'}`}
          >
            Stats
          </button>
        </div>
      </div>

      {view === 'stats' ? (
        <div className="flex-1 min-h-0">
          <StatsView articles={filtered} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          <div className={`${view === 'map' ? 'block' : 'hidden'} sm:block flex-1 min-w-0`}>
            <MapView
              articles={filtered}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
            />
          </div>
          <div
            className={`${view === 'list' ? 'flex' : 'hidden'} sm:flex flex-col w-full sm:w-[420px] lg:w-[480px] border-l border-paper/10 overflow-hidden`}
          >
            {selected ? (
              <DetailPanel article={selected} onClose={() => setSelected(null)} />
            ) : filtered.length === 0 ? (
              <div className="px-5 py-10 text-center text-paper/40 text-sm">
                No records match. Try widening your filters.
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                {filtered.map((a) => (
                  <RecordCard
                    key={a.id}
                    article={a}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
