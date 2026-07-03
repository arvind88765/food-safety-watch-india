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

---

## Data pipeline

The dataset is rebuilt automatically **every day** by a GitHub Action ([`.github/workflows/refresh-data.yml`](.github/workflows/refresh-data.yml)). No manual intervention needed — new records appear on the live site within an hour of the scheduled 04:15 UTC (09:45 IST) run.

**Daily incremental**: each run only sweeps the last 2 days of news, merges with the historical `public/data.json`, and dedupes on article URL. Old stories are never lost; new stories are appended; the same story never appears twice. A quiet day produces no commit.

**Sources merged:**
- [`scrape_gdelt.py`](scrape_gdelt.py) — TG + AP food-safety news mentions from [GDELT](https://www.gdeltproject.org/)'s DOC 2.0 API. Free, no auth, structured. Honours their ~5s rate limit. Window size is env-controlled (`LOOKBACK_DAYS=2` for daily, `BACKFILL_YEARS=5` for the one-time seed).
- [`scrape_rss.py`](scrape_rss.py) — recent Google News RSS as a freshness top-up in case GDELT lagged.
- [`clean.py`](clean.py) — merges the raw feeds **with the existing `public/data.json`**, dedupes on `link`, attributes district / actions / violations / authority / fine / confidence via regex, sorts by date, and writes back.

**Seeding history (one-time, after merging this PR):**
Go to the [Actions tab](https://github.com/arvind88765/food-safety-watch-india/actions), pick **"Refresh data"**, click **"Run workflow"**, and enter `5` in the *backfill_years* field. Kicks off a ~25-minute historical sweep, then daily incremental takes over forever.

**Running it locally:**

```bash
pip install -r requirements.txt
python scrape_gdelt.py   # 2 days by default; LOOKBACK_DAYS=N or BACKFILL_YEARS=N to override
python scrape_rss.py
python clean.py          # merges with existing public/data.json
```

**Force an early refresh:** Actions → Refresh data → Run workflow (leave *backfill_years* blank).
