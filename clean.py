import json, re, random
from districts import DISTRICTS

with open('/mnt/user-data/uploads/news_food_safety_articles__1_.json', encoding='utf-8') as f:
    raw = json.load(f)

TEMPLATES = ['food safety raid', 'unhygienic kitchen', 'food adulteration', 'H-FAST raid',
             'stale food seized', 'restaurant hygiene', 'restaurant sealed', 'FSSAI raid',
             'expired meat seized']

DIST_NAMES_SORTED = sorted(DISTRICTS.keys(), key=len, reverse=True)

def extract_district(matched_query):
    mq = matched_query or ''
    # strip site: qualifiers
    mq = re.sub(r'\(site:[^)]+\)', '', mq).strip()
    for d in DIST_NAMES_SORTED:
        if mq.startswith(d):
            return d
    # fallback: try matching anywhere in title later
    return None

ACTION_RULES = [
    ('sealed', [r'\bseal(ed|s)?\b']),
    ('license_cancelled', [r'licen[cs]e (cancel|revok|suspend)', r'permit (cancel|revok)']),
    ('fined', [r'\bfine[ds]?\b', r'penal[iz]', r'penalt']),
    ('raided', [r'\braid(ed|s)?\b', r'\binspect(ed|ion)']),
    ('food_seized', [r'\bseiz', r'\bconfiscat', r'\bdestroy(ed)?\b']),
    ('closed', [r'shut down', r'shutter', r'clos(ed|es|ure)']),
    ('notice_issued', [r'notice', r'show[- ]cause', r'warn(ed|ing)']),
    ('samples_collected', [r'sample']),
]

VIOLATION_PATTERNS = [
    ('expired/stale ingredients', r'\b(expired|stale|rotten|spoiled|rancid)\b'),
    ('unhygienic conditions', r'\b(unhygienic|unsanitary|filthy|insanitary)\b'),
    ('pest infestation', r'\b(cockroach|rodent|rat|insect|fly|flies|pest)\b'),
    ('no license/registration', r'\b(unlicensed|no licen[cs]e|without licen[cs]e|no fssai)\b'),
    ('adulteration', r'\badulterat'),
    ('milk/dairy adulteration', r'\bmilk\b.{0,20}\badulterat|adulterat.{0,20}\bmilk\b'),
    ('contaminated water/oil', r'\b(contaminat|reused oil|synthetic)\b'),
    ('meat/poultry violation', r'\b(meat|chicken|mutton)\b.{0,25}\b(expired|rotten|unhygienic|stale|seiz)'),
]

NOISE_PATTERNS = [
    r'\bwater plan\b', r'\blounge', r'\btraining for\b', r'\bhostel cooks\b.{0,30}\btrain',
    r'\bunveils\b', r'\byoga\b', r'\bfilm\b', r'\bmovie\b', r'\belection\b', r'\bpolitic',
    r'\bcricket\b', r'\bwedding\b', r'\bhoroscope\b', r'\bweather\b',
    r'\bpulls up\b.{0,20}\bofficials\b', r'\branking\b', r'\bexcise\b.{0,15}vineyard',
]

# Out-of-scope location mentions: this dataset should only cover Telangana / Andhra
# Pradesh. If a headline is clearly about somewhere else, treat as noise even if it
# matched a district query (Google News keyword matching isn't location-aware).
OUT_OF_SCOPE_PLACES = [
    r'\bchennai\b', r'\btamil nadu\b', r'\bkarnataka\b', r'\bbengaluru\b', r'\bbangalore\b',
    r'\bmumbai\b', r'\bdelhi\b', r'\bkerala\b', r'\bkolkata\b', r'\bpunjab\b', r'\bgujarat\b',
    r'\bmaharashtra\b', r'\bodisha\b', r'\brajasthan\b',
]

RELEVANT_HINTS = [
    r'\braid', r'\bseal', r'\bseiz', r'\badulterat', r'\bunhygienic', r'\bfssai',
    r'h-fast', r'\bfine[ds]?\b', r'\bpenal', r'\bstale\b', r'\bexpired\b', r'\bnotice\b',
    r'\bshut down\b', r'\blicen[cs]e cancel', r'\bfood safety\b', r'\bcontaminat',
    r'\bfood poison', r'\bhospitali[sz]', r'\bill\b.{0,20}\beat', r'\bsick\b.{0,20}\bfood\b',
]

def classify(title, summary):
    text = f"{title} {summary}".lower()

    is_noise = any(re.search(p, text) for p in NOISE_PATTERNS)
    is_out_of_scope = any(re.search(p, text) for p in OUT_OF_SCOPE_PLACES)
    is_relevant_hint = any(re.search(p, text) for p in RELEVANT_HINTS)

    actions = []
    for label, patterns in ACTION_RULES:
        if any(re.search(p, text) for p in patterns):
            actions.append(label)
    if re.search(r'\bfood poison', text) or (re.search(r'\bhospitali[sz]', text) and 'food' in text):
        actions.append('poisoning_incident')

    violations = []
    for label, pattern in VIOLATION_PATTERNS:
        if re.search(pattern, text):
            violations.append(label)

    authority = None
    if 'h-fast' in text or 'hfast' in text:
        authority = 'H-FAST'
    elif 'fssai' in text:
        authority = 'FSSAI'
    elif 'ghmc' in text:
        authority = 'GHMC'
    elif 'food safety' in text:
        authority = 'Food Safety Department'

    fine_match = re.search(r'(?:rs\.?|₹|inr)\s?[\d,]+(?:\s?(?:lakh|crore))?', text, re.IGNORECASE)
    fine_amount = fine_match.group(0) if fine_match else None

    if is_out_of_scope:
        confidence = 'noise'
    elif is_noise and not actions:
        confidence = 'noise'
    elif actions and violations:
        confidence = 'high'
    elif actions or (is_relevant_hint and violations):
        confidence = 'medium'
    elif is_relevant_hint:
        confidence = 'low'
    else:
        confidence = 'noise'

    return {
        'action_taken': actions,
        'violations': violations,
        'authority': authority,
        'fine_amount': fine_amount,
        'confidence': confidence,
    }

# jitter so overlapping district-level pins don't stack exactly
random.seed(42)
def jitter(lat, lon):
    return (lat + random.uniform(-0.06, 0.06), lon + random.uniform(-0.06, 0.06))

out = []
skipped_no_district = 0
for i, d in enumerate(raw):
    district = extract_district(d.get('matched_query', ''))
    if not district:
        skipped_no_district += 1
        continue
    lat0, lon0, state = DISTRICTS[district]
    lat, lon = jitter(lat0, lon0)
    cls = classify(d.get('title', ''), d.get('summary', ''))
    out.append({
        'id': i,
        'title': d.get('title', ''),
        'link': d.get('link', ''),
        'published': d.get('published', ''),
        'source': d.get('source', ''),
        'district': district,
        'state': state,
        'lat': round(lat, 5),
        'lon': round(lon, 5),
        **cls,
    })

print('total input:', len(raw))
print('skipped (no district match):', skipped_no_district)
print('output records:', len(out))

from collections import Counter
print('confidence breakdown:', Counter(o['confidence'] for o in out))
print('state breakdown:', Counter(o['state'] for o in out))

with open('articles_clean.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
