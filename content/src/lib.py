"""Compact authoring helpers for the Algo UPSC content pack (schema 1.0).

Each subject file defines TOPICS, CARDS and QUESTIONS with these helpers;
content/build.py merges them, assigns the teaching order (seq) and writes
content/upsc_prelims.json. Every text is {"en": ..., "hi": ...}.
"""

PRACTICE = "Practice — exam pattern (not from a past paper)"


def T(en, hi):
    return {"en": en, "hi": hi}


def topic(id, subject, en, hi, order, freq, prereq=None):
    t = {"id": id, "subject": subject, "title": T(en, hi), "order": order, "freq": freq}
    if prereq:
        t["prereq"] = prereq
    return t


def fact(id, topic, difficulty, source, learn, why, recall_q, recall_a, simple, example=None, note=None):
    """learn/why/recall_q/recall_a/simple/example are (en, hi) tuples."""
    c = {
        "id": id, "topic": topic, "type": "fact", "difficulty": difficulty, "source": source,
        "status": "needs_review",
        "learn": T(*learn), "why": T(*why), "recall_q": T(*recall_q), "recall_a": T(*recall_a),
        "explain_simple": T(*simple),
    }
    if example:
        c["example"] = T(*example)
    if note:
        c["review_note"] = note
    return c


def summary(id, topic, source, title, points):
    return {
        "id": id, "topic": topic, "type": "summary", "difficulty": 1, "source": source, "status": "needs_review",
        "title": T(*title), "points": [T(*p) for p in points],
    }


def steps(id, topic, difficulty, source, title, step_list, summary_points, recall_q, recall_a):
    """step_list: [((en, hi), (explain_en, explain_hi) or None)]"""
    st = []
    for text, explain in step_list:
        s = {"text": T(*text)}
        if explain:
            s["explain"] = T(*explain)
        st.append(s)
    return {
        "id": id, "topic": topic, "type": "steps", "difficulty": difficulty, "source": source, "status": "needs_review",
        "title": T(*title), "steps": st, "summary": [T(*p) for p in summary_points],
        "recall_q": T(*recall_q), "recall_a": T(*recall_a),
    }


def math(id, topic, difficulty, source, exam_q, given, find, idea, theory, work, answer, practice, kind="math", note=None):
    """work: [((work_en, work_hi), (why_en, why_hi))]; practice: [((q), [(step)...], (answer))]"""
    c = {
        "id": id, "topic": topic, "type": kind, "difficulty": difficulty, "source": source, "status": "needs_review",
        "exam_q": T(*exam_q),
        "exam_note": T("A question like this can come in CSAT", "ऐसा प्रश्न सीसैट में आ सकता है"),
        "split": {"given": T(*given), "find": T(*find), "idea": T(*idea)},
        "theory": T(*theory),
        "steps": [{"work": T(*w), "why": T(*y)} for w, y in work],
        "answer": T(*answer),
        "practice": [{"q": T(*q), "steps": [T(*s) for s in ss], "answer": T(*a)} for q, ss, a in practice],
        "review_note": note or "confirm with past CSAT papers",
    }
    return c


def mcq(id, topic, q, options, answer, explain, covers, source=PRACTICE):
    return {
        "id": id, "topic": topic, "kind": "mcq", "q": T(*q), "options": [T(*o) for o in options],
        "answer": answer, "explain": T(*explain), "source": source, "covers": covers,
    }
