import { Link } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">C</div>
          <span className="font-display font-semibold text-ink">CareerAI</span>
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/login" className="text-sm font-medium text-accent hover:underline">Log in</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-ink mb-8">{title}</h1>
        <div className="prose-legal">{children}</div>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap gap-4 text-sm text-ink-muted">
          <Link to="/privacy" className="hover:text-ink">Privacy</Link>
          <Link to="/terms"   className="hover:text-ink">Terms</Link>
          <Link to="/contact" className="hover:text-ink">Contact</Link>
          <span className="ml-auto">© {new Date().getFullYear()} CareerAI</span>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-semibold text-ink mb-3 pb-2 border-b border-border">{title}</h2>
      <div className="text-sm text-ink-muted leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

// ── Privacy Policy ─────────────────────────────────────────────────────────────
export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p className="text-sm text-ink-muted mb-8">Last updated: January 2024</p>

      <Section title="What we collect">
        <p>When you create a CareerAI account we collect your email address and optionally your full name. If you use Google login we receive your name and email from Google after your consent.</p>
        <p>When you upload a resume we store the PDF file privately and extract text from it for analysis. We store the job descriptions you paste. We store the AI-generated analysis results linked to your account.</p>
        <p>We log security events such as login attempts (storing only a one-way hash of IP addresses — never the raw IP) and session metadata such as browser user-agent for session management.</p>
      </Section>

      <Section title="How we use it">
        <p>Your resume text and job description content are sent to a third-party large language model (LLM) API to generate the analysis. This is the core function of the product. The LLM provider processes this data according to their own privacy policy.</p>
        <p>We do not sell your data. We do not use your resume content for advertising. We do not share your personal data with third parties except the AI provider processing the analysis and the email provider sending verification emails.</p>
      </Section>

      <Section title="Data storage">
        <p>Resume files are stored privately. No public URL exists for any resume file. Only your authenticated account can retrieve your files.</p>
        <p>Analysis results, interview questions, and roadmap content are stored in our database linked to your account.</p>
        <p>Session data including refresh tokens is stored as one-way hashes — the raw token is never stored.</p>
      </Section>

      <Section title="Your rights">
        <p>You can delete individual resumes from the Resumes page, individual analyses from the My Analyses page, and your entire account from Settings → Privacy. Deleting your account removes all associated data.</p>
        <p>You can view and revoke active login sessions from Settings → Active Sessions at any time.</p>
      </Section>

      <Section title="Security">
        <p>Passwords are hashed using Argon2id, a memory-hard algorithm recommended by OWASP. Email verification codes are single-use and expire in 10 minutes. All API communication should use HTTPS in production.</p>
      </Section>

      <Section title="Contact">
        <p>For privacy questions email <a href="mailto:privacy@careerai.app" className="text-accent hover:underline">privacy@careerai.app</a>.</p>
      </Section>
    </LegalLayout>
  );
}

// ── Terms of Service ───────────────────────────────────────────────────────────
export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p className="text-sm text-ink-muted mb-8">Last updated: January 2024</p>

      <Section title="Service description">
        <p>CareerAI is an AI-powered career analysis tool. It analyzes your resume against job descriptions and generates estimated scores, skill gap analyses, interview questions, learning roadmaps, and resume suggestions.</p>
      </Section>

      <Section title="AI disclaimer — important">
        <p><strong className="text-ink">The CareerAI Match Score is an estimate</strong> based on keyword alignment, skill matching, and semantic similarity calculated by CareerAI. It does not represent the scoring system of any employer's Applicant Tracking System (ATS), and it does not predict whether any employer will select your application.</p>
        <p><strong className="text-ink">Interview questions and suggested answers are AI-generated suggestions.</strong> They should be reviewed, adapted to your own experience, and verified for accuracy before use. CareerAI does not guarantee they reflect the actual questions asked in any interview.</p>
        <p><strong className="text-ink">Project recommendations are suggestions only.</strong> They are labelled "Recommended Project" and do not represent your existing experience. Adding them to a resume without completing the project would be misrepresentation.</p>
        <p><strong className="text-ink">CareerAI does not guarantee employment</strong> or that use of this tool will result in a job offer, interview, or any career outcome.</p>
      </Section>

      <Section title="Acceptable use">
        <p>You may use CareerAI for personal career preparation. You must not: attempt to reverse-engineer the AI system; submit content designed to manipulate or attack AI systems (prompt injection); upload malicious files; create multiple accounts to bypass rate limits; or use the service in any way that violates applicable law.</p>
      </Section>

      <Section title="Account">
        <p>You are responsible for keeping your credentials secure. You must not share your account. You must be at least 16 years old to use CareerAI.</p>
      </Section>

      <Section title="Limitation of liability">
        <p>CareerAI is provided "as is". To the maximum extent permitted by law, CareerAI and its operators are not liable for any damages arising from use of this service, including career outcomes, data loss, or inaccurate AI outputs.</p>
      </Section>

      <Section title="Changes">
        <p>We may update these terms. Continued use after changes constitutes acceptance. We will notify registered users of material changes by email.</p>
      </Section>
    </LegalLayout>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────
export function AboutPage() {
  return (
    <LegalLayout title="About CareerAI">
      <Section title="What is CareerAI?">
        <p>CareerAI is a full-stack AI career analysis application. It takes a resume PDF and a job description, runs a 10-step AI pipeline, and produces a comprehensive career preparation package including an ATS-style match score, skill gap analysis, interview preparation, a learning roadmap, and resume improvement suggestions.</p>
      </Section>

      <Section title="Technology">
        <p>CareerAI is built with React, TypeScript, and Tailwind CSS on the frontend, and FastAPI with PostgreSQL on the backend. AI features use large language model APIs (OpenAI or Anthropic) for structured content generation and text embeddings for semantic similarity matching.</p>
        <p>All AI keys and secrets live on the backend only. Resume files are stored privately with random storage keys. Passwords are hashed with Argon2id. Sessions use rotating refresh tokens stored as cryptographic hashes.</p>
      </Section>

      <Section title="Academic & portfolio use">
        <p>CareerAI was built as a production-quality portfolio project demonstrating full-stack engineering, AI integration, security engineering, and modern DevOps practices. The source code is intended to demonstrate real engineering — there are no fake buttons, fake statistics, or placeholder AI responses.</p>
      </Section>

      <Section title="AI ethics statement">
        <p>CareerAI clearly labels AI-generated content as such. It never presents AI inference as user experience, and never automatically adds skills or experience the candidate does not have. The ATS score methodology is documented and transparent. All prompts include explicit instructions to treat user content as data only, protecting against prompt injection.</p>
      </Section>

      <Section title="Contact">
        <p>For questions or feedback: <a href="mailto:hello@careerai.app" className="text-accent hover:underline">hello@careerai.app</a></p>
      </Section>
    </LegalLayout>
  );
}

// ── Contact ───────────────────────────────────────────────────────────────────
export function ContactPage() {
  return (
    <LegalLayout title="Contact">
      <Section title="Get in touch">
        <p>General enquiries: <a href="mailto:hello@careerai.app" className="text-accent hover:underline">hello@careerai.app</a></p>
        <p>Privacy questions: <a href="mailto:privacy@careerai.app" className="text-accent hover:underline">privacy@careerai.app</a></p>
        <p>Security issues: <a href="mailto:security@careerai.app" className="text-accent hover:underline">security@careerai.app</a></p>
      </Section>
      <Section title="Response times">
        <p>We aim to respond to all enquiries within 2 business days. Security reports are treated as high priority and acknowledged within 24 hours.</p>
      </Section>
    </LegalLayout>
  );
}
