'use client';
/**
 * Public marketing landing page (CELTESTPIP-style: light, stat-led hero,
 * feature cards, pricing, strong CTAs). Authenticated users are forwarded to
 * their portal; visitors land here instead of being bounced to /login.
 *
 * Deliberately self-contained light palette (white/slate/blue utilities)
 * so it renders identically regardless of the app's dark theme tokens.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck, Bot, Library, ArrowRight, CheckCircle2, Timer, BarChart3,
  BookOpenCheck, Target, Sigma, Star,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { isAdminRole } from '@/lib/auth/types';

const STATS = [
  { value: '1,200+', label: 'Board-quality questions' },
  { value: '218', label: 'Mock examinations' },
  { value: '50', label: 'PRC board simulations' },
  { value: '990+', label: 'Engineering figures' },
];

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: 'PRC Board Simulations',
    body: 'Full three-paper simulations with the official MSTE / HGE / PSSEC distribution, real timing, board-level difficulty, autosave, and a premium review mode with complete engineering solutions.',
  },
  {
    icon: Bot,
    title: 'AI Tutor, grounded in the syllabus',
    body: 'Ask anything and get step-by-step solutions, alternative methods, and common-mistake warnings — grounded in the same knowledge base your questions come from, not generic internet answers.',
  },
  {
    icon: Library,
    title: 'Fundamentals Handbook',
    body: 'Your daily reference: 2,000+ formulas with variables and units, must-memorize shortlists, engineering constants and tables, symbol index, glossary, and printable review sheets.',
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
  { name: 'Premium Monthly', price: '₱199', period: 'per month', highlight: true, features: ['Unlimited questions & mock exams', 'All 50 PRC board simulations', 'Unlimited AI Tutor', 'Full Fundamentals Handbook', 'Complete review mode & analytics'] },
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
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight text-blue-700">CE Board Master</span>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#simulations" className="hover:text-slate-900">Board Simulations</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</Link>
            <Link href="/register" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center">
        <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700">
          <Star className="h-3.5 w-3.5 fill-blue-600 text-blue-600" /> Built for the Philippine Civil Engineering Board Exam
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Your fastest path to <span className="text-blue-600">passing the CE Board Exam</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Practice with 1,200+ board-quality questions, take real PRC-style board simulations,
          and study with an AI tutor grounded in the official syllabus.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-md transition-colors hover:bg-blue-700">
            Start my free practice <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#pricing" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-8 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50">
            See plans
          </a>
        </div>

        {/* Stats strip */}
        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-6 rounded-2xl border border-slate-100 bg-slate-50 p-8 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold text-blue-700">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section id="features" className="border-t border-slate-100 bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need to pass — in one platform</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <f.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECONDARY.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-100 p-5">
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
          <h2 className="text-3xl font-bold tracking-tight">50 PRC Board Simulations. Real structure. Real pressure.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-blue-100">
            Full three-paper simulations follow the official 35% MSTE / 30% HGE / 35% PSSEC distribution
            with board-level difficulty pacing — so exam day feels like just another practice run.
          </p>
          <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-blue-700 shadow-md transition-colors hover:bg-blue-50">
            Take a board simulation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight">Simple, review-season pricing</h2>
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
                <Link href="/register" className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors ${p.highlight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
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
