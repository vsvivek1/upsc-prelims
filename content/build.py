#!/usr/bin/env python3
"""Builds content/upsc_prelims.json from the subject files in content/src.

Teaching order (seq): topics follow their syllabus order and prerequisites within
a subject; subjects are interleaved so a day mixes subjects; within a topic, fact
and step cards come first and the summary last. Higher-frequency topics come
earlier within each subject.
"""
import importlib
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE / "src"))

SUBJECTS = ["polity", "economy", "environment", "history", "geography", "science", "csat"]

COURSE = {
    "id": "upsc",
    "title": {"en": "Algo UPSC — Prelims 2027", "hi": "एल्गो यूपीएससी — प्रारंभिक परीक्षा 2027"},
    "audience": "adult",
    "languages": ["en", "hi"],
    "exam": {
        "name": "UPSC Civil Services (Preliminary) Examination 2027",
        "date": "2027-05-23",
        "status": "official",
        "source": "https://upsc.gov.in/examinations/exam-calendar",
    },
}


def main():
    topics, cards, questions = [], [], []
    per_subject = []
    for name in SUBJECTS:
        try:
            mod = importlib.import_module(name)
        except ModuleNotFoundError:
            continue
        topics += mod.TOPICS
        questions += mod.QUESTIONS
        order = {t["id"]: i for i, t in enumerate(sorted(mod.TOPICS, key=lambda t: t["order"]))}
        rank = {"fact": 0, "steps": 1, "math": 1, "reasoning": 1, "diagram": 1, "summary": 9}
        sub_cards = sorted(mod.CARDS, key=lambda c: (order[c["topic"]], rank[c["type"]], c["id"]))
        per_subject.append(sub_cards)
        cards += sub_cards

    # Interleave subjects topic-block by topic-block so each day mixes subjects
    # but a topic's cards stay together and in order.
    blocks = []
    for sub_cards in per_subject:
        bl, cur = [], None
        for c in sub_cards:
            if c["topic"] != cur:
                bl.append([])
                cur = c["topic"]
            bl[-1].append(c)
        blocks.append(bl)
    seq, ordered = 1, []
    while any(blocks):
        for bl in blocks:
            if bl:
                for c in bl.pop(0):
                    c["seq"] = seq
                    seq += 1
                    ordered.append(c)

    # Renumber topic order globally to follow the interleaving.
    first_seq = {}
    for c in ordered:
        first_seq.setdefault(c["topic"], c["seq"])
    for t in topics:
        t["order"] = first_seq.get(t["id"], 10_000)
    topics.sort(key=lambda t: t["order"])

    pack = {"schema_version": "1.0", "course": COURSE, "topics": topics, "cards": ordered, "questions": questions}
    out = HERE / "upsc_prelims.json"
    out.write_text(json.dumps(pack, ensure_ascii=False, indent=1))
    print(f"wrote {out}: {len(topics)} topics, {len(ordered)} cards, {len(questions)} questions")


if __name__ == "__main__":
    main()
