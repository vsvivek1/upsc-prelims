import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { Logo } from "@/components/Logo";

const steps = [
  {
    en: ["The app decides", "No syllabus maze. Algo UPSC picks every card from the official UPSC syllabus, most-asked topics first."],
    hi: ["ऐप तय करता है", "पाठ्यक्रम की भूलभुलैया नहीं। हर कार्ड आधिकारिक यूपीएससी पाठ्यक्रम से, सबसे ज़्यादा पूछे जाने वाले विषय पहले।"],
  },
  {
    en: ["One small card at a time", "A fact, its reason and an example. Ten cards a sitting, about six minutes."],
    hi: ["एक बार में एक छोटा कार्ड", "एक तथ्य, उसका कारण और एक उदाहरण। एक सत्र में दस कार्ड, लगभग छह मिनट।"],
  },
  {
    en: ["Your rating sets the next review", "Didn't get it · Tough · Understood · So simple. Hard cards come back sooner, easy ones much later."],
    hi: ["आपकी रेटिंग अगला दोहराव तय करती है", "समझ नहीं आया · कठिन · समझ गया · बहुत आसान। कठिन कार्ड जल्दी लौटते हैं, आसान बहुत बाद में।"],
  },
  {
    en: ["Planned back from 23 May 2027", "Daily quota, study-time alerts, a weekly report, and cram mode in the last two days."],
    hi: ["23 मई 2027 से पीछे की ओर योजना", "रोज़ का लक्ष्य, अध्ययन समय पर अलर्ट, साप्ताहिक रिपोर्ट, और आख़िरी दो दिन अंतिम दोहराव।"],
  },
];

const subjects = [
  "Indian Polity & Governance",
  "History & National Movement",
  "Indian & World Geography",
  "Economy & Social Development",
  "Environment & Ecology",
  "General Science & Technology",
  "Current events",
  "CSAT: reasoning & numeracy",
];

export default function Home() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <Link href="/study" className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper">
          Sign in · साइन इन
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-14 pt-8 sm:pt-16">
        <p className="mb-3 inline-block rounded-full bg-saffron-soft px-3 py-1 text-sm font-semibold text-saffron">
          UPSC Prelims 2027 · 23 May 2027
        </p>
        <h1 className="font-display max-w-3xl text-4xl leading-tight sm:text-6xl">
          Stop deciding what to study. <span className="text-saffron">Just study.</span>
        </h1>
        <p className="lang-hi mt-3 max-w-2xl text-xl text-ink-soft">क्या पढ़ें, यह सोचना बंद कीजिए। बस पढ़िए।</p>
        <p className="mt-6 max-w-2xl text-lg text-ink-soft">
          Algo UPSC is algorithmic learning for UPSC Prelims. A spaced-repetition engine plans every day back from the exam
          date and shows you one small card at a time, in English or Hindi.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/study" className="rounded-full bg-ink px-6 py-3 text-lg font-semibold text-paper shadow hover:bg-ink-soft">
            Start free — first 200 cards
          </Link>
          <span className="text-sm text-muted">No card needed to start</span>
        </div>
      </section>

      <section className="border-y border-line bg-card">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:grid-cols-2">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4">
              <div className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-lg text-paper">
                {i + 1}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{s.en[0]}</h2>
                <p className="text-ink-soft">{s.en[1]}</p>
                <p className="lang-hi mt-1 text-sm text-muted">
                  <strong className="font-semibold">{s.hi[0]}</strong> — {s.hi[1]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-display text-3xl">The whole Prelims syllabus</h2>
        <p className="mt-2 text-ink-soft">GS Paper I and CSAT Paper II, built from the official UPSC syllabus and the NCERT books it rests on.</p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {subjects.map((s) => (
            <li key={s} className="rounded-xl border border-line bg-card px-4 py-3">
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="rounded-3xl bg-ink p-8 text-paper sm:p-10">
          <h2 className="font-display text-3xl">Price</h2>
          <p className="mt-2 text-paper/80">Start free with the first 200 cards. Unlock the full course until Prelims 2027.</p>
          <div className="mt-6 flex flex-wrap items-end gap-4">
            <span className="text-2xl text-paper/50 line-through">₹10,000</span>
            <span className="font-display text-5xl text-saffron">₹3,000</span>
            <span className="pb-2 text-sm text-paper/70">Introductory offer · incl. 18% GST · GST invoice</span>
          </div>
          <Link href="/study" className="mt-8 inline-block rounded-full bg-saffron px-6 py-3 font-semibold text-ink hover:brightness-105">
            Start free
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
