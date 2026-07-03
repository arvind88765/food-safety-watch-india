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

The dataset is rebuilt automatically every Monday morning by a GitHub Action ([`.github/workflows/refresh-data.yml`](.github/workflows/refresh-data.yml)). No manual intervention needed — new records appear on the live site within an hour of the scheduled run.

**Sources merged:**
- [`scrape_gdelt.py`](scrape_gdelt.py) — pulls the last 5 years of TG + AP food-safety news mentions from [GDELT](https://www.gdeltproject.org/)'s DOC 2.0 API. Free, no auth, structured. Honours their ~5s rate limit.
- [`scrape_rss.py`](scrape_rss.py) — tops up the last ~30 days from Google News RSS in case GDELT lagged.
- [`clean.py`](clean.py) — merges both raw feeds (plus any legacy seed file), dedupes on (title, link), extracts district / actions / violations / authority / fine / confidence via regex, and writes `public/data.json`.

**Running it locally:**

```bash
pip install -r requirements.txt
python scrape_gdelt.py   # ~25 minutes; writes gdelt_raw.json
python scrape_rss.py     # ~2 minutes;  writes rss_raw.json
python clean.py          # writes public/data.json
```

**Force an early refresh:** Go to the [Actions tab](https://github.com/arvind88765/food-safety-watch-india/actions), pick "Refresh data", click "Run workflow". Anyone with repo write access can do this.
