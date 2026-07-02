import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import type { Article } from './lib/types'
import FilterBar from './components/FilterBar'
import MapView from './components/MapView'
import RecordCard from './components/RecordCard'
import StatsView from './components/StatsView'
import LandingPage from './components/LandingPage'

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
      />

      <div className="sm:hidden flex border-b border-paper/10 text-xs font-mono uppercase">
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

      {view === 'stats' ? (
        <div className="flex-1 min-h-0">
          <StatsView articles={filtered} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          <div className={`${view === 'map' ? 'block' : 'hidden'} sm:block flex-1 min-w-0`}>
            <MapView articles={filtered} />
          </div>
          <div
            className={`${view === 'list' ? 'flex' : 'hidden'} sm:flex flex-col w-full sm:w-[420px] lg:w-[480px] border-l border-paper/10 overflow-y-auto scrollbar-thin`}
          >
            {filtered.length === 0 ? (
              <div className="px-5 py-10 text-center text-paper/40 text-sm">
                No records match. Try widening your filters.
              </div>
            ) : (
              filtered.map((a) => <RecordCard key={a.id} article={a} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
