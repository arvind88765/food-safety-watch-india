"""
scrape_gdelt.py — pull historical food-safety news mentions for Telangana +
Andhra Pradesh from GDELT's DOC 2.0 API.

Why GDELT: it's the only free source with a 5-year archive of news mentions
that ships as structured JSON, no auth, permissive rate limit. Google News
RSS only exposes the last ~30 days; GDELT indexes everything back to 2015.

Rate limit: docs ask for one request every 5 seconds. We honour that with a
hard sleep and a jitter so we don't hammer the endpoint if it slows down.

The API caps each response at 250 articles and each query at a single
timespan, so we sweep the 5-year window in month-sized slices per query.
Slices bigger than a month risk exceeding 250 and silently truncating.

Output shape (gdelt_raw.json) is deliberately close to the legacy
news_food_safety_articles__1_.json so clean.py can consume both:

    [
      {
        "title": ...,
        "link":  ...,
        "published": ISO 8601 timestamp,
        "source":    domain,
        "summary":   "" (GDELT doesn't return snippet text),
        "matched_query": <the query string that surfaced this article>,
      },
      ...
    ]

The `matched_query` field is what districts.py-style logic keys off to guess
the district. GDELT queries here are keyword-only (no location field), so we
run a separate query per district to preserve that provenance.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Iterator

# ---- Config -----------------------------------------------------------------

# 5-year window. Anchored to "now" at run-time in main() so the GH Action
# picks up the trailing edge automatically each week.
YEARS_BACK = 5

# One request per 5 seconds per GDELT's fair-use ask. Actual sleep is a bit
# more so retries after transient errors don't push us over.
RATE_LIMIT_SECONDS = 5.5

# Per-query per-slice cap. GDELT hard-caps at 250; we ask for exactly that.
MAX_RECORDS = 250

# Month-sized slices. Wider slices risk hitting the 250 cap and silently
# dropping the tail; narrower slices multiply the request count for no gain.
SLICE_DAYS = 30

# User-Agent — GDELT doesn't require one but anonymous requests get lower
# priority in their queue. Identifying the project is polite.
USER_AGENT = "food-safety-watch-india/1.0 (+https://github.com/arvind88765/food-safety-watch-india)"

# Districts we care about. Kept in sync with districts.py — the district
# name doubles as the matched_query prefix so clean.py can attribute
# location downstream.
from districts import DISTRICTS

# The query is: <district> AND (food safety terms). Repeated for each
# district. GDELT full-text-searches the article body + title, so a raid
# in "Karimnagar" surfaces for the Karimnagar sweep even if the headline
# omits the district. Trade-off: same story can appear under multiple
# districts — dedup happens in clean.py by (title, link).
FOOD_TERMS = (
    '("food safety" OR "food adulteration" OR "food poisoning" '
    'OR "FSSAI" OR "H-FAST" OR "unhygienic" OR "food seized" '
    'OR "restaurant sealed" OR "restaurant raid" OR "eatery raid" '
    'OR "food inspector" OR "food commissioner")'
)


# ---- HTTP -------------------------------------------------------------------

def fetch(url: str, retries: int = 3) -> dict:
    """GET one JSON page from GDELT, honouring rate limit and retrying on
    transient failure. Raises RuntimeError if all retries fail."""
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8", errors="replace")
            # GDELT sometimes returns a rate-limit HTML page with 200 status,
            # so probe the body instead of trusting the status code alone.
            if body.lstrip().startswith("Please limit requests"):
                # exponential-ish backoff, but stay in whole seconds so
                # the log line is readable
                wait = RATE_LIMIT_SECONDS * (attempt + 2)
                print(f"  rate-limited, sleeping {wait:.0f}s", file=sys.stderr)
                time.sleep(wait)
                continue
            if not body.strip():
                return {"articles": []}
            return json.loads(body)
        except Exception as e:  # broad: network, JSON, timeout — all retried
            last_err = e
            time.sleep(RATE_LIMIT_SECONDS * (attempt + 1))
    raise RuntimeError(f"GDELT fetch failed after {retries} tries: {last_err}") from last_err


# ---- Query construction -----------------------------------------------------

def slice_windows(start: datetime, end: datetime) -> Iterator[tuple[datetime, datetime]]:
    """Yield (window_start, window_end) tuples covering [start, end) in
    SLICE_DAYS chunks. Ensures GDELT never has to return more than one
    slice-worth of articles per call, so we don't silently blow the 250
    per-response cap."""
    cur = start
    while cur < end:
        nxt = min(cur + timedelta(days=SLICE_DAYS), end)
        yield cur, nxt
        cur = nxt


def gdelt_url(query: str, start: datetime, end: datetime) -> str:
    params = {
        "query": query,
        "mode": "artlist",
        "format": "json",
        "maxrecords": str(MAX_RECORDS),
        # GDELT format: YYYYMMDDHHMMSS in UTC. Trailing Z isn't needed.
        "startdatetime": start.strftime("%Y%m%d%H%M%S"),
        "enddatetime": end.strftime("%Y%m%d%H%M%S"),
        # Sort by relevance so if we do hit the 250 cap the ones we
        # keep are the ones a reader would actually surface.
        "sort": "hybridrel",
    }
    return "https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode(params)


# ---- Main sweep -------------------------------------------------------------

def sweep_district(district: str, start: datetime, end: datetime) -> list[dict]:
    """Sweep the whole [start, end) window for one district's food-safety
    news. Returns raw article dicts with a `matched_query` field so
    downstream location attribution stays honest."""
    # Quote the district if it has spaces so GDELT treats it as a phrase.
    dist_query = f'"{district}"' if " " in district else district
    query = f'{dist_query} AND {FOOD_TERMS}'

    out: list[dict] = []
    for w_start, w_end in slice_windows(start, end):
        url = gdelt_url(query, w_start, w_end)
        try:
            data = fetch(url)
        except RuntimeError as e:
            print(f"  ✗ {district} {w_start:%Y-%m}: {e}", file=sys.stderr)
            time.sleep(RATE_LIMIT_SECONDS)
            continue

        articles = data.get("articles", []) or []
        for a in articles:
            # GDELT's seendate is "20240111T104500Z". Reshape into the ISO
            # 8601 that clean.py already knows how to parse.
            sd = a.get("seendate", "")
            iso = ""
            if len(sd) >= 15:
                try:
                    dt = datetime.strptime(sd, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
                    iso = dt.isoformat()
                except ValueError:
                    iso = ""
            out.append({
                "title": a.get("title", ""),
                "link": a.get("url", ""),
                "published": iso,
                "source": a.get("domain", ""),
                "summary": "",  # GDELT DOC 2.0 doesn't return snippet text
                "matched_query": district,  # what clean.py uses to attribute location
            })

        # Only log slices that returned anything, to keep the log skimmable
        if articles:
            print(f"  · {district} {w_start:%Y-%m}: {len(articles)}")

        time.sleep(RATE_LIMIT_SECONDS)

    return out


def main() -> int:
    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = end - timedelta(days=365 * YEARS_BACK)

    print(f"Sweeping GDELT for TG + AP food-safety news, "
          f"{start:%Y-%m-%d} → {end:%Y-%m-%d}", file=sys.stderr)
    print(f"Districts: {len(DISTRICTS)}, ~5.5s per request → "
          f"~{len(DISTRICTS) * (YEARS_BACK * 365 // SLICE_DAYS) * 5.5 / 60:.0f} min",
          file=sys.stderr)

    all_articles: list[dict] = []
    for district in DISTRICTS:
        print(f"[{district}]", file=sys.stderr)
        all_articles.extend(sweep_district(district, start, end))

    # Dedup on (title, link) — the same story can surface under multiple
    # district queries when the article mentions several places. Keeping
    # the FIRST match preserves the district that Google's relevance
    # scored highest for that story.
    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for a in all_articles:
        key = (a["title"].strip().lower(), a["link"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(a)

    print(f"\nTotal raw: {len(all_articles)}   after dedup: {len(deduped)}",
          file=sys.stderr)

    with open("gdelt_raw.json", "w", encoding="utf-8") as f:
        json.dump(deduped, f, ensure_ascii=False, indent=1)
    print("Wrote gdelt_raw.json", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
