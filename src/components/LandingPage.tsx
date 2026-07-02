interface Props {
  onEnter: () => void
}

const QA: { q: string; a: string }[] = [
  {
    q: 'What is this?',
    a: 'A searchable map and record of food-safety enforcement news across Telangana and Andhra Pradesh — raids, seals, fines, license cancellations, and more, pulled from public news reporting.',
  },
  {
    q: 'Why does it exist?',
    a: 'This kind of enforcement news is scattered across hundreds of local news outlets and disappears from search within days. Putting it in one searchable place makes it possible to spot patterns — which areas, which violations, which outlets keep recurring.',
  },
  {
    q: 'Where does the data come from?',
    a: 'Public news headlines, scraped and classified by keyword (raided, sealed, fined, food seized, etc). Every record links back to its original source article.',
  },
  {
    q: 'How accurate is it?',
    a: "Location is district-level, not street-level — pins are placed at the district's approximate centroid, not the actual restaurant address. Each record is scored high / medium / low / noise confidence, since some headlines matched by coincidence.",
  },
  {
    q: 'Is this official?',
    a: 'No. This is an independent, unofficial record built from public news, not a government database. For enforcement action or restaurant status, contact the relevant food safety authority directly.',
  },
]

export default function LandingPage({ onEnter }: Props) {
  return (
    <div className="h-screen overflow-y-auto scrollbar-thin bg-ink text-paper flex flex-col items-center px-5 sm:px-6">
      <div className="w-full max-w-xl flex flex-col items-center pt-14 sm:pt-20 pb-10">
        <div className="font-display text-4xl sm:text-5xl tracking-tight mb-2">
          Ledger<span className="text-marigold">.</span>
        </div>
        <p className="font-mono text-[0.7rem] uppercase tracking-wide text-paper/50 text-center mb-10 sm:mb-12">
          Food Safety Watch — Telangana &amp; Andhra Pradesh
        </p>

        <div className="w-full flex flex-col gap-6 sm:gap-7">
          {QA.map(({ q, a }) => (
            <div key={q}>
              <h2 className="font-display text-lg sm:text-xl mb-1.5 text-marigold">{q}</h2>
              <p className="text-sm sm:text-[0.95rem] leading-relaxed text-paper/75">{a}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onEnter}
          className="mt-12 sm:mt-14 bg-marigold text-ink font-mono text-sm uppercase tracking-wide px-8 py-3.5 rounded-md hover:bg-marigold-dim transition-colors"
        >
          Enter the site →
        </button>

        <p className="mt-8 mb-4 font-mono text-[0.65rem] text-paper/35 text-center">
          Made by Arvind
        </p>
      </div>
    </div>
  )
}
