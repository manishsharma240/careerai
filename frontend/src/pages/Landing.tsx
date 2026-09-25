import { Link } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import { Card } from '../components/Card';
import { ScoreGauge } from '../components/ScoreGauge';
import { ClipboardCheck, Target, MessagesSquare, Map, ShieldCheck, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'ATS-style match score',
    body: 'A transparent, estimated score based on keyword alignment, skills and semantic similarity — never presented as an employer\'s real ATS result.',
  },
  {
    icon: ClipboardCheck,
    title: 'Skill gap detection',
    body: 'See exactly which required skills your resume already evidences, and which ones are missing, with the evidence shown alongside each one.',
  },
  {
    icon: MessagesSquare,
    title: 'Interview preparation',
    body: 'Technical and HR interview questions generated from your actual resume and the job description, not generic question banks.',
  },
  {
    icon: Map,
    title: 'Learning roadmap',
    body: 'A week-by-week plan that targets your specific skill gaps, with practice tasks and a project to anchor each one.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <nav className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-display font-bold text-sm">
              C
            </div>
            <span className="font-display font-semibold text-[15px]">CareerAI</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-muted">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how-it-works" className="hover:text-ink">How It Works</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
            <Link to="/about" className="hover:text-ink">About</Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" className="text-sm font-medium text-ink-muted hover:text-ink hidden sm:inline">
              Login
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <header className="mx-auto max-w-6xl px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] text-ink">
            Turn your resume into a career strategy
          </h1>
          <p className="mt-5 text-lg text-ink-muted max-w-md">
            Analyze your resume against any job description, discover skill gaps, prepare for
            interviews, and build a personalized learning roadmap with AI.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Analyze My Resume <ArrowRight size={15} />
            </Link>
            <a
              href="#how-it-works"
              className="rounded-lg border border-border px-5 py-3 text-sm font-semibold text-ink hover:bg-surface-raised transition-colors"
            >
              See How It Works
            </a>
          </div>
        </div>

        <Card className="p-6">
          <p className="text-xs font-medium text-ink-muted mb-4">Sample analysis preview</p>
          <div className="grid grid-cols-3 gap-3">
            <ScoreGauge value={78} label="Match Score" size={92} />
            <ScoreGauge value={85} label="Skills" size={92} />
            <ScoreGauge value={72} label="Job Fit" size={92} />
          </div>
        </Card>
      </header>

      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl font-semibold text-center mb-10">
          Everything you need to prepare for the role
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent mb-3">
                <Icon size={17} />
              </div>
              <h3 className="font-display font-semibold text-sm mb-1.5">{title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <Card className="p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <ShieldCheck className="text-accent shrink-0" size={28} />
          <p className="text-sm text-ink-muted">
            Your resume is private by default. Only you can view your resumes, analyses and
            interview preparation — see our{' '}
            <Link to="/privacy" className="text-accent font-medium hover:underline">
              privacy policy
            </Link>{' '}
            for details on data storage and deletion.
          </p>
        </Card>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-ink-muted">
          <span>© {new Date().getFullYear()} CareerAI</span>
          <div className="flex gap-6">
            <Link to="/terms" className="hover:text-ink">Terms</Link>
            <Link to="/privacy" className="hover:text-ink">Privacy</Link>
            <Link to="/contact" className="hover:text-ink">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
