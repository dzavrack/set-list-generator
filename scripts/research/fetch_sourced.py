#!/usr/bin/env python3
"""
Pull sourced background info for a genre's songs from Wikidata and English Wikipedia.

  python3 scripts/research/fetch_sourced.py jazz            # every tune
  python3 scripts/research/fetch_sourced.py jazz --top 25   # the 25 most popular

Writes scripts/research/out/<genre>-sourced.json: { songId: { ...fields, sources: {...} } }.
Only facts a source actually states go in here; gaps are filled later (and marked unverified).
Responses are cached in scripts/research/.cache so re-runs are fast and polite.
"""
import hashlib
import json
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).parent / ".cache"
OUT = Path(__file__).parent / "out"
UA = "GigBook-research/0.1 (personal project; set-list app)"
# python.org builds on macOS ship without a CA bundle; use the system one (verification stays on)
SSL = ssl.create_default_context(cafile="/etc/ssl/cert.pem") if Path("/etc/ssl/cert.pem").exists() else ssl.create_default_context()

# Wikidata classes that mean "this item is a piece of music", not a film, album, person...
SONGLIKE = {
    "Q7366",       # song
    "Q105543609",  # musical work/composition
    "Q207628",     # musical composition
    "Q2188189",    # musical work
    "Q134556",     # single
    "Q1045937",    # jazz standard (where used)
    "Q55850593",   # instrumental piece
    "Q2743",       # musical (for "from the show" lookups only; never picked as the song)
}
NOT_SONG = {"Q2743", "Q11424", "Q482994", "Q5", "Q5398426", "Q215380", "Q7725634", "Q169930"}


def get(url, params=None, pause=0.6):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    key = hashlib.sha1(url.encode()).hexdigest()
    hit = CACHE / key
    if hit.exists():
        return json.loads(hit.read_text())
    for attempt in range(7):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30, context=SSL) as r:
                data = json.loads(r.read().decode())
            CACHE.mkdir(exist_ok=True)
            hit.write_text(json.dumps(data))
            time.sleep(pause)
            return data
        except Exception as e:  # network hiccup or rate limit: back off and retry
            if attempt == 6:
                print(f"  ! giving up on {url[:90]}: {e}", file=sys.stderr)
                return None
            # the query service can be on a strict one-request-a-minute rule; retrying sooner resets the clock
            wait = 65 if "query.wikidata.org" in url else 5 * (attempt + 1)
            retry_after = getattr(e, "headers", None) and e.headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                wait = max(wait, int(retry_after))
            time.sleep(wait)


WD = "https://www.wikidata.org/w/api.php"
WP = "https://en.wikipedia.org/w/api.php"


def norm(s):
    s = s.lower().replace("’", "'").replace("&", "and")
    s = re.sub(r"\((.*?)\)", " ", s)
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip().lstrip("'")


def claim_ids(ent, prop):
    out = []
    for c in ent.get("claims", {}).get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and "id" in v:
            out.append(v["id"])
    return out


def claim_year(ent, *props):
    for prop in props:
        years = []
        for c in ent.get("claims", {}).get(prop, []):
            v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
            if isinstance(v, dict) and "time" in v:
                m = re.match(r"[+-](\d{4})", v["time"])
                if m:
                    years.append(int(m.group(1)))
        if years:
            return min(years)
    return None


def entities(ids, props="claims|sitelinks|labels|descriptions|aliases"):
    out = {}
    ids = list(dict.fromkeys(ids))
    for i in range(0, len(ids), 50):
        chunk = ids[i : i + 50]
        data = get(WD, {"action": "wbgetentities", "ids": "|".join(chunk), "props": props, "languages": "en", "sitefilter": "enwiki", "format": "json"}, pause=1.5)
        out.update((data or {}).get("entities", {}))
    return out


def label(ent):
    return ent.get("labels", {}).get("en", {}).get("value")


def squash(s):
    return norm(s).replace(" ", "").replace("'", "")


def names_of(ent):
    out = [label(ent) or ""]
    out += [a["value"] for a in ent.get("aliases", {}).get("en", [])]
    wt = ent.get("sitelinks", {}).get("enwiki", {}).get("title")
    if wt:
        out.append(re.sub(r"\s*\(.*?\)\s*$", "", wt))
    return [n for n in out if n]


def score(ent, title):
    """How sure are we this Wikidata item is the song we mean? <=0 means no."""
    # the item must actually be called this: stops matches to tunes that merely borrow the chords
    if squash(title) not in {squash(n) for n in names_of(ent)} and squash(re.sub(r"\s*\(.*?\)", "", title)) not in {squash(n) for n in names_of(ent)}:
        return 0
    p31 = set(claim_ids(ent, "P31"))
    if p31 & NOT_SONG or not p31 & SONGLIKE:
        desc = ent.get("descriptions", {}).get("en", {}).get("value", "").lower()
        if not re.search(r"\b(song|standard|composition|tune)\b", desc):
            return 0
    s = 1
    if norm(label(ent) or "") == norm(title):
        s += 2
    if claim_ids(ent, "P86") or claim_ids(ent, "P676"):
        s += 3
    if "enwiki" in ent.get("sitelinks", {}):
        s += 2
    y = claim_year(ent, "P577", "P571")
    if y and y < 1990:
        s += 1
    desc = ent.get("descriptions", {}).get("en", {}).get("value", "").lower()
    if "jazz" in desc or "standard" in desc:
        s += 2
    return s


# ---------- Wikipedia ----------

def wikitext(titles):
    out = {}
    for i in range(0, len(titles), 20):
        chunk = titles[i : i + 20]
        data = get(WP, {"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "titles": "|".join(chunk), "redirects": 1, "format": "json", "formatversion": 2}, pause=1.0)
        pages = (data or {}).get("query", {}).get("pages", [])
        back = {r["to"]: r["from"] for r in (data or {}).get("query", {}).get("redirects", [])}
        for p in pages:
            revs = p.get("revisions")
            if revs:
                t = p["title"]
                out[back.get(t, t)] = revs[0]["slots"]["main"]["content"]
    return out


LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def unlink(s):
    s = LINK.sub(lambda m: m.group(2) or m.group(1), s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"<ref[^>]*/>|<ref.*?</ref>|<[^>]+>", "", s, flags=re.S)
    s = s.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", s).strip(" ,;")


def infobox(text):
    m = re.search(r"\{\{\s*Infobox[^|]*", text, re.I)
    if not m:
        return {}
    depth, i = 0, m.start()
    while i < len(text):
        if text.startswith("{{", i):
            depth += 1; i += 2; continue
        if text.startswith("}}", i):
            depth -= 1; i += 2
            if depth == 0:
                break
            continue
        i += 1
    body = text[m.start() : i]
    fields = {}
    for line in re.split(r"\n\s*\|", body):
        if "=" in line:
            k, v = line.split("=", 1)
            fields[k.strip().lower()] = v.strip()
    return fields


def year_of(s):
    m = re.search(r"\b(1[89]\d\d|20[0-2]\d)\b", s or "")
    return int(m.group(1)) if m else None


def names(s):
    s = re.sub(r"\{\{\s*(?:plainlist|flatlist|hlist|ubl|unbulleted list)\s*\|?", "", s or "", flags=re.I)
    parts = re.split(r"<br\s*/?>|\n\*|\*|\||,| and |&", unlink(s) if "[[" not in s else s)
    out = []
    for p in parts:
        p = unlink(p).strip(" *")
        if p and len(p) < 60 and not re.search(r"\d{4}|see |various", p, re.I):
            out.append(p)
    return list(dict.fromkeys(out))


SECTION = re.compile(r"^(==+)\s*([^=]+?)\s*\1\s*$", re.M)


def recordings(text):
    """Artists + years from a 'notable recordings'-style section's bullet list."""
    heads = list(SECTION.finditer(text))
    out = []
    for n, h in enumerate(heads):
        name = h.group(2).lower()
        if not re.search(r"recording|version|cover|performance|discography", name):
            continue
        end = heads[n + 1].start() if n + 1 < len(heads) else len(text)
        for line in text[h.end() : end].splitlines():
            if not line.startswith("*"):
                continue
            links = LINK.findall(line)
            if not links:
                continue
            artist = links[0][1] or links[0][0]
            if re.search(r"album|film|\(song\)", links[0][0], re.I) and len(links) > 1:
                artist = links[1][1] or links[1][0]
            yr = year_of(line)
            out.append({"artist": unlink(artist), **({"year": yr} if yr else {})})
            if len(out) >= 12:
                return out
    return out


def lead_origin(text):
    lead = text[: (SECTION.search(text).start() if SECTION.search(text) else len(text))]
    lead = re.sub(r"<ref[^>]*/>|<ref.*?</ref>", "", lead, flags=re.S)
    m = re.search(
        r"\b(?:written|composed|introduced|featured|published)?\s*(?:for|from|in) the (?:\d{4} )?(?:[A-Z][a-z]+ )?"
        r"(?:Broadway |stage |film |motion picture |musical |MGM |Paramount |Warner Bros\. )*(musical|film|show|revue|movie|operetta|opera|motion picture)"
        r"(?: comedy| play| revue)?,?\s*(?:''|\")*\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]",
        lead,
    )
    if m:
        work = re.sub(r"\s*\((?:film|musical|\d{4} film)\)$", "", m.group(3) or m.group(2))
        return {"work": work, "kind": "film" if m.group(1) in ("film", "movie", "motion picture") else "show"}
    return None


# ---------- main ----------

def main():
    genre = sys.argv[1] if len(sys.argv) > 1 else "jazz"
    top = int(sys.argv[sys.argv.index("--top") + 1]) if "--top" in sys.argv else None
    songs = json.loads((ROOT / f"src/data/genres/{genre}.json").read_text())
    songs.sort(key=lambda s: s.get("rank") or 10**9)
    if top:
        songs = songs[:top]

    # 1. candidates per title: batched label/alias lookups on the query service (a few requests for the
    #    whole book), then the slower one-at-a-time search only for titles that found nothing.
    def variants(t):
        vs = {t, t.replace("'", "’"), re.sub(r"\s*\(.*?\)\s*", " ", t).strip(), t.replace('"', "")}
        vs |= {v[4:] for v in list(vs) if v.startswith("The ")}
        return {v for v in vs if v}

    by_variant = {}
    for s in songs:
        for v in variants(s["title"]):
            by_variant.setdefault(v, []).append(s["id"])
    cands = {s["id"]: [] for s in songs}
    keys = list(by_variant) if "--sparql" in sys.argv else []  # the query service is often throttled; opt in
    for i in range(0, len(keys), 150):
        chunk = keys[i : i + 150]
        values = " ".join(json.dumps(v) + "@en" for v in chunk)
        q = f"""SELECT DISTINCT ?item ?name WHERE {{
          VALUES ?name {{ {values} }}
          {{ ?item rdfs:label ?name }} UNION {{ ?item skos:altLabel ?name }}
          ?item wdt:P31 ?cls .
          FILTER(?cls IN (wd:Q7366, wd:Q105543609, wd:Q207628, wd:Q2188189, wd:Q134556, wd:Q55850593))
        }}"""
        # the query service may be throttled (at worst ~1 request a minute), so batches are big and spaced out
        data = get("https://query.wikidata.org/sparql", {"query": q, "format": "json"}, pause=61)
        for b in (data or {}).get("results", {}).get("bindings", []):
            qid = b["item"]["value"].rsplit("/", 1)[1]
            for sid in by_variant.get(b["name"]["value"], []):
                if qid not in cands[sid]:
                    cands[sid].append(qid)
        print(f"batch lookup {min(i + 150, len(keys))}/{len(keys)}", file=sys.stderr)

    misses = [s for s in songs if not cands[s["id"]]]
    if "--no-search" not in sys.argv:
        # fallback: Wikipedia's search is far less throttled; take the Wikidata items behind its top hits
        for n, s in enumerate(misses):
            res = get(WP, {"action": "query", "generator": "search", "gsrsearch": f'"{s["title"]}" song jazz', "gsrlimit": 6,
                           "prop": "pageprops", "ppprop": "wikibase_item", "format": "json", "formatversion": 2}, pause=0.8)
            pages = sorted((res or {}).get("query", {}).get("pages", []), key=lambda p: p.get("index", 99))
            cands[s["id"]] = [p["pageprops"]["wikibase_item"] for p in pages if p.get("pageprops", {}).get("wikibase_item")]
            if n % 25 == 0:
                print(f"wikipedia search {n}/{len(misses)}", file=sys.stderr)

    ents = entities([q for ids in cands.values() for q in ids])

    picked = {}
    for s in songs:
        best = max(((score(ents.get(q, {}), s["title"]), q) for q in cands[s["id"]]), default=(0, None))
        if best[0] >= 5:  # needs to be song-like, and have credits or a Wikipedia article
            picked[s["id"]] = best[1]

    # 2. resolve people and shows
    ref_ids = []
    for q in picked.values():
        e = ents[q]
        ref_ids += claim_ids(e, "P86") + claim_ids(e, "P676")
    refs = entities(ref_ids, props="labels|claims")

    result = {}
    wp_title = {}
    for s in songs:
        q = picked.get(s["id"])
        if not q:
            continue
        e = ents[q]
        info, src = {}, {"wikidata": f"https://www.wikidata.org/wiki/{q}"}
        comp = [label(refs.get(i, {})) for i in claim_ids(e, "P86")]
        lyr = [label(refs.get(i, {})) for i in claim_ids(e, "P676")]
        if any(comp):
            info["composer"] = ", ".join(c for c in comp if c)
        if any(lyr):
            info["lyricist"] = ", ".join(c for c in lyr if c)
        y = claim_year(e, "P577", "P571", "P1191")
        if y:
            info["publishYear"] = y
        wt = e.get("sitelinks", {}).get("enwiki", {}).get("title")
        if wt:
            wp_title[s["id"]] = wt
            src["wikipedia"] = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(wt.replace(" ", "_"))
        info["sources"] = src
        result[s["id"]] = info

    # 3. Wikipedia: infobox credits the item lacks, the show it came from, notable recordings
    texts = wikitext(list(set(wp_title.values())))
    for sid, t in wp_title.items():
        text = texts.get(t)
        if not text:
            continue
        info = result[sid]
        box = infobox(text)
        if "composer" not in info:
            c = names(box.get("composer") or box.get("writer") or box.get("music") or "")
            if c:
                info["composer"] = ", ".join(c)
        if "lyricist" not in info:
            l = names(box.get("lyricist") or box.get("lyrics") or "")
            if l:
                info["lyricist"] = ", ".join(l)
        if "publishYear" not in info:
            y = year_of(box.get("published") or box.get("written") or box.get("composed") or box.get("released") or "")
            if y:
                info["publishYear"] = y
        o = lead_origin(text)
        if o:
            info["origin"] = o["work"]
            info["originKind"] = o["kind"]
        recs = recordings(text)
        if recs:
            info["famousRecordings"] = recs

    OUT.mkdir(exist_ok=True)
    out = OUT / f"{genre}-sourced.json"
    out.write_text(json.dumps(result, indent=1, ensure_ascii=False))
    have = lambda f: sum(1 for v in result.values() if f in v)
    print(f"{len(result)}/{len(songs)} matched · composer {have('composer')} · year {have('publishYear')} · "
          f"origin {have('origin')} · recordings {have('famousRecordings')} · wikipedia {sum(1 for v in result.values() if 'wikipedia' in v['sources'])}")
    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
