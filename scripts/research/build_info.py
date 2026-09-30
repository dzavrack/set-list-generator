#!/usr/bin/env python3
"""
Merge sourced facts with the knowledge pass into the app's info file.

  python3 scripts/research/build_info.py jazz

Reads  scripts/research/out/<genre>-sourced.json   (Wikidata / Wikipedia; see fetch_sourced.py)
       scripts/research/knowledge/<genre>-*.psv      (general knowledge; marked unverified)
Writes src/data/info/<genre>.json                   (loaded by the "About this tune" panel)
Also copies composer / lyricist / year into src/data/genres/<genre>.json so exports can credit tunes.

Rules: a sourced value always wins. A knowledge value is used only to fill a gap and is listed in
`unverified`. A landmark recording is `confirmed` when the Wikipedia recordings list names the same
artist (same year when both give one).
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent


def artist_key(name):
    s = name.lower().replace("&", " and ")
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"\b(and (his|her) (orchestra|band|trio|quartet|quintet|sextet|all stars|clouds of joy)|orchestra|quartet|quintet|sextet|septet|trio|the|his|her|big band)\b", " ", s)
    return [w for w in re.findall(r"[a-z]+", s) if len(w) > 2]


def same_artist(a, b):
    ka, kb = artist_key(a), artist_key(b)
    if not ka or not kb:
        return False
    # surnames are the reliable part: "Coleman Hawkins" ~ "Coleman Hawkins and his Orchestra"
    return ka[-1] in kb or kb[-1] in ka or bool(set(ka[:2]) & set(kb[:2]) and len(set(ka) & set(kb)) >= 2)


def parse_recording(text):
    """'Coleman Hawkins 1939' or 'Charlie Parker (as Ko-Ko) 1945' or 'Jack Hylton, 1930'."""
    text = text.strip().rstrip(",")
    if not text:
        return None
    note = None
    m = re.search(r"\(([^)]*)\)", text)
    if m:
        note = m.group(1).strip()
        text = (text[: m.start()] + text[m.end():]).strip()
    year = None
    m = re.search(r",?\s*\b(1[89]\d\d|20[0-2]\d)\b\s*$", text)
    if m:
        year = int(m.group(1))
        text = text[: m.start()].strip().rstrip(",")
    if not text:
        return None
    r = {"artist": text}
    if year:
        r["year"] = year
    if note:
        r["note"] = note
    return r


def load_knowledge(genre):
    out = {}
    for f in sorted(glob.glob(str(HERE / "knowledge" / f"{genre}-*.psv"))):
        for line in open(f, encoding="utf-8"):
            if line.startswith("#") or not line.strip():
                continue
            parts = [p.strip() for p in line.rstrip("\n").split("|")]
            if len(parts) != 8:
                print(f"  ! skipping malformed line in {Path(f).name}: {line[:60]}", file=sys.stderr)
                continue
            sid, comp, lyr, year, origin, kind, first, famous = parts
            out[sid] = {
                "composer": comp or None,
                "lyricist": lyr or None,
                "year": int(year) if year.isdigit() else None,
                "origin": origin or None,
                "originKind": kind if kind in ("show", "film") else None,
                "firstRecording": parse_recording(first) if first else None,
                "famous": [r for r in (parse_recording(x) for x in famous.split(";")) if r],
            }
    return out


def main():
    genre = sys.argv[1] if len(sys.argv) > 1 else "jazz"
    songs_path = ROOT / f"src/data/genres/{genre}.json"
    songs = json.loads(songs_path.read_text())
    sourced_path = HERE / "out" / f"{genre}-sourced.json"
    sourced = json.loads(sourced_path.read_text()) if sourced_path.exists() else {}
    know = load_knowledge(genre)

    info_book = {}
    stats = {"sourced": 0, "knowledge_only": 0, "empty": 0, "confirmed_recordings": 0}
    for s in songs:
        src, k = sourced.get(s["id"], {}), know.get(s["id"], {})
        info, unverified = {}, []

        for field, src_field in (("composer", "composer"), ("lyricist", "lyricist"), ("year", "publishYear")):
            if src.get(src_field):
                info[field] = src[src_field]
            elif k.get(field):
                info[field] = k[field]
                unverified.append(field)
        if src.get("origin"):
            info["origin"], info["originKind"] = src["origin"], src.get("originKind", "show")
        elif k.get("origin"):
            info["origin"], info["originKind"] = k["origin"], k.get("originKind") or "show"
            unverified.append("origin")

        wp_recs = src.get("famousRecordings", [])

        def confirmed(r):
            for w in wp_recs:
                if same_artist(r["artist"], w["artist"]) and (not r.get("year") or not w.get("year") or abs(r["year"] - w["year"]) <= 1):
                    return True
            return False

        if k.get("firstRecording"):
            fr = dict(k["firstRecording"])
            if confirmed(fr):
                fr["confirmed"] = True
            else:
                unverified.append("firstRecording")
            info["firstRecording"] = fr

        famous = []
        for r in k.get("famous") or []:
            r = dict(r)
            if confirmed(r):
                r["confirmed"] = True
                stats["confirmed_recordings"] += 1
            famous.append(r)
        if not famous and wp_recs:  # nothing from the knowledge pass: take the article's list as is
            famous = [{**w, "confirmed": True} for w in wp_recs[:5]]
        if famous:
            info["famous"] = famous[:5]

        links = {k2: v for k2, v in src.get("sources", {}).items() if k2 in ("wikipedia", "wikidata")}
        if links:
            info["links"] = links
        if unverified:
            info["unverified"] = unverified

        if info:
            info_book[s["id"]] = info
            stats["sourced" if src else "knowledge_only"] += 1
        else:
            stats["empty"] += 1

        # credits for exports (the catalog carries the plain facts)
        for field, cat_field in (("composer", "composer"), ("lyricist", "lyricist"), ("year", "publishYear")):
            if info.get(field):
                s[cat_field] = info[field]
            else:
                s.pop(cat_field, None)

    out = ROOT / f"src/data/info/{genre}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(info_book, ensure_ascii=False, separators=(",", ":")))
    songs_path.write_text("[\n" + ",\n".join(json.dumps(s, ensure_ascii=False, separators=(",", ":")) for s in songs) + "\n]\n")
    print(f"{len(info_book)}/{len(songs)} tunes have info · with sources {stats['sourced']} · knowledge only {stats['knowledge_only']} · "
          f"none {stats['empty']} · recordings confirmed by Wikipedia {stats['confirmed_recordings']}")
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
