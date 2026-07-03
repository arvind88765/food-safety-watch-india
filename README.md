# Food Safety Watch - Telangana & Andhra Pradesh

A searchable map and list tracking food safety enforcement across Telangana and Andhra Pradesh. Built from 2,162 news headlines scraped from Google News RSS, covering raids, seizures, fines, and poisoning incidents district by district.

🔗 **Live site:** [food-safety-watch-india.vercel.app](https://food-safety-watch-india.vercel.app)

---

## What it shows

Every record comes from a news headline, so the data is best-effort — not official government records. Here's what each field means:

- **district / state / lat / lon** — where the incident was reported, geocoded to the district's rough center. Pins are jittered slightly so they don't overlap. Street-level accuracy isn't possible from headlines alone.
- **action_taken** — what enforcement happened: raided, sealed, fined, food seized, license cancelled, notice issued, samples collected, or a poisoning incident. One headline can have multiple.
- **violations** — themes found in the headline: expired ingredients, unhygienic conditions, pest infestation, operating without a license, etc.
- **confidence** — how relevant the article actually is. Out of 2,547 scraped items, a chunk were off-topic — water infrastructure news, election coverage, raids in other states. Those are tagged `noise` and hidden by default, but you can toggle them on.
- **fine_amount / authority** — pulled out where a rupee figure or a known body (FSSAI, H-FAST, GHMC) appeared in the headline.

Every record links to the original article if you want the full story.

---

## What it doesn't show

Per-restaurant detail — actual name, exact address, specific violations found on inspection — would require fetching and parsing 2,000+ individual articles. That's a separate project. This is the headline layer.

---

## Stack

TypeScript · React · Vite · Python (data cleaning)
