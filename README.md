# Ledger — Food Safety Watch (Telangana & Andhra Pradesh)

A searchable map + list of food-safety enforcement news scraped from Google News RSS
across Telangana and Andhra Pradesh districts.

## What's in the data

`public/data.json` holds 2,162 cleaned records. Each one was built from a news
headline only (no full article body — that would require scraping each publisher,
which isn't done here), so treat these fields as best-effort:

- `district` / `state` / `lat` / `lon` — extracted from the search query that found
  the article, then geocoded to the district's approximate centroid (jittered
  slightly so pins don't stack). This is district-level accuracy, not
  street-level — it does NOT know the actual restaurant's address.
- `action_taken` — keyword-classified from the headline (raided, sealed, fined,
  food seized, license cancelled, notice issued, samples collected, poisoning
  incident). A headline can have zero or multiple.
- `violations` — keyword-classified themes mentioned in the headline (expired
  ingredients, unhygienic conditions, pest infestation, no license, etc).
- `confidence` — `high` / `medium` / `low` / `noise`. Many of the original 2,547
  scraped items were off-topic (general news that matched a keyword query by
  coincidence — water plans, election news, unrelated raids in other states).
  Those are tagged `noise` and hidden by default; there's a toggle to show them.
- `fine_amount`, `authority` — regex-extracted where a rupee figure or a known
  authority name (H-FAST, FSSAI, GHMC) appeared in the headline.

To get real per-restaurant detail (name, specific violations found, exact
address) you'd need to fetch and parse each article's full body — a much bigger
job (2,000+ page fetches) that wasn't part of this pass. The "Read source" link
on every record takes you to the original article for that.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview   # to test the production build locally
```

## Deploy to Vercel

**Option A — Vercel CLI (fastest):**
```bash
npm install -g vercel
vercel login
vercel        # first deploy, follow prompts (framework: Vite, auto-detected)
vercel --prod # promote to production
```

**Option B — GitHub + Vercel dashboard:**
1. Push this folder to a new GitHub repo.
2. Go to vercel.com → New Project → import that repo.
3. Vercel auto-detects Vite. Leave build command as `npm run build`, output
   directory as `dist`. Deploy.

No environment variables or API keys are needed — everything is static.

## Updating the data later

Re-run the cleaning pipeline against a fresh scrape, then replace
`public/data.json` and redeploy:

```bash
python3 clean.py   # (from the data-processing scripts, see /foodwatch-data)
cp articles_clean.json path/to/foodwatch/public/data.json
```
