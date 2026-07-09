'use client';
/**
 * Public marketing landing page — original CE Board Master visual identity.
 *
 * Design language ("Blueprint & Steel"): deep blueprint navy + drafting-grid
 * backgrounds, structural SVG linework (truss bridge, loaded beam), amber
 * "safety" accent, drawing-sheet feature cards with sheet numbers. Inspired by
 * engineering drawings — deliberately NOT the pastel language-school look.
 *
 * Self-contained palette so it renders identically regardless of app theme.
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bot, Library, ArrowRight, CheckCircle2, BarChart3,
  BookOpenCheck, Sigma, FileText, ClipboardCheck, MapPin, Waves, Building2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { isAdminRole } from '@/lib/auth/types';

/** Hero authority metrics — the platform's real production counts. */
const HERO_STATS = [
  { value: '2,290+', label: 'Board Questions' },
  { value: '1,000', label: 'PRC Board Simulations' },
  { value: '2,378+', label: 'Engineering Figures' },
  { value: '1,600+', label: 'Formulas in the Handbook' },
];

/** Drawing-sheet feature cards — engineering disciplines + platform tools. */
const SHEETS = [
  { no: 'SHT-01', icon: ClipboardCheck, label: 'Board Simulations', body: 'Full 3-paper practice forms patterned after the PRC Day 1 / Day 2 structure.' },
  { no: 'SHT-02', icon: Library, label: 'Fundamentals Handbook', body: 'Formulas, constants, symbols, glossary, review sheets.' },
  { no: 'SHT-03', icon: Sigma, label: 'Formula Library', body: '1,600+ formulas with variables, units, and derivations.' },
  { no: 'SHT-04', icon: Building2, label: 'Structural Engineering', body: 'Analysis, RC & steel design, NSCP-aligned problems.' },
  { no: 'SHT-05', icon: Waves, label: 'Hydraulics & HGE', body: 'Fluid mechanics, geotech, water resources, environment.' },
  { no: 'SHT-06', icon: MapPin, label: 'Surveying & MSTE', body: 'Math, surveying, transportation, and economics drills.' },
  { no: 'SHT-07', icon: Bot, label: 'AI Tutor', body: 'Step-by-step solutions grounded in the knowledge base.' },
  { no: 'SHT-08', icon: BarChart3, label: 'Progress Analytics', body: 'Mastery, accuracy, and readiness — tracked per subject.' },
];

const PROOF = [
  'Thousands of board-quality engineering problems',
  'Complete Fundamentals Handbook',
  'Professional engineering illustrations on ~84% of items',
  'PRC-patterned board simulation experience',
  'AI-powered learning on every question',
];

const PLANS = [
  { name: 'Free', price: '₱0', period: 'forever', highlight: false, features: ['100 practice questions', '1 mock examination', 'AI Tutor starter', 'Handbook previews'] },
  { name: 'Premium Monthly', price: '₱199', period: 'per month', highlight: true, features: ['Unlimited questions & mock exams', '1,000 PRC board simulation forms', 'Unlimited AI Tutor', 'Full Fundamentals Handbook', 'Complete review mode & analytics'] },
  { name: 'Premium Quarterly', price: '₱499', period: 'per 3 months', highlight: false, features: ['Everything in Premium', 'Save ₱98 vs monthly'] },
  { name: 'Board Pass', price: '₱999', period: 'until exam day', highlight: false, features: ['Everything in Premium', 'Valid until the next PRC CE exam'] },
];

/** Blueprint drafting grid (major/minor lines) as a data-URI-free SVG pattern. */
function BlueprintGrid({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} width="100%" height="100%">
      <defs>
        <pattern id="grid-minor" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.12" />
        </pattern>
        <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.18" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-minor)" />
      <rect width="100%" height="100%" fill="url(#grid-major)" />
    </svg>
  );
}

/** Truss bridge silhouette — structural linework for the hero. */
function TrussBridge({ className }: { className?: string }) {
  const panels = 8, w = 900, h = 120, pw = w / panels;
  const nodes = Array.from({ length: panels + 1 }, (_, i) => i * pw);
  return (
    <svg aria-hidden viewBox={`0 0 ${w} 160`} className={className} fill="none" stroke="currentColor">
      {/* deck + top chord */}
      <line x1="0" y1="140" x2={w} y2="140" strokeWidth="3" />
      <line x1={pw} y1={140 - h} x2={w - pw} y2={140 - h} strokeWidth="2.5" />
      {/* verticals + diagonals */}
      {nodes.slice(1, -1).map((x) => (
        <line key={`v${x}`} x1={x} y1="140" x2={x} y2={140 - h} strokeWidth="1.5" />
      ))}
      {nodes.slice(0, -1).map((x, i) => (
        <line key={`d${x}`} x1={x} y1={i === 0 ? 140 : 140} x2={x + pw} y2={140 - h} strokeWidth="1.5" opacity={i === 0 || i === panels - 1 ? 1 : 0.8} />
      ))}
      {/* piers */}
      <line x1="0" y1="140" x2="0" y2="160" strokeWidth="3" />
      <line x1={w} y1="140" x2={w} y2="160" strokeWidth="3" />
    </svg>
  );
}

/** Simply-supported beam with UDL, reactions, and dimension line. */
function BeamDiagram({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 420 150" className={className} fill="none">
      {/* UDL arrows */}
      {Array.from({ length: 9 }, (_, i) => 60 + i * 37.5).map((x) => (
        <g key={x} stroke="#f59e0b" strokeWidth="1.5">
          <line x1={x} y1="20" x2={x} y2="48" />
          <path d={`M ${x - 4} 42 L ${x} 50 L ${x + 4} 42`} fill="#f59e0b" stroke="none" />
        </g>
      ))}
      <line x1="60" y1="20" x2="360" y2="20" stroke="#f59e0b" strokeWidth="1.5" />
      <text x="210" y="14" textAnchor="middle" fill="#f59e0b" fontSize="12" fontFamily="monospace">w = 12 kN/m</text>
      {/* beam */}
      <rect x="55" y="52" width="310" height="12" fill="#93c5fd" stroke="#60a5fa" />
      {/* pin + roller supports */}
      <path d="M 70 64 L 60 84 L 80 84 Z" fill="none" stroke="#93c5fd" strokeWidth="2" />
      <path d="M 350 64 L 340 84 L 360 84 Z" fill="none" stroke="#93c5fd" strokeWidth="2" />
      <circle cx="345" cy="90" r="3.5" stroke="#93c5fd" strokeWidth="1.5" />
      <circle cx="355" cy="90" r="3.5" stroke="#93c5fd" strokeWidth="1.5" />
      <line x1="52" y1="86" x2="88" y2="86" stroke="#93c5fd" strokeWidth="1.5" />
      {/* reactions */}
      <g stroke="#34d399" strokeWidth="2">
        <line x1="70" y1="128" x2="70" y2="100" />
        <path d="M 66 106 L 70 98 L 74 106" fill="#34d399" stroke="none" />
        <line x1="350" y1="128" x2="350" y2="100" />
        <path d="M 346 106 L 350 98 L 354 106" fill="#34d399" stroke="none" />
      </g>
      <text x="82" y="126" fill="#34d399" fontSize="12" fontFamily="monospace">R₁</text>
      <text x="362" y="126" fill="#34d399" fontSize="12" fontFamily="monospace">R₂</text>
      {/* dimension line */}
      <g stroke="#64748b" strokeWidth="1">
        <line x1="70" y1="140" x2="350" y2="140" />
        <line x1="70" y1="134" x2="70" y2="146" />
        <line x1="350" y1="134" x2="350" y2="146" />
      </g>
      <text x="210" y="137" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="monospace">L = 8 m</text>
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, status } = useAuthStore();

  useEffect(() => {
    if (status === 'authenticated') router.replace(isAdminRole(user?.role) ? '/admin' : '/dashboard');
  }, [status, user?.role, router]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0b1f3a]/95 text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="font-mono text-lg font-bold tracking-tight">
            <span className="text-amber-400">CE</span> BOARD MASTER
          </span>
          <div className="flex items-center gap-3">
            <a href="#pricing" className="hidden text-sm font-semibold text-slate-300 hover:text-white sm:block">Pricing</a>
            <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-white">Sign in</Link>
            <Link href="/register" className="rounded-md bg-amber-400 px-5 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-300">
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — blueprint canvas: drafting grid, truss linework, authority stats */}
      <section className="relative overflow-hidden bg-[#0b1f3a] text-white">
        <BlueprintGrid className="absolute inset-0 text-sky-300" />
        <TrussBridge className="absolute bottom-0 left-1/2 w-[1100px] -translate-x-1/2 text-sky-400/25" />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-28 pt-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 font-mono text-xs font-semibold tracking-widest text-sky-300">
              PRC CIVIL ENGINEERING BOARD EXAM · INDEPENDENT REVIEW PLATFORM
            </p>
            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Engineered to get you to
              <span className="block text-amber-400">RCE.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              The complete PRC CE preparation ecosystem — 2,290+ board questions,
              1,000 full board simulations, a Fundamentals Handbook, and an AI tutor
              grounded in the same engineering knowledge base.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-8 py-3.5 text-base font-bold text-slate-900 shadow-lg shadow-amber-400/20 transition-colors hover:bg-amber-300">
                Start free practice <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#sheets" className="inline-flex items-center gap-2 rounded-md border border-slate-500 px-8 py-3.5 text-base font-semibold text-slate-200 transition-colors hover:border-slate-300 hover:text-white">
                Explore the platform
              </a>
            </div>

            {/* Social proof — meaningful metrics, not review stars */}
            <ul className="mt-8 space-y-1.5">
              {PROOF.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Drawing-sheet panel: live beam diagram like our actual figures */}
          <div className="rounded-lg border border-sky-400/30 bg-[#0e2749]/90 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-400/20 pb-3 font-mono text-[11px] tracking-wider text-sky-300">
              <span>FIG. SOM.BEAM.UDL — SHEAR &amp; MOMENT</span>
              <span>SCALE NTS · REV 2</span>
            </div>
            <BeamDiagram className="mt-4 w-full" />
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-sky-400/20 pt-4 sm:grid-cols-4">
              {HERO_STATS.map((s) => (
                <div key={s.label} className="rounded bg-sky-400/5 p-3">
                  <p className="font-mono text-xl font-bold text-amber-400">{s.value}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Drawing-sheet feature grid */}
      <section id="sheets" className="relative bg-slate-50 py-20">
        <BlueprintGrid className="absolute inset-0 text-slate-400" />
        <div className="relative mx-auto max-w-6xl px-4">
          <p className="text-center font-mono text-xs font-semibold tracking-[0.3em] text-sky-700">DRAWING SET · CE BOARD MASTER</p>
          <h2 className="mt-3 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            One platform. Every discipline on the board.
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHEETS.map((s) => (
              <Link key={s.no} href="/register" className="group rounded-md border border-slate-300 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-600 hover:shadow-md">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 font-mono text-[10px] tracking-widest text-slate-400 group-hover:text-sky-700">
                  <span>{s.no}</span><span>A-SERIES</span>
                </div>
                <div className="p-5">
                  <s.icon className="h-7 w-7 text-[#0b1f3a]" />
                  <p className="mt-3 font-bold text-slate-900">{s.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Board simulations band */}
      <section className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.3em] text-amber-600">PRC BOARD SIMULATION LIBRARY</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">1,000 board simulation sets. Patterned after the PRC Day 1 / Day 2 structure.</h2>
            <p className="mt-4 text-slate-600">
              Every form is a fixed 150-item PRC-style examination: Day 1 Morning MSTE,
              Day 2 Morning PSSEC, Day 2 Afternoon HGE — with board-level difficulty
              pacing, wall-clock timing, resume-safe autosave, and a full engineering
              review mode after submission.
            </p>
            <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#0b1f3a] px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-[#123059]">
              Take a board simulation <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 font-mono text-center">
            {[
              { d: 'DAY 1 · AM', p: 'MSTE', pct: '35%' },
              { d: 'DAY 2 · AM', p: 'PSSEC', pct: '35%' },
              { d: 'DAY 2 · PM', p: 'HGE', pct: '30%' },
            ].map((x) => (
              <div key={x.p} className="rounded-md border border-slate-300 bg-slate-50 p-5">
                <p className="text-[10px] tracking-widest text-slate-400">{x.d}</p>
                <p className="mt-2 text-2xl font-bold text-[#0b1f3a]">{x.p}</p>
                <p className="mt-1 text-xs text-amber-600">{x.pct} of items</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Study system strip */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileText, t: 'Practice by discipline', b: 'Subject, topic, or a smart mix that targets weak spots.' },
            { icon: BookOpenCheck, t: 'Wrong-answer review', b: 'Every miss becomes a lesson with the full solution.' },
            { icon: Library, t: 'Handbook everywhere', b: 'Formulas linked from questions, reviews, and the AI tutor.' },
            { icon: Bot, t: 'AI tutor on every item', b: 'Step-by-step, alternative methods, common mistakes.' },
          ].map((f) => (
            <div key={f.t} className="rounded-md border border-slate-200 bg-white p-5">
              <f.icon className="mb-2 h-5 w-5 text-sky-700" />
              <p className="text-sm font-bold">{f.t}</p>
              <p className="mt-1 text-xs text-slate-600">{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center font-mono text-xs font-semibold tracking-[0.3em] text-sky-700">BILL OF QUANTITIES</p>
          <h2 className="mt-3 text-center text-3xl font-extrabold tracking-tight">Simple, review-season pricing</h2>
          <p className="mt-3 text-center text-slate-600">Start free. Upgrade when you&apos;re ready to go all in.</p>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.name} className={`flex flex-col rounded-md border bg-white p-6 shadow-sm ${p.highlight ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-200'}`}>
                {p.highlight ? <span className="mb-3 self-start rounded bg-amber-400 px-3 py-1 font-mono text-xs font-bold text-slate-900">MOST POPULAR</span> : null}
                <h3 className="text-base font-bold">{p.name}</h3>
                <p className="mt-2"><span className="font-mono text-3xl font-bold">{p.price}</span> <span className="text-sm text-slate-500">/ {p.period}</span></p>
                <ul className="mt-4 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`mt-6 rounded-md px-4 py-2.5 text-center text-sm font-bold transition-colors ${p.highlight ? 'bg-[#0b1f3a] text-white hover:bg-[#123059]' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  {p.name === 'Free' ? 'Start free' : 'Get started'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0b1f3a] py-10 text-slate-400">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs">
          <p className="font-mono font-bold text-slate-200"><span className="text-amber-400">CE</span> BOARD MASTER</p>
          <p className="mx-auto mt-2 max-w-2xl">
            CE Board Master is an independent review platform and is not affiliated with, endorsed by,
            or connected to the Professional Regulation Commission (PRC).
          </p>
          <p className="mt-3">© {new Date().getFullYear()} CE Board Master · <Link href="/login" className="hover:text-white">Sign in</Link> · <Link href="/register" className="hover:text-white">Create account</Link></p>
        </div>
      </footer>
    </div>
  );
}
