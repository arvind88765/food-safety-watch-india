"""
scrape_rss.py — pull the last ~30 days of Google News RSS for TG + AP food
safety enforcement. Companion to scrape_gdelt.py.

Why this exists alongside GDELT: GDELT can lag a few days behind fresh news,
and its coverage of some regional publications is spotty. Google News RSS
catches the trailing edge that GDELT missed. Between the two we get both
historical depth (GDELT) and last-mile freshness (RSS).

Output: rss_raw.json in the same shape scrape_gdelt.py emits so clean.py
consumes them identically.

Rate limit: Google News RSS doesn't publish one, but we still throttle to
be polite — one request per 2 seconds is plenty for ~60 queries.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from districts import DISTRICTS

USER_AGENT = "food-safety-watch-india/1.0 (+https://github.com/arvind88765/food-safety-watch-india)"

# Same food-safety vocabulary as GDELT — kept in sync intentionally so the
# two sources cover the same universe of stories.
FOOD_TERMS = (
    '"food safety" OR "food adulteration" OR "food poisoning" OR "FSSAI" '
    'OR "H-FAST" OR "unhygienic" OR "food seized" OR "restaurant sealed" '
    'OR "restaurant raid" OR "eatery raid" OR "food inspector" '
    'OR "food commissioner"'
)


def rss_url(query: str) -> str:
    q = urllib.parse.quote_plus(query)
    # hl=en-IN gl=IN ceid=IN:en scopes the results to India English.
    return f"https://news.google.com/rss/search?q={q}&hl=en-IN&gl=IN&ceid=IN:en"


def parse_rss(xml_bytes: bytes) -> list[dict]:
    """Extract items from a Google News RSS response. Returns a list of
    dicts with title/link/published/source/summary — matching the raw shape
    clean.py expects."""
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel")
    if channel is None:
        return []
    out: list[dict] = []
    for item in channel.findall("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        # Google News RSS ships pubDate in RFC 822; convert to ISO 8601 so
        # clean.py and the front-end can lexicographically sort.
        iso = ""
        if pub:
            try:
                # e.g. "Mon, 03 Jun 2024 12:34:56 GMT"
                dt = datetime.strptime(pub, "%a, %d %b %Y %H:%M:%S %Z")
                iso = dt.replace(tzinfo=timezone.utc).isoformat()
            except ValueError:
                iso = pub  # keep original if it doesn't parse

        # <source url="…">Publication Name</source>
        src_el = item.find("source")
        source = src_el.text.strip() if (src_el is not None and src_el.text) else ""

        summary = (item.findtext("description") or "").strip()
        # description is HTML-ish; strip tags for the regex classifier
        summary = re.sub(r"<[^>]+>", " ", summary)
        summary = re.sub(r"\s+", " ", summary)[:500]

        out.append({
            "title": title,
            "link": link,
            "published": iso,
            "source": source,
            "summary": summary,
        })
    return out


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def main() -> int:
    all_items: list[dict] = []
    for district in DISTRICTS:
        # Quote multi-word district names so Google treats them as a phrase.
        dist_q = f'"{district}"' if " " in district else district
        query = f"{dist_q} ({FOOD_TERMS})"
        url = rss_url(query)
        try:
            body = fetch(url)
        except Exception as e:  # network / DNS / etc.
            print(f"  ✗ {district}: {e}", file=sys.stderr)
            time.sleep(2)
            continue

        items = parse_rss(body)
        for it in items:
            it["matched_query"] = district  # provenance for clean.py
        if items:
            print(f"  · {district}: {len(items)}", file=sys.stderr)
        all_items.extend(items)
        time.sleep(2)  # polite spacing

    # Dedup by (title, link) — same story surfaces under multiple districts
    # when the article mentions several. Keep first match.
    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for it in all_items:
        key = (it["title"].strip().lower(), it["link"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(it)

    print(f"\nRSS raw: {len(all_items)}   after dedup: {len(deduped)}", file=sys.stderr)

    with open("rss_raw.json", "w", encoding="utf-8") as f:
        json.dump(deduped, f, ensure_ascii=False, indent=1)
    print("Wrote rss_raw.json", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
