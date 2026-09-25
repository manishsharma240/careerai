import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { ScoreGauge } from '../components/ScoreGauge';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Plus, ExternalLink } from 'lucide-react';

// Sample data only — replace with real values from GET /analyses once the
// backend + AI pipeline (Phases 5-10) are wired up. CareerAI never renders
// invented numbers as if they were calculated results in the real app.
const sampleTrend = [
  { month: 'Apr', score: 61 },
  { month: 'May', score: 68 },
  { month: 'Jun', score: 64 },
  { month: 'Jul', score: 72 },
  { month: 'Aug', score: 78 },
];

const sampleSkills = [
  { skill: 'Python', count: 8 },
  { skill: 'FastAPI', count: 6 },
  { skill: 'SQL', count: 5 },
  { skill: 'Docker', count: 4 },
  { skill: 'AWS', count: 3 },
];

const sampleAnalyses = [
  { job: 'Backend Engineer', company: 'Nimbus Systems', score: 78, status: 'Completed', date: 'Sep 12' },
  { job: 'ML Engineer', company: 'Solstice AI', score: 65, status: 'Completed', date: 'Sep 8' },
  { job: 'Full-Stack Developer', company: 'Fieldstone', score: 71, status: 'Completed', date: 'Sep 2' },
];

export default function Dashboard() {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title="Dashboard" subtitle="Ready to improve your next application?" />

        <main className="flex-1 p-6 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Welcome back, Aditi</h2>
              <p className="text-sm text-ink-muted">Sample preview — connect the backend to see your real analyses.</p>
            </div>
            <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              <Plus size={16} />
              New Analysis
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6">
              <h3 className="font-display text-sm font-semibold text-ink mb-4">Latest Match Overview</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <ScoreGauge value={78} label="Match Score" />
                <ScoreGauge value={85} label="Skills Match" />
                <ScoreGauge value={90} label="Experience Relevance" />
                <ScoreGauge value={72} label="Job Fit" />
              </div>
            </Card>

            <Card className="p-6 flex flex-col gap-4">
              <h3 className="font-display text-sm font-semibold text-ink">Your Activity</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="font-display text-xl font-semibold text-ink">3</p>
                  <p className="text-xs text-ink-muted">Analyses</p>
                </div>
                <div>
                  <p className="font-display text-xl font-semibold text-ink">1</p>
                  <p className="text-xs text-ink-muted">Resumes</p>
                </div>
                <div>
                  <p className="font-display text-xl font-semibold text-ink">71</p>
                  <p className="text-xs text-ink-muted">Avg. Score</p>
                </div>
              </div>
              <p className="text-xs text-ink-muted border-t border-border pt-3">
                Counts reflect real rows in your account once authentication and the analysis
                pipeline are connected.
              </p>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold text-ink">Recent Analyses</h3>
              <button className="text-sm font-medium text-accent flex items-center gap-1 hover:underline">
                View all <ExternalLink size={13} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted border-b border-border">
                    <th className="py-2 pr-4 font-medium">Job</th>
                    <th className="py-2 pr-4 font-medium">Company</th>
                    <th className="py-2 pr-4 font-medium">Score</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleAnalyses.map((row) => (
                    <tr key={row.job} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 text-ink font-medium">{row.job}</td>
                      <td className="py-3 pr-4 text-ink-muted">{row.company}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                          {row.score}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-ink-muted">{row.status}</td>
                      <td className="py-3 pr-4 text-ink-muted">{row.date}</td>
                      <td className="py-3">
                        <button className="text-accent text-sm font-medium hover:underline">Open</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-display text-sm font-semibold text-ink mb-1">Score Trend</h3>
              <p className="text-xs text-ink-muted mb-4">Sample data</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={sampleTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--ink-muted)" fontSize={12} />
                  <YAxis stroke="var(--ink-muted)" fontSize={12} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--ink)',
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="font-display text-sm font-semibold text-ink mb-1">Most Common Required Skills</h3>
              <p className="text-xs text-ink-muted mb-4">Sample data</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sampleSkills}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="skill" stroke="var(--ink-muted)" fontSize={12} />
                  <YAxis stroke="var(--ink-muted)" fontSize={12} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--ink)',
                    }}
                  />
                  <Bar dataKey="count" fill="var(--violet)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
