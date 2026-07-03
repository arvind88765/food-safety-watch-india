"""
scrape_gdelt.py — pull the last couple of days of food-safety news mentions
for Telangana + Andhra Pradesh from GDELT's DOC 2.0 API.

This script only does short daily sweeps. There is no historical backfill
mode. GDELT's rate limiting made the 5-year backfill impossible to complete
in one GitHub Actions job, and chunking it across many jobs was fragile.
The site starts with whatever records are already in public/data.json and
grows organically as the daily cron runs.

Window size: 2 days by default. Overridable via LOOKBACK_DAYS env var if you
want to catch up after the site was down for a while.

Rate limit: GDELT allows one request per 5 seconds. In practice they return
HTTP 429 well before that, so we start at 6 seconds between requests and
back off exponentially on 429. If a district takes 3 straight 429s, we skip
it for this run and move on. A stuck district cannot block the whole job
anymore.

The API caps each response at 250 articles per query per timespan, so we
sweep each window in month-sized slices per district. That is a lot of
slack for a 2-day window; the loop below terminates in one slice per
district for the daily case.

Output shape (gdelt_raw.json) matches the legacy raw JSON so clean.py can
consume it:

    [
      {
        "title": ...,
        "link":  ...,
        "published": ISO 8601 timestamp,
        "source":    domain,
        "summary":   "" (GDELT doesn't return snippet text),
        "matched_query": <the district name that surfaced this article>,
      },
      ...
    ]

The output file is ephemeral. Each run overwrites it. Historical records
survive because clean.py merges gdelt_raw.json with the existing
public/data.json before writing back, dedup'd on link.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Iterator

# ---- Config -----------------------------------------------------------------

# How far back to sweep. Defaults to 2 days for the nightly cron. Set
# LOOKBACK_DAYS in the workflow file or your shell to override.
def lookback_delta() -> timedelta:
    days = os.environ.get("LOOKBACK_DAYS", "").strip()
    if days:
        try:
            return timedelta(days=max(1, int(days)))
        except ValueError:
            pass
    return timedelta(days=2)

# Starting sleep between requests. GDELT's docs say 5s is enough but their
# server disagrees in practice, so we start at 6 and let the backoff logic
# push us higher when 429s hit.
BASE_SLEEP_SECONDS = 6.0

# If we get this many 429s in a row on the same district, give up on that
# district for this run. Stops one grumpy IP session from eating the whole
# 45 minute job budget.
MAX_CONSECUTIVE_RATE_LIMITS = 3

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

class RateLimited(Exception):
    """Raised when GDELT rate-limits us. Distinct from other errors so the
    caller can count consecutive 429s and skip a district when things get
    hopeless."""
    pass


def fetch(url: str, retries: int = 4) -> dict:
    """GET one JSON page from GDELT with exponential backoff on 429.

    Raises RateLimited if GDELT keeps rate-limiting us after all retries.
    Raises RuntimeError for anything else (network, timeout, JSON error).

    Backoff schedule: sleep 15s, 30s, 60s, 120s on successive 429s. We also
    respect the Retry-After header when GDELT bothers to send one."""
    last_err: Exception | None = None
    was_rate_limited = False
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8", errors="replace")

            # GDELT sometimes returns a rate-limit HTML page with 200 status
            # instead of a proper 429. Probe the body text to catch that.
            if body.lstrip().startswith("Please limit requests"):
                was_rate_limited = True
                wait = min(15.0 * (2 ** attempt), 180.0)
                print(f"  rate-limited (soft), sleeping {wait:.0f}s",
                      file=sys.stderr)
                time.sleep(wait)
                continue

            if not body.strip():
                return {"articles": []}
            return json.loads(body)

        except urllib.error.HTTPError as e:
            if e.code == 429:
                was_rate_limited = True
                # Prefer server-supplied retry hint when present.
                retry_after = e.headers.get("Retry-After") if e.headers else None
                try:
                    wait = float(retry_after) if retry_after else 15.0 * (2 ** attempt)
                except (TypeError, ValueError):
                    wait = 15.0 * (2 ** attempt)
                wait = min(wait, 180.0)
                print(f"  rate-limited (429), sleeping {wait:.0f}s",
                      file=sys.stderr)
                time.sleep(wait)
                continue
            last_err = e
            time.sleep(BASE_SLEEP_SECONDS * (attempt + 1))
        except Exception as e:  # network, timeout, JSON, etc.
            last_err = e
            time.sleep(BASE_SLEEP_SECONDS * (attempt + 1))

    if was_rate_limited:
        raise RateLimited(f"GDELT kept rate-limiting after {retries} retries")
    raise RuntimeError(
        f"GDELT fetch failed after {retries} tries: {last_err}"
    ) from last_err


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
    """Sweep the [start, end) window for one district's food-safety news.
    Returns raw article dicts with a matched_query field for downstream
    location attribution.

    If GDELT rate-limits us MAX_CONSECUTIVE_RATE_LIMITS times in a row on
    this district, we give up on it for this run and return whatever we
    collected so far. The daily cron will try again tomorrow."""
    # Quote the district if it has spaces so GDELT treats it as a phrase.
    dist_query = f'"{district}"' if " " in district else district
    query = f'{dist_query} AND {FOOD_TERMS}'

    out: list[dict] = []
    consecutive_rate_limits = 0

    for w_start, w_end in slice_windows(start, end):
        url = gdelt_url(query, w_start, w_end)
        try:
            data = fetch(url)
            consecutive_rate_limits = 0  # good response, reset the counter
        except RateLimited as e:
            consecutive_rate_limits += 1
            print(f"  x {district} {w_start:%Y-%m}: {e}", file=sys.stderr)
            if consecutive_rate_limits >= MAX_CONSECUTIVE_RATE_LIMITS:
                print(f"  skipping {district} — {consecutive_rate_limits} "
                      f"rate-limits in a row, will retry tomorrow",
                      file=sys.stderr)
                return out
            time.sleep(BASE_SLEEP_SECONDS)
            continue
        except RuntimeError as e:
            print(f"  x {district} {w_start:%Y-%m}: {e}", file=sys.stderr)
            time.sleep(BASE_SLEEP_SECONDS)
            continue

        articles = data.get("articles", []) or []
        for a in articles:
            # GDELT's seendate is "20240111T104500Z". Reshape into ISO 8601
            # so clean.py's date sort works.
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
            print(f"  . {district} {w_start:%Y-%m}: {len(articles)}")

        time.sleep(BASE_SLEEP_SECONDS)

    return out


def main() -> int:
    end = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    delta = lookback_delta()
    start = end - delta

    print(f"Sweeping GDELT for TG + AP food-safety news, "
          f"{start:%Y-%m-%d} -> {end:%Y-%m-%d} "
          f"({delta.days} day window)", file=sys.stderr)
    est_slices = max(1, delta.days // SLICE_DAYS + (1 if delta.days % SLICE_DAYS else 0))
    est_min = len(DISTRICTS) * est_slices * BASE_SLEEP_SECONDS / 60
    print(f"Districts: {len(DISTRICTS)}, {BASE_SLEEP_SECONDS}s between "
          f"requests -> ~{est_min:.0f} min best case",
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
