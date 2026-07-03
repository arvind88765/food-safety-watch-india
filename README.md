# Food Safety Watch, Telangana & Andhra Pradesh

A searchable map and list of food safety enforcement across Telangana and Andhra Pradesh. It reads news headlines about raids, seizures, fines, and food poisoning incidents, then plots them district by district. It started with 2,162 headlines from Google News RSS. It now grows by itself every day.

🔗 **Live site:** [food-safety-watch-india.vercel.app](https://food-safety-watch-india.vercel.app)

## What each record means

Everything on the map comes from a news headline, not from an official inspection report. Treat it as journalism, not government data.

Each pin carries these fields:

**district, state, lat, lon.** Where the story happened, placed at the rough center of that district. Pins are nudged a bit so they don't stack on top of each other. You cannot get street level accuracy from a headline, so we do not pretend to.

**action_taken.** What the authorities did. Raided, sealed, fined, seized food, cancelled a license, issued a notice, collected samples, or reported a poisoning incident. One story can carry more than one.

**violations.** What the headline complained about. Expired ingredients, unhygienic kitchen, pest infestation, operating without a license, and so on.

**confidence.** How sure we are the story is really about food safety. Some scraped items turned out to be about water plants, elections, or events in other states. Those are tagged `noise` and hidden by default. Flip the toggle in the filter bar if you want to see them.

**fine_amount, authority.** Pulled out when a rupee figure or a known body (FSSAI, H-FAST, GHMC) appears in the headline.

Every card links to the original article. Click through if you want the full story.

## Severity

Each record gets a severity grade, from Procedural at the low end up to Critical. It is computed from the enforcement action plus any red flag keywords in the headline (adulteration, pest, unhygienic, expired stock, and similar). The map pins are colored on that scale so you can read the whole map as a risk heatmap instead of a wall of identical dots. The scoring lives in [`src/lib/format.ts`](src/lib/format.ts) if you want to tune it.

Severity is a rough indicator, not a verdict. A red pin means the headline sounded serious, not that a court has ruled on anything.

## What it does not show

Per restaurant detail like the exact name, address, or the specific findings from an inspection. Getting that would mean fetching and parsing every article, and even then most headlines leave the restaurant unnamed. This project is the headline layer. Anything deeper is a separate build.

## Stack

TypeScript, React, and Vite for the front end. Python for the data pipeline. Leaflet with OpenStreetMap tiles for the map. Deployed on Vercel.

## How the data stays fresh

A GitHub Action runs every day at 04:15 UTC (09:45 IST). It pulls the last two days of TG and AP food safety news, merges the new stories with everything already in `public/data.json`, and pushes the file back if anything changed. Vercel picks up the commit and redeploys, so the live site is at most a day behind. Quiet days do not produce a commit.

The pipeline dedupes on the article URL. The same story cannot appear twice, no matter how many days it takes to fall out of the news cycle or how many separate keyword queries surfaced it.

Three scripts, one workflow:

**[`scrape_gdelt.py`](scrape_gdelt.py)** fetches news mentions from GDELT's DOC 2.0 API. It is free, needs no key, and covers years of history. The window is controlled by environment variables. `LOOKBACK_DAYS=2` is the daily default. `BACKFILL_YEARS=5` is the one time historical sweep.

**[`scrape_rss.py`](scrape_rss.py)** pulls recent Google News RSS. This exists as a safety net for the days GDELT indexes something a bit late.

**[`clean.py`](clean.py)** merges everything. It loads the existing `public/data.json`, adds today's raw scrapes, dedupes on the article link, runs the regex classifier over any new stories, sorts by date, and writes the file back.

**[`.github/workflows/refresh-data.yml`](.github/workflows/refresh-data.yml)** ties the three together and commits the result.

## Running the pipeline locally

If you want to rebuild the dataset on your own machine instead of waiting for the cron:

```bash
pip install -r requirements.txt
python scrape_gdelt.py    # 2 days by default; set LOOKBACK_DAYS or BACKFILL_YEARS to change the window
python scrape_rss.py
python clean.py           # merges with your existing public/data.json
```

## Forcing an early refresh

Go to the [Actions tab](https://github.com/arvind88765/food-safety-watch-india/actions), click **Refresh data**, click **Run workflow**, then click the green button. Leave the backfill field blank for a normal daily style run. Put `5` in the backfill field if you want a fresh five year seed.

## Credits

Built by [Rvind](https://github.com/arvind88765). Data is journalism grade, not government grade. If a specific pin looks wrong on your area, open an issue and I will look into it.
