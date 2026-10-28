#!/usr/bin/env python3
"""Check a Recallio content pack before upload.

Usage:
    python validate_pack.py PACK.json            # human-readable report
    python validate_pack.py PACK.json --json     # machine-readable result
    python validate_pack.py PACK.json --fill OUT.json
                                                 # also write a copy with minimum
                                                 # times and estimates filled in

Checks: structure, ids and references, every language filled, word limits,
sources for fact-checking, maths and diagram completeness, that every question
is covered by lesson cards, and that no exam question was pasted in as a lesson.
Errors must be fixed (exit code 1). Warnings should be read.
"""
import argparse
import collections
import copy
import datetime as dt
import json
import re
import sys

CARD_TYPES = {"fact", "steps", "math", "reasoning", "diagram", "summary"}
AUDIENCES = {"child", "adult"}
EXAM_STATUS = {"official", "estimated"}
STATUSES = {"draft", "needs_review", "reviewed"}
# Word limits per audience: warn above the limit, error above 1.5x.
LIMITS = {
    "child": {"learn": 25, "step": 40, "point": 15, "explain": 60},
    "adult": {"learn": 35, "step": 50, "point": 18, "explain": 80},
}
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_.\-]*$")
PATH_RE = re.compile(r"^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-eE]+$")


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, where, msg):
        self.errors.append(f"{where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"{where}: {msg}")


def txt(value, lang):
    """The string for one language of a text object, or ''."""
    if isinstance(value, dict) and isinstance(value.get(lang), str):
        return value[lang]
    return ""


def tw(value, lang):
    """Word count of a text object in one language."""
    return len(txt(value, lang).split())


def is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def is_int(x):
    return isinstance(x, int) and not isinstance(x, bool)


def as_list(x):
    return x if isinstance(x, list) else []


def as_dict(x):
    return x if isinstance(x, dict) else {}


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def check_text(rep, where, value, langs, required=True):
    if value is None:
        if required:
            rep.err(where, "missing text")
        return
    if not isinstance(value, dict):
        rep.err(where, 'text must be an object like {"ml": "...", "en": "..."}')
        return
    for lang in langs:
        if not txt(value, lang).strip():
            rep.err(where, f"missing '{lang}' text")
    extra = set(value) - set(langs)
    if extra:
        rep.warn(where, f"languages not in the course: {sorted(extra)}")


def check_limit(rep, where, value, langs, limit, label):
    for lang in langs:
        n = tw(value, lang)
        if n > limit * 1.5:
            rep.err(where, f"{label} is {n} words in '{lang}' (limit {limit}) — split it")
        elif n > limit:
            rep.warn(where, f"{label} is {n} words in '{lang}' (aim for {limit} or fewer)")


def check_text_list(rep, where, items, langs, lo, hi, limit=None, label="point"):
    if not isinstance(items, list) or not lo <= len(items) <= hi:
        rep.err(where, f"needs {lo}-{hi} items")
        return
    for i, item in enumerate(items, 1):
        check_text(rep, f"{where}[{i}]", item, langs)
        if limit:
            check_limit(rep, f"{where}[{i}]", item, langs, limit, label)


def check_min_seconds(rep, where, obj):
    if "min_seconds" in obj:
        m = obj["min_seconds"]
        if not is_int(m) or not 3 <= m <= 120:
            rep.err(where, "min_seconds must be a whole number from 3 to 120")


# ---------- minimum time (mirrors learning-engine.md section 2) ----------

def time_factor(audience, lang):
    f = 1.3 if lang == "ml" else 1.0
    return f * (1.1 if audience == "child" else 1.0)


def fill_times(card, audience, lang):
    """Fill missing min_seconds in place; return estimated seconds for a first pass."""
    f = time_factor(audience, lang)
    t = card.get("type")
    if t == "fact":
        n = tw(card.get("learn"), lang) + tw(card.get("why"), lang) + tw(card.get("example"), lang)
        card.setdefault("min_seconds", int(clamp(round((n / 2 + 2) * f), 5, 25)))
        return card["min_seconds"] + 6
    if t == "summary":
        n = sum(tw(p, lang) for p in as_list(card.get("points")))
        card.setdefault("min_seconds", int(clamp(round(n / 2 * f), 8, 30)))
        return card["min_seconds"] + 6
    if t == "steps":
        total = 10
        for s in as_list(card.get("steps")):
            s.setdefault("min_seconds", int(clamp(round((tw(s.get("text"), lang) / 2 + 3) * f), 6, 30)))
            total += s["min_seconds"]
        n = sum(tw(p, lang) for p in as_list(card.get("summary")))
        return total + int(clamp(round(n / 2 * f), 8, 30))
    if t in ("math", "reasoning"):
        n = tw(card.get("exam_q"), lang) + tw(card.get("theory"), lang)
        total = int(clamp(round(n / 2 * f), 8, 40)) + 15
        for s in as_list(card.get("steps")):
            w = tw(s.get("work"), lang) + tw(s.get("why"), lang)
            s.setdefault("min_seconds", int(clamp(round((w / 2 + 6) * f), 8, 40)))
            total += s["min_seconds"]
        return total + (90 if card.get("practice") else 0)
    if t == "diagram":
        total = 30
        for s in as_list(card.get("steps")):
            s.setdefault("min_seconds", 20)
            total += s["min_seconds"]
        return total
    return 10


# ---------- card and question checks ----------

def check_card(rep, c, langs, audience, topic_ids):
    cid = c.get("id")
    where = f"card {cid or '?'}"
    if not isinstance(cid, str) or not ID_RE.match(cid):
        rep.err(where, "bad or missing id (lowercase letters, digits, . _ -)")
    if c.get("topic") not in topic_ids:
        rep.err(where, f"unknown topic '{c.get('topic')}'")
    t = c.get("type")
    if t not in CARD_TYPES:
        rep.err(where, f"unknown type '{t}'")
        return
    d = c.get("difficulty")
    if not is_int(d) or not 1 <= d <= 5:
        rep.err(where, "difficulty must be 1-5")
    if not isinstance(c.get("source"), str) or not c["source"].strip():
        rep.err(where, "missing source (book/chapter/page or syllabus line) — needed for fact-checking")
    if c.get("status", "draft") not in STATUSES:
        rep.err(where, f"status must be one of {sorted(STATUSES)}")
    if "freq" in c and not (is_num(c["freq"]) and 0 <= c["freq"] <= 1):
        rep.err(where, "freq must be between 0 and 1")
    check_min_seconds(rep, where, c)
    L = LIMITS[audience]

    if t == "fact":
        for k in ("learn", "why", "recall_q", "recall_a", "explain_simple"):
            check_text(rep, f"{where}.{k}", c.get(k), langs)
        check_text(rep, f"{where}.example", c.get("example"), langs, required=False)
        check_limit(rep, f"{where}.learn", c.get("learn"), langs, L["learn"], "key line")
        check_limit(rep, f"{where}.explain_simple", c.get("explain_simple"), langs, L["explain"], "explanation")

    elif t == "steps":
        for k in ("title", "recall_q", "recall_a"):
            check_text(rep, f"{where}.{k}", c.get(k), langs)
        steps = c.get("steps")
        if not isinstance(steps, list) or len(steps) < 2:
            rep.err(where, "a steps card needs at least 2 steps")
        else:
            if len(steps) > 7:
                rep.warn(where, f"{len(steps)} steps — split into part cards of 7 or fewer")
            for i, s in enumerate(steps, 1):
                sw = f"{where}.steps[{i}]"
                s = as_dict(s)
                check_text(rep, f"{sw}.text", s.get("text"), langs)
                check_text(rep, f"{sw}.explain", s.get("explain"), langs, required=False)
                check_limit(rep, f"{sw}.text", s.get("text"), langs, L["step"], "step")
                check_min_seconds(rep, sw, s)
        check_text_list(rep, f"{where}.summary", c.get("summary"), langs, 2, 5, L["point"])

    elif t in ("math", "reasoning"):
        for k in ("exam_q", "theory", "answer"):
            check_text(rep, f"{where}.{k}", c.get(k), langs)
        check_text(rep, f"{where}.exam_note", c.get("exam_note"), langs, required=False)
        split = c.get("split")
        if not isinstance(split, dict):
            rep.err(where, "split {given, find, idea} is missing")
        else:
            for k in ("given", "find", "idea"):
                check_text(rep, f"{where}.split.{k}", split.get(k), langs)
        steps = c.get("steps")
        if not isinstance(steps, list) or len(steps) < 2:
            rep.err(where, "needs at least 2 steps")
        else:
            for i, s in enumerate(steps, 1):
                sw = f"{where}.steps[{i}]"
                s = as_dict(s)
                check_text(rep, f"{sw}.work", s.get("work"), langs)
                check_text(rep, f"{sw}.why", s.get("why"), langs)
                check_min_seconds(rep, sw, s)
        practice = c.get("practice")
        if not isinstance(practice, list) or not practice:
            rep.err(where, "needs at least 1 practice question")
        else:
            for i, p in enumerate(practice, 1):
                pw = f"{where}.practice[{i}]"
                p = as_dict(p)
                check_text(rep, f"{pw}.q", p.get("q"), langs)
                check_text(rep, f"{pw}.answer", p.get("answer"), langs)
                check_text_list(rep, f"{pw}.steps", p.get("steps"), langs, 1, 10)

    elif t == "diagram":
        for k in ("title", "recall_prompt"):
            check_text(rep, f"{where}.{k}", c.get(k), langs)
        canvas = as_dict(c.get("canvas"))
        w, h = canvas.get("w"), canvas.get("h")
        if not (is_num(w) and is_num(h) and w > 0 and h > 0):
            rep.err(where, "canvas {w, h} must be positive numbers")
            w = h = None
        steps = c.get("steps")
        if not isinstance(steps, list) or len(steps) < 2:
            rep.err(where, "a diagram needs at least 2 steps")
        else:
            for i, s in enumerate(steps, 1):
                sw = f"{where}.steps[{i}]"
                s = as_dict(s)
                check_text(rep, f"{sw}.say", s.get("say"), langs)
                paths, labels = as_list(s.get("paths")), as_list(s.get("labels"))
                if not paths and not labels:
                    rep.err(sw, "each step needs paths or labels")
                for p in paths:
                    if not isinstance(p, str) or not p.strip() or not PATH_RE.match(p) or p.strip()[0] not in "Mm":
                        rep.err(sw, f"not valid SVG path data: {str(p)[:40]}")
                for j, lb in enumerate(labels, 1):
                    lb = as_dict(lb)
                    check_text(rep, f"{sw}.labels[{j}].text", lb.get("text"), langs)
                    x, y = lb.get("x"), lb.get("y")
                    if not (is_num(x) and is_num(y)):
                        rep.err(f"{sw}.labels[{j}]", "x and y must be numbers")
                    elif w and h and not (0 <= x <= w and 0 <= y <= h):
                        rep.err(f"{sw}.labels[{j}]", "label is outside the canvas")
                check_min_seconds(rep, sw, s)
        check_text_list(rep, f"{where}.key_parts", c.get("key_parts"), langs, 1, 12)

    elif t == "summary":
        check_text(rep, f"{where}.title", c.get("title"), langs)
        check_text_list(rep, f"{where}.points", c.get("points"), langs, 2, 5, L["point"])


def check_question(rep, q, langs, topic_ids, card_ids):
    qid = q.get("id")
    where = f"question {qid or '?'}"
    if not isinstance(qid, str) or not ID_RE.match(qid):
        rep.err(where, "bad or missing id")
    if q.get("topic") not in topic_ids:
        rep.err(where, f"unknown topic '{q.get('topic')}'")
    if q.get("kind", "mcq") != "mcq":
        rep.err(where, "only kind 'mcq' is supported")
    check_text(rep, f"{where}.q", q.get("q"), langs)
    check_text(rep, f"{where}.explain", q.get("explain"), langs)
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        rep.err(where, "needs exactly 4 options")
        opts = as_list(opts)
    for i, o in enumerate(opts, 1):
        check_text(rep, f"{where}.options[{i}]", o, langs)
    for lang in langs:
        seen = [txt(o, lang).strip().lower() for o in opts]
        if len(seen) != len(set(seen)):
            rep.err(where, f"two options are the same in '{lang}'")
    a = q.get("answer")
    if not is_int(a) or not 0 <= a < max(1, len(opts)):
        rep.err(where, "answer must be the index (0-3) of the right option")
    if not isinstance(q.get("source"), str) or not q["source"].strip():
        rep.err(where, "missing source (paper and year, or 'Practice — exam pattern')")
    cov = q.get("covers")
    if not isinstance(cov, list) or not cov:
        rep.err(where, "covers must list the card ids that teach this question's facts")
    else:
        for x in cov:
            if x not in card_ids:
                rep.err(where, f"covers unknown card '{x}'")


def tokens(s):
    return set(re.findall(r"\w+", s.lower()))


def copied_question_check(rep, cards, questions, langs):
    """Warn when a lesson card's text looks like a pasted exam question."""
    flagged = set()
    for q in questions:
        for lang in langs:
            qt = tokens(txt(q.get("q"), lang))
            if len(qt) < 6:
                continue
            for c in cards:
                if c.get("type") == "fact":
                    texts = [c.get("learn")]
                elif c.get("type") == "steps":
                    texts = [as_dict(s).get("text") for s in as_list(c.get("steps"))]
                else:
                    continue
                for t in texts:
                    ct = tokens(txt(t, lang))
                    pair = (c.get("id"), q.get("id"))
                    if ct and pair not in flagged and len(qt & ct) / len(qt | ct) >= 0.8:
                        flagged.add(pair)
                        rep.warn(f"card {c.get('id')}",
                                 f"looks like question {q.get('id')} pasted as a lesson — teach the underlying fact instead")


def validate(pack):
    rep = Report()
    if not isinstance(pack, dict):
        rep.err("pack", "the file must hold one JSON object")
        return rep, {}, None
    if pack.get("schema_version") != "1.0":
        rep.err("pack", 'schema_version must be "1.0"')
    course = as_dict(pack.get("course"))
    langs = course.get("languages")
    if not isinstance(langs, list) or not langs or not all(isinstance(x, str) for x in langs):
        rep.err("course", 'languages must be a list like ["ml", "en"]')
        langs = ["en"]
    audience = course.get("audience")
    if audience not in AUDIENCES:
        rep.err("course", "audience must be 'child' or 'adult'")
        audience = "child"
    cid = course.get("id")
    if not isinstance(cid, str) or not re.match(r"^[a-z][a-z0-9_]*$", cid):
        rep.err("course", "id must be a lowercase slug (it becomes the Supabase schema name)")
    check_text(rep, "course.title", course.get("title"), langs)
    exam = as_dict(course.get("exam"))
    try:
        if dt.date.fromisoformat(str(exam.get("date", ""))) < dt.date.today():
            rep.warn("course.exam", "exam date is in the past — update it")
    except ValueError:
        rep.err("course.exam", "date must be YYYY-MM-DD")
    if exam.get("status") not in EXAM_STATUS:
        rep.err("course.exam", "status must be 'official' or 'estimated'")
    if not exam.get("source"):
        rep.warn("course.exam", "add the official source link for the exam date")

    topics = [as_dict(t) for t in as_list(pack.get("topics"))]
    cards = [as_dict(c) for c in as_list(pack.get("cards"))]
    questions = [as_dict(q) for q in as_list(pack.get("questions"))]
    counts = collections.Counter(x.get("id") for x in topics + cards + questions if isinstance(x.get("id"), str))
    for dup in sorted(i for i, n in counts.items() if n > 1):
        rep.err("pack", f"duplicate id '{dup}'")

    topic_ids = set()
    for t in topics:
        tid = t.get("id")
        where = f"topic {tid or '?'}"
        if not isinstance(tid, str) or not ID_RE.match(tid):
            rep.err(where, "bad or missing id")
        else:
            topic_ids.add(tid)
        check_text(rep, f"{where}.title", t.get("title"), langs)
        if "freq" in t and not (is_num(t["freq"]) and 0 <= t["freq"] <= 1):
            rep.err(where, "freq must be between 0 and 1")
    for t in topics:
        for p in as_list(t.get("prereq")):
            if p not in topic_ids:
                rep.err(f"topic {t.get('id')}", f"unknown prereq '{p}'")

    card_ids = {c.get("id") for c in cards if isinstance(c.get("id"), str)}
    for c in cards:
        check_card(rep, c, langs, audience, topic_ids)
    for q in questions:
        check_question(rep, q, langs, topic_ids, card_ids)
    copied_question_check(rep, cards, questions, langs)

    for tid in sorted(topic_ids - {c.get("topic") for c in cards}):
        rep.warn(f"topic {tid}", "has no cards yet")
    if not questions:
        rep.warn("pack", "no test questions — add past/model paper questions with 'covers'")

    filled, minutes = None, None
    if not rep.errors:
        filled = copy.deepcopy(pack)
        total = 0
        for c in filled.get("cards", []):
            c["est_seconds"] = fill_times(c, audience, langs[0])
            total += c["est_seconds"]
        minutes = round(total / 60, 1)

    covered = {x for q in questions for x in as_list(q.get("covers"))}
    stats = {
        "course": cid,
        "topics": len(topics),
        "cards": len(cards),
        "cards_by_type": dict(collections.Counter(str(c.get("type")) for c in cards)),
        "questions": len(questions),
        "cards_tested_by_questions": len(covered & card_ids),
        "needs_review": sum(1 for c in cards if c.get("status") == "needs_review"),
        "first_pass_minutes": minutes,
    }
    return rep, stats, filled


def main():
    ap = argparse.ArgumentParser(description="Check a Recallio content pack.")
    ap.add_argument("pack")
    ap.add_argument("--json", action="store_true", help="print a JSON result")
    ap.add_argument("--fill", metavar="OUT", help="write a copy with min_seconds and est_seconds filled in")
    args = ap.parse_args()
    try:
        with open(args.pack, encoding="utf-8") as f:
            pack = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"Cannot read pack: {e}")
        sys.exit(1)

    rep, stats, filled = validate(pack)
    ok = not rep.errors
    if args.fill and filled is not None:
        with open(args.fill, "w", encoding="utf-8") as f:
            json.dump(filled, f, ensure_ascii=False, indent=2)

    if args.json:
        print(json.dumps({"ok": ok, "errors": rep.errors, "warnings": rep.warnings, "stats": stats},
                         ensure_ascii=False, indent=2))
    else:
        types = ", ".join(f"{k} {v}" for k, v in sorted(stats.get("cards_by_type", {}).items()))
        minutes = stats.get("first_pass_minutes")
        print(f"Recallio pack check: {stats.get('course')}")
        print(f"  topics {stats.get('topics', 0)} · cards {stats.get('cards', 0)} ({types})"
              f" · questions {stats.get('questions', 0)}")
        print(f"  cards tested by questions: {stats.get('cards_tested_by_questions', 0)}/{stats.get('cards', 0)}"
              f" · needs review: {stats.get('needs_review', 0)}"
              f" · first pass ≈ {minutes if minutes is not None else 'n/a'} min")
        print(f"ERRORS ({len(rep.errors)})")
        for e in rep.errors:
            print(f"  - {e}")
        print(f"WARNINGS ({len(rep.warnings)})")
        for w in rep.warnings:
            print(f"  - {w}")
        print("RESULT: " + ("PASS" if ok else "FAIL — fix the errors above"))
        if args.fill:
            print(f"Filled copy: {args.fill}" if ok else "Filled copy not written (fix errors first).")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
