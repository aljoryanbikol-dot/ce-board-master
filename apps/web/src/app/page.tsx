'use client';
/**
 * Public marketing landing page — CELTESTPIP-style visual language
 * (soft gradient + floating dots, oversized type with a green italic accent,
 * pastel icon category tiles, "Proven & trusted" stat cards, alternating
 * feature sections with mint CTAs) with Civil Engineering content.
 *
 * Deliberately self-contained light palette (white/slate/blue utilities)
 * so it renders identically regardless of the app's dark theme tokens.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck, Bot, Library, ArrowRight, CheckCircle2, Timer, BarChart3,
  BookOpenCheck, Target, Sigma, Dumbbell, FileText, CalendarDays,
  Gauge, ListChecks,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { isAdminRole } from '@/lib/auth/types';

/** Pastel category tiles (CELTESTPIP-style icon grid), CE-flavored. */
const CATEGORIES = [
  { icon: Dumbbell, label: 'Practice', tint: 'bg-emerald-100 text-emerald-600' },
  { icon: FileText, label: 'Mock Tests', tint: 'bg-sky-100 text-sky-600' },
  { icon: CalendarDays, label: 'Board Simulations', tint: 'bg-amber-100 text-amber-600' },
  { icon: Target, label: 'Topic Drills', tint: 'bg-rose-100 text-rose-600' },
  { icon: Library, label: 'Fundamentals Handbook', tint: 'bg-violet-100 text-violet-600' },
  { icon: Sigma, label: 'Formula Library', tint: 'bg-teal-100 text-teal-600' },
  { icon: Bot, label: 'AI Tutor', tint: 'bg-indigo-100 text-indigo-600' },
  { icon: BarChart3, label: 'Analytics', tint: 'bg-orange-100 text-orange-600' },
];

/** Deterministic pastel initials for the social-proof avatar strip. */
const AVATARS = [
  { initials: 'JR', bg: 'bg-rose-400' }, { initials: 'MA', bg: 'bg-amber-400' },
  { initials: 'KC', bg: 'bg-emerald-400' }, { initials: 'DL', bg: 'bg-sky-400' },
  { initials: 'PS', bg: 'bg-violet-400' }, { initials: 'RB', bg: 'bg-teal-400' },
];

const STATS = [
  { icon: BookOpenCheck, value: '1,900+', label: 'Board-quality questions', tint: 'bg-sky-100 text-sky-600' },
  { icon: ListChecks, value: '1,000', label: 'PRC board simulation forms', tint: 'bg-amber-100 text-amber-500' },
  { icon: Gauge, value: '218', label: 'Mock examinations', tint: 'bg-emerald-100 text-emerald-600' },
  { icon: Sigma, value: '1,600+', label: 'Engineering figures & diagrams', tint: 'bg-violet-100 text-violet-600' },
];

/** Alternating feature sections (pill badge + italic accent + mint CTA). */
const FEATURES = [
  {
    pill: 'BOARD SIMULATIONS', pillTint: 'bg-rose-50 text-rose-600',
    title: <>Practice that feels just like the <span className="italic text-blue-600">real board</span></>,
    body: 'Take full three-paper PRC simulations with the official MSTE / HGE / PSSEC day-and-session structure, real timing, board-level difficulty, and resume-safe autosave. Walk into exam day feeling ready, not nervous.',
    cta: 'Try Board Simulations',
    icon: ClipboardCheck, tint: 'bg-rose-100 text-rose-500',
  },
  {
    pill: 'AI TUTOR', pillTint: 'bg-blue-50 text-blue-600',
    title: <>AI feedback that feels like a <span className="italic text-blue-600">real tutor</span></>,
    body: 'Ask anything and get step-by-step solutions, alternative methods, and common-mistake warnings — grounded in the same knowledge base your questions come from, not generic internet answers.',
    cta: 'Try the AI Tutor',
    icon: Bot, tint: 'bg-indigo-100 text-indigo-500',
  },
  {
    pill: 'EXPLANATIONS', pillTint: 'bg-violet-50 text-violet-600',
    title: <>Detailed solutions that make you <span className="italic text-blue-600">smarter</span></>,
    body: 'See why every answer is right or wrong with complete engineering solutions, linked formulas from the Fundamentals Handbook, board tips, and the exact mistakes reviewees usually make.',
    cta: 'Try Practice Questions',
    icon: Library, tint: 'bg-violet-100 text-violet-500',
  },
];

const SECONDARY = [
  { icon: Target, title: 'Practice that adapts', body: 'By subject, by topic, or a smart mix that targets your weak spots.' },
  { icon: BookOpenCheck, title: 'Wrong-answer review', body: 'Every miss becomes a lesson — filtered history with full solutions.' },
  { icon: BarChart3, title: 'Readiness analytics', body: 'Subject mastery, accuracy, and solving-time trends at a glance.' },
  { icon: Timer, title: 'Real exam conditions', body: 'Wall-clock timers, randomized questions, resume-safe autosave.' },
];

const PLANS = [
  { name: 'Free', price: '₱0', period: 'forever', highlight: false, features: ['100 practice questions', '1 mock examination', 'AI Tutor starter', 'Handbook previews'] },
  { name: 'Premium Monthly', price: '₱199', period: 'per month', highlight: true, features: ['Unlimited questions & mock exams', '1,000 PRC board simulation forms', 'Unlimited AI Tutor', 'Full Fundamentals Handbook', 'Complete review mode & analytics'] },
  { name: 'Premium Quarterly', price: '₱499', period: 'per 3 months', highlight: false, features: ['Everything in Premium', 'Save ₱98 vs monthly'] },
  { name: 'Board Pass', price: '₱999', period: 'until exam day', highlight: false, features: ['Everything in Premium', 'Valid until the next PRC CE exam'] },
];

export default function HomePage() {
  const router = useRouter();
  const { user, status } = useAuthStore();

  useEffect(() => {
    if (status === 'authenticated') router.replace(isAdminRole(user?.role) ? '/admin' : '/dashboard');
  }, [status, user?.role, router]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-slate-900">CE</span> <span className="text-blue-600">BOARD</span> <span className="text-slate-900">MASTER</span>
          </span>
          <div className="flex items-center gap-3">
            <a href="#pricing" className="rounded-full bg-emerald-200 px-5 py-2 text-sm font-bold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-300">
              Pricing
            </a>
            <Link href="/login" className="hidden text-sm font-semibold text-slate-600 hover:text-slate-900 sm:block">Sign in</Link>
            <Link href="/register" className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700">
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — soft gradient canvas with floating dots, oversized type,
          green italic accent, avatar social proof, pastel category grid. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-white to-sky-100">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="absolute left-[8%] top-24 h-3 w-3 rounded-full bg-white shadow" />
          <span className="absolute left-[20%] top-64 h-2 w-2 rounded-full bg-white shadow" />
          <span className="absolute right-[12%] top-16 h-3 w-3 rounded-full bg-white shadow" />
          <span className="absolute right-[22%] top-72 h-2 w-2 rounded-full bg-white shadow" />
          <span className="absolute left-[45%] top-10 h-2 w-2 rounded-full bg-white shadow" />
          <span className="absolute bottom-24 left-[15%] h-2 w-2 rounded-full bg-white shadow" />
          <span className="absolute bottom-32 right-[18%] h-3 w-3 rounded-full bg-white shadow" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center">
          <p className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <span className="tracking-tight text-amber-400">★★★★★</span> Built for the PRC CE Board Exam
          </p>

          <h1 className="mx-auto max-w-4xl text-5xl font-black leading-[1.08] tracking-tight sm:text-7xl">
            Your Fastest Path
            <br />
            to a <span className="italic text-emerald-600 underline decoration-emerald-300 decoration-[6px] underline-offset-8">Passed</span> <span className="text-blue-600">CE Board</span> Exam
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-600">
            Practice with 1,900+ real board-quality CE questions and 1,000 full PRC board
            simulations. Instant solutions and AI tutoring on every item.
          </p>

          <div className="mt-9">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700">
              Start My <span className="font-black">Free Practice</span> <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          {/* Avatar strip social proof */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <div className="flex -space-x-2.5">
              {AVATARS.map((a) => (
                <span key={a.initials} className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white ${a.bg}`}>
                  {a.initials}
                </span>
              ))}
            </div>
            <p className="text-sm text-slate-600">Trusted by <span className="font-bold text-slate-900">future Civil Engineers</span> across the Philippines</p>
          </div>

          {/* Pastel category tiles */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <Link key={c.label} href="/register" className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${c.tint}`}>
                  <c.icon className="h-7 w-7" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-800">{c.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Proven & trusted — stat cards */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="text-3xl font-medium italic tracking-tight text-slate-400 sm:text-4xl">Proven &amp; trusted</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">CE board review platform</h2>
          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${s.tint}`}>
                  <s.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-4xl font-extrabold tracking-tight">{s.value}</p>
                <p className="mt-1 text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Alternating feature sections */}
      <section id="features" className="bg-white pb-8">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold tracking-wide text-slate-600">
            ✦ AI-POWERED REVIEW
          </p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Everything you need to <span className="italic text-blue-600">crack</span> the real board
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Three things you need for faster, smarter CE board prep: board simulations,
            an AI tutor, and clear engineering solutions.
          </p>
        </div>

        <div className="mx-auto max-w-6xl space-y-20 px-4 py-16">
          {FEATURES.map((f, i) => (
            <div key={f.pill} className={`flex flex-col items-center gap-10 lg:flex-row ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
              <div className="flex-1 text-center lg:text-left">
                <span className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide ${f.pillTint}`}>
                  ✦ {f.pill}
                </span>
                <h3 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">{f.title}</h3>
                <p className="mt-4 text-slate-500">{f.body}</p>
                <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-6 py-3 text-sm font-bold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-300">
                  {f.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className={`flex h-64 w-full flex-1 items-center justify-center rounded-3xl bg-gradient-to-br ${i === 0 ? 'from-emerald-100 via-sky-50 to-blue-100' : i === 1 ? 'from-rose-100 via-white to-sky-100' : 'from-amber-100 via-white to-rose-100'}`}>
                <span className={`flex h-24 w-24 items-center justify-center rounded-3xl shadow-md ${f.tint}`}>
                  <f.icon className="h-12 w-12" />
                </span>
              </div>
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECONDARY.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-100 p-5">
                <f.icon className="mb-2 h-5 w-5 text-blue-600" />
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="mt-1 text-xs text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Board simulations banner */}
      <section id="simulations" className="bg-gradient-to-br from-blue-700 to-blue-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <Sigma className="mx-auto mb-4 h-8 w-8 text-blue-300" />
          <h2 className="text-3xl font-extrabold tracking-tight">1,000 PRC Board Simulation Forms. Real structure. Real pressure.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-blue-100">
            Full three-paper simulations follow the official Day 1 MSTE / Day 2 HGE + PSSEC
            structure with board-level difficulty pacing — so exam day feels like just another practice run.
          </p>
          <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-bold text-blue-700 shadow-md transition-colors hover:bg-blue-50">
            Take a board simulation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">Simple, review-season pricing</h2>
          <p className="mt-3 text-center text-slate-600">Start free. Upgrade when you&apos;re ready to go all in.</p>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${p.highlight ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-100'}`}>
                {p.highlight ? <span className="mb-3 self-start rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span> : null}
                <h3 className="text-base font-semibold">{p.name}</h3>
                <p className="mt-2"><span className="text-3xl font-extrabold">{p.price}</span> <span className="text-sm text-slate-500">/ {p.period}</span></p>
                <ul className="mt-4 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`mt-6 rounded-xl px-4 py-2.5 text-center text-sm font-bold transition-colors ${p.highlight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  {p.name === 'Free' ? 'Start free' : 'Get started'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700">CE Board Master</p>
          <p className="mx-auto mt-2 max-w-2xl">
            CE Board Master is an independent review platform and is not affiliated with, endorsed by,
            or connected to the Professional Regulation Commission (PRC).
          </p>
          <p className="mt-3">© {new Date().getFullYear()} CE Board Master · <Link href="/login" className="hover:text-slate-700">Sign in</Link> · <Link href="/register" className="hover:text-slate-700">Create account</Link></p>
        </div>
      </footer>
    </div>
  );
}
