import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Check, Download } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { ScoreGauge } from '../components/ScoreGauge';

import { SkillBadge, ProgressSteps, EmptyState, ErrorState } from '../components/StateComponents';
import { analysisApi, ApiError } from '../api/client';
import type { FullAnalysisResult } from '../api/client';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'ats', label: 'ATS Analysis' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'technical', label: 'Technical Interview' },
  { id: 'hr', label: 'HR Interview' },
  { id: 'roadmap', label: 'Learning Roadmap' },
  { id: 'suggestions', label: 'Resume Suggestions' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} aria-label="Copy to clipboard"
      className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent-soft transition-colors">
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </button>
  );
}

function buildMissingKeywordsText(result: FullAnalysisResult): string {
  const ats = result.ats;
  const missingSkills = result.skill_gaps.filter(g => g.match_status === 'missing').map(g => g.skill);
  const partialSkills = result.skill_gaps.filter(g => g.match_status === 'partial').map(g => g.skill);

  const lines: string[] = [
    'CAREERAI — MISSING KEYWORDS REPORT',
    '='.repeat(40),
    `Analysis ID: ${result.id}`,
    `Overall Match Score: ${result.overall_score ?? 'N/A'}/100`,
    '',
    'MISSING KEYWORDS (not found in your resume)',
    '-'.repeat(40),
    ...(ats?.missing_keywords.length ? ats.missing_keywords.map(k => `- ${k}`) : ['(none detected)']),
    '',
    'MISSING SKILLS (required by the job, not evidenced in your resume)',
    '-'.repeat(40),
    ...(missingSkills.length ? missingSkills.map(s => `- ${s}`) : ['(none detected)']),
    '',
    'PARTIALLY COVERED SKILLS (mentioned but not listed explicitly)',
    '-'.repeat(40),
    ...(partialSkills.length ? partialSkills.map(s => `- ${s}`) : ['(none)']),
    '',
    'MATCHED KEYWORDS (already present in your resume)',
    '-'.repeat(40),
    ...(ats?.matched_keywords.length ? ats.matched_keywords.map(k => `- ${k}`) : ['(none detected)']),
    '',
    '='.repeat(40),
    "Disclaimer: This is a CareerAI estimated analysis based on keyword",
    'alignment, skills and semantic similarity. It does not represent any',
    "employer's actual ATS scoring system.",
  ];
  return lines.join('\n');
}

function DifficultyBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    Easy: 'bg-success/10 text-success',
    Medium: 'bg-warning/10 text-warning',
    Hard: 'bg-danger/10 text-danger',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[level] || 'bg-border text-ink-muted'}`}>
      {level}
    </span>
  );
}

export default function AnalysisResult() {
  const { id } = useParams<{ id: string }>();
  
  const [tab, setTab] = useState<TabId>('overview');
  const [status, setStatus] = useState<string>('queued');
  const [result, setResult] = useState<FullAnalysisResult | null>(null);
  const [error, setError] = useState('');
  

  const poll = useCallback(async () => {
    if (!id) return;
    try {
      const s = await analysisApi.getStatus(id);
      setStatus(s.status);
      if (s.status === 'completed') {
        const full = await analysisApi.getResult(id);
        setResult(full);
      } else if (s.status === 'failed') {
        setError('AI analysis could not be completed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Something went wrong.');
    }
  }, [id]);

  // Poll every 3s while processing/queued
  useEffect(() => {
    poll();
    if (status === 'completed' || status === 'failed') return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll, status]);

  const isProcessing = status === 'queued' || status === 'processing';

  if (error) {
    return (
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar title="Analysis" />
          <main className="flex-1 flex items-center justify-center">
            <ErrorState message={error} onRetry={() => { setError(''); setStatus('queued'); poll(); }} />
          </main>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar title="Analyzing…" />
          <main className="flex-1 flex items-center justify-center p-6">
            <Card className="p-8 w-full max-w-sm">
              <h2 className="font-display font-semibold text-ink mb-1 text-center">
                Analyzing your career profile
              </h2>
              <p className="text-sm text-ink-muted text-center mb-6">
                CareerAI is running the 10-step AI pipeline. This usually takes 30–90 seconds.
              </p>
              <ProgressSteps status={status as 'queued' | 'processing'} />
            </Card>
          </main>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar title="Analysis" />
          <main className="flex-1 flex items-center justify-center">
            <EmptyState title="Analysis not found" description="This analysis may have been deleted." />
          </main>
        </div>
      </div>
    );
  }

  const score = result.overall_score ?? 0;
  const matched = result.skill_gaps.filter(g => g.match_status === 'matched');
  const missing = result.skill_gaps.filter(g => g.match_status === 'missing');

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="Analysis Result" subtitle="CareerAI AI Career & Interview Agent" />

        <main className="flex-1 p-6">
          {/* Tab bar */}
          <div className="flex overflow-x-auto gap-1 mb-6 bg-surface border border-border rounded-xl p-1 w-fit max-w-full">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                  ${tab === t.id ? 'bg-accent text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-canvas'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-5 text-center">
                  <ScoreGauge value={score} label="Match Score" />
                  <p className="text-xs text-ink-muted mt-2">CareerAI estimated score</p>
                </Card>
                <Card className="p-5 text-center">
                  <ScoreGauge value={result.ats?.skill_score ?? 0} label="Skills Match" />
                </Card>
                <Card className="p-5 text-center">
                  <ScoreGauge value={result.ats?.semantic_score ?? 0} label="Semantic Match" />
                </Card>
                <Card className="p-5 text-center">
                  <ScoreGauge value={result.ats?.keyword_score ?? 0} label="Keywords" />
                </Card>
              </div>

              <Card className="p-5">
                <p className="text-xs text-ink-muted bg-canvas rounded-lg px-3 py-2 border border-border">
                  ⚠️ <strong>Disclaimer:</strong> {result.ats?.disclaimer}
                </p>
              </Card>

              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="p-5">
                  <h3 className="font-semibold text-sm text-ink mb-3">Matched Skills ({matched.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {matched.length ? matched.map(s => (
                      <SkillBadge key={s.skill} label={s.skill} status="matched" />
                    )) : <p className="text-sm text-ink-muted">None detected</p>}
                  </div>
                </Card>
                <Card className="p-5">
                  <h3 className="font-semibold text-sm text-ink mb-3">Missing Skills ({missing.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {missing.length ? missing.map(s => (
                      <SkillBadge key={s.skill} label={s.skill} status="missing" />
                    )) : <p className="text-sm text-ink-muted">No critical gaps detected</p>}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ── ATS ── */}
          {tab === 'ats' && result.ats && (
            <div className="flex flex-col gap-5">
              <Card className="p-5">
                <h3 className="font-semibold text-ink mb-3">Score Breakdown</h3>
                <div className="grid sm:grid-cols-3 gap-4 text-center">
                  {[
                    { label: 'Skill Match (45%)', value: result.ats.skill_score },
                    { label: 'Keyword Match (30%)', value: result.ats.keyword_score },
                    { label: 'Semantic Match (25%)', value: result.ats.semantic_score },
                  ].map(d => (
                    <div key={d.label} className="p-4 rounded-xl bg-canvas border border-border">
                      <p className="font-display text-2xl font-bold text-ink">{d.value.toFixed(0)}%</p>
                      <p className="text-xs text-ink-muted mt-1">{d.label}</p>
                    </div>
                  ))}
                </div>
              </Card>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="p-5">
                  <h3 className="font-semibold text-sm mb-3">Matched Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.ats.matched_keywords.map(k => <SkillBadge key={k} label={k} status="matched" />)}
                  </div>
                </Card>
                <Card className="p-5">
                  <h3 className="font-semibold text-sm mb-3">Missing Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.ats.missing_keywords.map(k => <SkillBadge key={k} label={k} status="missing" />)}
                  </div>
                </Card>
              </div>
              <Card className="p-5">
                <h3 className="font-semibold text-sm mb-3">Improvement Suggestions</h3>
                <ul className="flex flex-col gap-2">
                  {[...result.ats.formatting_suggestions, ...result.ats.improvement_suggestions].map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink-muted">
                      <span className="text-accent">→</span>{s}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-ink">Missing Keywords — Plain Text</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(buildMissingKeywordsText(result));
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas transition-colors"
                    >
                      <Copy size={13} /> Copy as text
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([buildMissingKeywordsText(result)], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `careerai-missing-keywords-${result.id.slice(0, 8)}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                    >
                      <Download size={13} /> Download .txt
                    </button>
                  </div>
                </div>
                <p className="text-xs text-ink-muted mb-3">
                  A plain-text summary of every missing keyword and skill gap — paste it directly into
                  your resume editor or share it with a mentor.
                </p>
                <pre className="whitespace-pre-wrap font-mono text-xs bg-canvas border border-border rounded-lg p-4 text-ink-muted max-h-72 overflow-y-auto">
                  {buildMissingKeywordsText(result)}
                </pre>
              </Card>
            </div>
          )}

          {/* ── Skills ── */}
          {tab === 'skills' && (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border bg-canvas">
                      <th className="px-5 py-3 font-semibold text-ink-muted">Skill</th>
                      <th className="px-5 py-3 font-semibold text-ink-muted">Status</th>
                      <th className="px-5 py-3 font-semibold text-ink-muted">Importance</th>
                      <th className="px-5 py-3 font-semibold text-ink-muted">Resume Evidence</th>
                      <th className="px-5 py-3 font-semibold text-ink-muted">Suggested Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.skill_gaps.map(g => (
                      <tr key={g.skill} className="border-b border-border last:border-0 hover:bg-canvas/50">
                        <td className="px-5 py-3 font-medium text-ink">{g.skill}</td>
                        <td className="px-5 py-3"><SkillBadge label={g.match_status} status={g.match_status} /></td>
                        <td className="px-5 py-3 capitalize text-ink-muted">{g.importance}</td>
                        <td className="px-5 py-3 text-ink-muted text-xs max-w-[200px]">{g.resume_evidence || '—'}</td>
                        <td className="px-5 py-3 text-ink-muted text-xs max-w-[200px]">{g.suggested_action || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ── Projects ── */}
          {tab === 'projects' && (
            <div className="flex flex-col gap-5">
              <p className="text-xs text-ink-muted bg-canvas border border-border rounded-lg px-3 py-2">
                These are <strong>Recommended Projects</strong> — AI-generated suggestions, not your existing experience.
              </p>
              {result.projects.map((p, i) => (
                <Card key={i} className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-xs font-semibold text-accent bg-accent-soft px-2 py-0.5 rounded-full mb-2 inline-block">
                        Recommended Project
                      </span>
                      <h3 className="font-display font-semibold text-ink text-lg">{p.title}</h3>
                    </div>
                    <DifficultyBadge level={p.difficulty} />
                  </div>
                  <p className="text-sm text-ink-muted mb-4">{p.reason}</p>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-ink-muted uppercase mb-2">Skills demonstrated</p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.skills.map(s => <SkillBadge key={s} label={s} />)}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink-muted uppercase mb-2">Technology</p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.technology.map(t => <SkillBadge key={t} label={t} />)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-canvas rounded-xl p-4 border border-border">
                    <p className="text-xs font-semibold text-ink-muted uppercase mb-1">Suggested resume bullet</p>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-ink">{p.resume_bullet}</p>
                      <CopyButton text={p.resume_bullet} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Technical Interview ── */}
          {tab === 'technical' && (
            <div className="flex flex-col gap-5">
              {result.technical_interview.map((q, i) => (
                <Card key={i} className="p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent font-bold text-xs shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <DifficultyBadge level={q.difficulty} />
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-canvas border border-border text-ink-muted">
                          {q.topic}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-ink">{q.question}</p>
                        <CopyButton text={q.question} />
                      </div>
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="text-sm font-medium text-accent cursor-pointer hover:underline">
                      Show expected answer
                    </summary>
                    <div className="mt-3 bg-canvas rounded-xl p-4 border border-border">
                      <p className="text-sm text-ink mb-2">{q.expected_answer}</p>
                      {q.explanation && (
                        <p className="text-xs text-ink-muted border-t border-border pt-2 mt-2">{q.explanation}</p>
                      )}
                    </div>
                  </details>
                  {q.follow_up_questions?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <p className="text-xs text-ink-muted w-full">Follow-ups:</p>
                      {q.follow_up_questions.map((fq, fi) => (
                        <span key={fi} className="text-xs bg-canvas border border-border rounded-lg px-2.5 py-1 text-ink-muted">
                          {fq}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* ── HR Interview ── */}
          {tab === 'hr' && (
            <div className="flex flex-col gap-5">
              {result.hr_interview.map((q, i) => (
                <Card key={i} className="p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet/10 text-violet font-bold text-xs shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-ink">{q.question}</p>
                        <CopyButton text={q.question} />
                      </div>
                      <details className="mt-2">
                        <summary className="text-sm font-medium text-accent cursor-pointer hover:underline">
                          Show suggested approach
                        </summary>
                        <div className="mt-3 bg-canvas rounded-xl p-4 border border-border">
                          <p className="text-sm text-ink">{q.expected_answer}</p>
                        </div>
                      </details>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Roadmap ── */}
          {tab === 'roadmap' && (
            <div className="flex flex-col gap-4">
              {result.roadmap.map(w => (
                <Card key={w.week} className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white font-bold text-sm shrink-0">
                      {w.week}
                    </div>
                    <div>
                      <p className="font-display font-semibold text-ink">Week {w.week}: {w.topic}</p>
                      <p className="text-xs text-ink-muted">Focus: {w.skill}</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-xs font-semibold text-ink-muted uppercase mb-1.5">Objective</p>
                      <p className="text-sm text-ink">{w.objective}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink-muted uppercase mb-1.5">Practice Task</p>
                      <p className="text-sm text-ink">{w.practice_task}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink-muted uppercase mb-1.5">Project Task</p>
                      <p className="text-sm text-ink">{w.project_task}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ── Resume Suggestions ── */}
          {tab === 'suggestions' && (
            <div className="flex flex-col gap-5">
              <p className="text-xs text-ink-muted bg-canvas border border-border rounded-lg px-3 py-2">
                These are <strong>Suggested Improvements</strong> — review and apply them yourself. CareerAI does not automatically edit your resume.
              </p>
              {result.resume_suggestions.map((s, i) => (
                <Card key={i} className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent capitalize">
                      {s.label}
                    </span>
                    <span className="text-xs text-ink-muted capitalize">{s.category}</span>
                  </div>
                  {s.original && (
                    <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 mb-3">
                      <p className="text-xs text-ink-muted mb-1">Original</p>
                      <p className="text-sm text-ink">{s.original}</p>
                    </div>
                  )}
                  <div className="bg-success/5 border border-success/20 rounded-lg p-3 mb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-ink-muted mb-1">Suggestion</p>
                        <p className="text-sm text-ink">{s.suggestion}</p>
                      </div>
                      <CopyButton text={s.suggestion} />
                    </div>
                  </div>
                  <p className="text-xs text-ink-muted">{s.reason}</p>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
