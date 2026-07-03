"""
clean.py — build public/data.json from all available raw sources.

Sources it tries, in order:

  1. gdelt_raw.json — recent GDELT sweep from scrape_gdelt.py
  2. rss_raw.json   — recent Google News RSS from scrape_rss.py
  3. news_food_safety_articles__1_.json — legacy seed (if present)

Any source that isn't on disk is quietly skipped.

**Incremental merge.** The pipeline runs daily. Each run's raw JSON only
covers the last couple of days (so it stays fast), but public/data.json
must accumulate history — every story ever seen. So before writing out,
we load whatever's already in public/data.json and merge it with the new
raw records, then dedup on `link`. Old stories survive even if today's
scrape didn't include them; new stories get appended; the same story never
appears twice, no matter how many times its URL shows up across days or
sources.

Deduplication key = article `link`. Same URL across GDELT + RSS + legacy
seed + previous public/data.json = one record. When the same link appears
in multiple sources we keep the version that already has classification
data attached (i.e. prefer the previously-cleaned public/data.json entry)
so a badly-classified rerun doesn't overwrite a good older classification.

Classification (action_taken / violations / authority / fine / confidence)
is regex-driven. Deliberately keyword-level, not LLM-level — the whole
point of the project is that we can rebuild the dataset any time from
public RSS without paying for inference. LLM-based upgrades are tracked
separately.

Location attribution:
  · If the raw record carries `matched_query` (GDELT and legacy seed both
    set this to a district name), we trust that.
  · Otherwise we scan the title for a district name — longest first so
    "Rangareddy" wins over "Ranga" and "Sri Sathya Sai" over "Sri".
  · Records where we can't attribute a district are dropped (with a count
    printed at the end so we notice if the source's coverage drifts).
"""

from __future__ import annotations

import json
import os
import random
import re
import sys
from collections import Counter
from typing import Any

from districts import DISTRICTS

# Longest first so multi-word districts win over their prefixes.
DIST_NAMES_SORTED = sorted(DISTRICTS.keys(), key=len, reverse=True)

# ---- District attribution ---------------------------------------------------

def extract_district(record: dict[str, Any]) -> str | None:
    # 1. Explicit provenance from the scraper.
    mq = record.get("matched_query") or ""
    mq = re.sub(r"\(site:[^)]+\)", "", mq).strip()
    for d in DIST_NAMES_SORTED:
        if mq.startswith(d):
            return d

    # 2. Fall back to a case-insensitive title scan. Only useful for records
    #    that lost their matched_query (e.g. hand-added feeds).
    haystack = f"{record.get('title', '')} {record.get('summary', '')}".lower()
    for d in DIST_NAMES_SORTED:
        if d.lower() in haystack:
            return d

    return None


# ---- Classification ---------------------------------------------------------

ACTION_RULES: list[tuple[str, list[str]]] = [
    ("sealed", [r"\bseal(ed|s)?\b"]),
    ("license_cancelled", [r"licen[cs]e (cancel|revok|suspend)", r"permit (cancel|revok)"]),
    ("fined", [r"\bfine[ds]?\b", r"penal[iz]", r"penalt"]),
    ("raided", [r"\braid(ed|s)?\b", r"\binspect(ed|ion)"]),
    ("food_seized", [r"\bseiz", r"\bconfiscat", r"\bdestroy(ed)?\b"]),
    ("closed", [r"shut down", r"shutter", r"clos(ed|es|ure)"]),
    ("notice_issued", [r"notice", r"show[- ]cause", r"warn(ed|ing)"]),
    ("samples_collected", [r"sample"]),
]

VIOLATION_PATTERNS: list[tuple[str, str]] = [
    ("expired/stale ingredients", r"\b(expired|stale|rotten|spoiled|rancid)\b"),
    ("unhygienic conditions", r"\b(unhygienic|unsanitary|filthy|insanitary)\b"),
    ("pest infestation", r"\b(cockroach|rodent|rat|insect|fly|flies|pest)\b"),
    ("no license/registration", r"\b(unlicensed|no licen[cs]e|without licen[cs]e|no fssai)\b"),
    ("adulteration", r"\badulterat"),
    ("milk/dairy adulteration", r"\bmilk\b.{0,20}\badulterat|adulterat.{0,20}\bmilk\b"),
    ("contaminated water/oil", r"\b(contaminat|reused oil|synthetic)\b"),
    ("meat/poultry violation",
     r"\b(meat|chicken|mutton)\b.{0,25}\b(expired|rotten|unhygienic|stale|seiz)"),
]

NOISE_PATTERNS = [
    r"\bwater plan\b", r"\blounge", r"\btraining for\b", r"\bhostel cooks\b.{0,30}\btrain",
    r"\bunveils\b", r"\byoga\b", r"\bfilm\b", r"\bmovie\b", r"\belection\b", r"\bpolitic",
    r"\bcricket\b", r"\bwedding\b", r"\bhoroscope\b", r"\bweather\b",
    r"\bpulls up\b.{0,20}\bofficials\b", r"\branking\b", r"\bexcise\b.{0,15}vineyard",
]

# Out-of-scope location mentions — this dataset covers TG/AP only. A headline
# clearly about elsewhere is noise even if it matched a district keyword.
OUT_OF_SCOPE_PLACES = [
    r"\bchennai\b", r"\btamil nadu\b", r"\bkarnataka\b", r"\bbengaluru\b", r"\bbangalore\b",
    r"\bmumbai\b", r"\bdelhi\b", r"\bkerala\b", r"\bkolkata\b", r"\bpunjab\b", r"\bgujarat\b",
    r"\bmaharashtra\b", r"\bodisha\b", r"\brajasthan\b",
]

RELEVANT_HINTS = [
    r"\braid", r"\bseal", r"\bseiz", r"\badulterat", r"\bunhygienic", r"\bfssai",
    r"h-fast", r"\bfine[ds]?\b", r"\bpenal", r"\bstale\b", r"\bexpired\b", r"\bnotice\b",
    r"\bshut down\b", r"\blicen[cs]e cancel", r"\bfood safety\b", r"\bcontaminat",
    r"\bfood poison", r"\bhospitali[sz]", r"\bill\b.{0,20}\beat", r"\bsick\b.{0,20}\bfood\b",
]


def classify(title: str, summary: str) -> dict[str, Any]:
    text = f"{title} {summary}".lower()

    is_noise = any(re.search(p, text) for p in NOISE_PATTERNS)
    is_out_of_scope = any(re.search(p, text) for p in OUT_OF_SCOPE_PLACES)
    is_relevant_hint = any(re.search(p, text) for p in RELEVANT_HINTS)

    actions: list[str] = []
    for label, patterns in ACTION_RULES:
        if any(re.search(p, text) for p in patterns):
            actions.append(label)
    if re.search(r"\bfood poison", text) or (re.search(r"\bhospitali[sz]", text) and "food" in text):
        actions.append("poisoning_incident")

    violations: list[str] = []
    for label, pattern in VIOLATION_PATTERNS:
        if re.search(pattern, text):
            violations.append(label)

    authority = None
    if "h-fast" in text or "hfast" in text:
        authority = "H-FAST"
    elif "fssai" in text:
        authority = "FSSAI"
    elif "ghmc" in text:
        authority = "GHMC"
    elif "food safety" in text:
        authority = "Food Safety Department"

    fine_match = re.search(r"(?:rs\.?|₹|inr)\s?[\d,]+(?:\s?(?:lakh|crore))?", text, re.IGNORECASE)
    fine_amount = fine_match.group(0) if fine_match else None

    if is_out_of_scope:
        confidence = "noise"
    elif is_noise and not actions:
        confidence = "noise"
    elif actions and violations:
        confidence = "high"
    elif actions or (is_relevant_hint and violations):
        confidence = "medium"
    elif is_relevant_hint:
        confidence = "low"
    else:
        confidence = "noise"

    return {
        "action_taken": actions,
        "violations": violations,
        "authority": authority,
        "fine_amount": fine_amount,
        "confidence": confidence,
    }


# ---- Pipeline ---------------------------------------------------------------

# Deterministic jitter so overlapping district-level pins don't stack exactly.
# Seeded on the record's URL so repeat runs produce byte-identical output —
# critical because the GH Action commits data.json only if it actually changed.
def jitter_for(link: str, lat: float, lon: float) -> tuple[float, float]:
    rng = random.Random(link or "seed")
    return (lat + rng.uniform(-0.06, 0.06), lon + rng.uniform(-0.06, 0.06))


SOURCES = [
    "gdelt_raw.json",
    "rss_raw.json",
    "news_food_safety_articles__1_.json",
    # Also honour the /mnt/user-data upload path if this is run in a
    # Claude-notebook-style env (backward compatible with the original script).
    "/mnt/user-data/uploads/news_food_safety_articles__1_.json",
]

EXISTING_DATA = "public/data.json"


def load_all_sources() -> list[dict]:
    merged: list[dict] = []
    for path in SOURCES:
        if not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ! skipping {path}: {e}", file=sys.stderr)
            continue
        if not isinstance(data, list):
            print(f"  ! skipping {path}: not a list", file=sys.stderr)
            continue
        print(f"  · {path}: {len(data)} records", file=sys.stderr)
        merged.extend(data)
    return merged


def load_existing() -> list[dict]:
    """Return the last-written public/data.json as raw-shaped records so
    they can be merged with today's scrape. Missing file = fresh start."""
    if not os.path.exists(EXISTING_DATA):
        return []
    try:
        with open(EXISTING_DATA, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"  ! could not read existing {EXISTING_DATA}: {e}", file=sys.stderr)
        return []
    if not isinstance(data, list):
        return []
    print(f"  · {EXISTING_DATA}: {len(data)} historical records", file=sys.stderr)
    # Mark each so the merge step knows they've already been classified —
    # avoids re-running regex over ten thousand records every day.
    for r in data:
        r["_from_existing"] = True
    return data


def main() -> int:
    print("Loading existing dataset…", file=sys.stderr)
    existing = load_existing()

    print("Loading raw sources…", file=sys.stderr)
    raw_new = load_all_sources()
    if not raw_new and not existing:
        print("No input sources and no existing data. Run scrape_gdelt.py "
              "(or place a raw JSON in the repo root) before running clean.py.",
              file=sys.stderr)
        return 1

    # Dedup on `link` across the union. `link` is the strongest identity —
    # the same story from different queries has the same URL, and news
    # aggregators like Google News wrap the same source URL identically
    # each time.
    #
    # Precedence when a link appears twice: prefer the record that already
    # has classification (_from_existing=True) over a raw scrape. Keeps
    # historical classifications intact across runs even if the raw's
    # title-only classifier would have graded the same story differently.
    by_link: dict[str, dict] = {}
    for r in existing + raw_new:
        link = (r.get("link") or "").strip()
        if not link:
            # Fall back to title as identity for the rare linkless record —
            # can happen with legacy seed data.
            link = "title::" + (r.get("title") or "").strip().lower()
            if link == "title::":
                continue  # nothing to key on
        if link in by_link:
            # Prefer existing (already-classified) over fresh raw.
            if by_link[link].get("_from_existing"):
                continue
            if r.get("_from_existing"):
                by_link[link] = r
            # else: two raws with same link — keep whichever came first
            continue
        by_link[link] = r

    all_unique = list(by_link.values())
    print(f"Existing: {len(existing)}   new raw: {len(raw_new)}   "
          f"after link-dedup: {len(all_unique)}   "
          f"(added {len(all_unique) - len(existing)} new)", file=sys.stderr)

    out: list[dict] = []
    skipped_no_district = 0
    for d in all_unique:
        # Records that came from public/data.json already have a district
        # attributed and a classification computed — pass them through.
        if d.get("_from_existing"):
            # Strip the marker before writing so it doesn't pollute the
            # output shape. district / state / coords already set.
            clean_record = {k: v for k, v in d.items() if k != "_from_existing"}
            out.append(clean_record)
            continue

        # Fresh raw record — attribute district + classify.
        district = extract_district(d)
        if not district:
            skipped_no_district += 1
            continue
        lat0, lon0, state = DISTRICTS[district]
        lat, lon = jitter_for(d.get("link", ""), lat0, lon0)
        cls = classify(d.get("title", ""), d.get("summary", ""))
        out.append({
            "title": d.get("title", ""),
            "link": d.get("link", ""),
            "published": d.get("published", ""),
            "source": d.get("source", ""),
            "district": district,
            "state": state,
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            **cls,
        })

    # Sort by published date descending — natural newest-first order.
    out.sort(key=lambda r: r.get("published") or "", reverse=True)
    # Re-issue stable IDs after sorting so the id → index mapping is
    # deterministic across runs. IDs are 0..n-1 in date order, so a new
    # article at the top pushes everyone's id down by one — that's fine,
    # nothing on the front-end persists id references across sessions.
    for i, r in enumerate(out):
        r["id"] = i

    print(f"Output records: {len(out)}", file=sys.stderr)
    print(f"Skipped fresh raws (no district): {skipped_no_district}", file=sys.stderr)
    print(f"Confidence: {Counter(r['confidence'] for r in out)}", file=sys.stderr)
    print(f"State:      {Counter(r['state'] for r in out)}", file=sys.stderr)

    os.makedirs("public", exist_ok=True)
    with open("public/data.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("Wrote public/data.json", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
