interface Props {
  onEnter: () => void
}

const QA: { q: string; a: string }[] = [
  {
    q: 'ok but what even is this',
    a: "a map + searchable list of every food safety raid, seal, fine, license cancel, poisoning case etc happening across telangana and andhra pradesh. basically every sketchy kitchen story that made the news, all in one place.",
  },
  {
    q: 'why tho',
    a: "ngl cuz everything out there is fuked up. expired ingredients, roaches in the kitchen, fake licenses, no license at all lol. this stuff shows up in some local news article for one day then just disappears forever. figured someone should keep the receipts.",
  },
  {
    q: 'where do you even get this data',
    a: 'public news headlines, scraped daily and auto sorted into raided / sealed / fined / food seized etc. every single record links back to the original article so you can go check it yourself.',
  },
  {
    q: 'is it accurate tho',
    a: "district level accurate, not exact address accurate. pins sit near the middle of the district, not on the actual restaurant. also every record gets a confidence score cuz some headlines match by accident and are unrelated noise.",
  },
  {
    q: 'is this like official govt stuff',
    a: 'nah lol. this is just an independent tracker built off public news, not a govt database. if you need actual official action taken on a place, contact the real food safety authority.',
  },
  {
    q: 'does this update or is it a one time thing',
    a: "updates daily, new raids and actions get added every single day so you're always seeing the latest. right now the site is running on about 4 years of data and counting.",
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
          food safety watch, telangana &amp; andhra pradesh
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
          className="group mt-12 sm:mt-14 relative bg-marigold text-ink font-mono text-sm uppercase tracking-wide px-9 py-4 rounded-full hover:bg-marigold-dim hover:scale-105 active:scale-95 transition-all shadow-[0_0_25px_rgba(232,163,61,0.35)]"
        >
          say less, let's go <span className="inline-block group-hover:translate-x-1 transition-transform">🔥</span>
        </button>

        <p className="mt-8 mb-4 font-mono text-[0.65rem] text-paper/35 text-center">
          made by Rvind
        </p>
      </div>
    </div>
  )
}
