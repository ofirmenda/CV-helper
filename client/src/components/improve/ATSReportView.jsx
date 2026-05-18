import { useAppStore } from '../../store/useAppStore.js';
import GithubHealthCard from './GithubHealthCard.jsx';

const TEMPLATE_LAYOUT = {
  'template-modern': { columns: 2, parserSafe: false },
  'template-classic': { columns: 2, parserSafe: false },
  'template-ats-safe': { columns: 1, parserSafe: true },
};

export default function ATSReportView() {
  const result = useAppStore((s) => s.result);
  const template = useAppStore((s) => s.template);
  const cv = useAppStore((s) => s.cv);
  if (!result) {
    return <div className="text-center py-24 text-ink-400">Run Analyze first.</div>;
  }
  const ats = result.ats || {};
  const compliance = ats.compliance || {};
  const layout = TEMPLATE_LAYOUT[template] || { columns: 1, parserSafe: true };
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="card p-7">
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1">ATS Report</div>
            <h2 className="font-display text-3xl font-bold tracking-tight">
              How an automated screener might score this match
            </h2>
            <div className="text-sm text-ink-500 mt-2 max-w-xl">
              Most ATS tools score keyword density, skill overlap, experience signal, and formatting. Here's how your CV stacks up against this JD.
            </div>
          </div>
          <Big score={ats.overallScore} />
        </div>
        <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-3">
          <ScoreTile label="Keywords" score={ats.keywordMatchScore} />
          <ScoreTile label="Skills" score={ats.skillsMatchScore} />
          <ScoreTile label="Experience" score={ats.experienceMatchScore} />
          <ScoreTile label="Formatting" score={ats.formattingScore} />
        </div>
      </div>

      <div className="card p-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1 font-semibold">Compliance</div>
        <div className="font-display text-xl font-bold mb-1">Will a parser read this?</div>
        <div className="text-xs text-ink-500 mb-4 max-w-2xl">
          Modern ATS tools reject CVs they can't parse. Single-column layouts, unambiguous dates, active-verb bullets, and quantified results all reduce silent rejections.
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <ComplianceRow
            ok={layout.parserSafe}
            label="Single-column layout"
            hint={layout.parserSafe
              ? 'ATS-safe template is selected.'
              : 'Selected template uses a sidebar. Switch to "ATS Safe" in the export modal for portal submissions.'}
          />
          <ComplianceRow
            ok={(compliance.ambiguousDates ?? 0) === 0}
            label="Date formats"
            hint={(compliance.ambiguousDates ?? 0) === 0
              ? 'All entries use unambiguous month-and-year dates.'
              : `${compliance.ambiguousDates} entry(s) use year-only dates — months unknown to parsers.`}
          />
          <ComplianceRow
            ok={(compliance.passiveBullets ?? 0) === 0}
            label="Active-voice bullets"
            hint={(compliance.passiveBullets ?? 0) === 0
              ? 'No passive openers detected.'
              : `${compliance.passiveBullets} bullet(s) start with passive phrasing.`}
          />
          <ComplianceRow
            ok={(compliance.longBullets ?? 0) === 0}
            label="Concise bullets (≤ 25 words)"
            hint={(compliance.longBullets ?? 0) === 0
              ? 'All bullets fit the recruiter scan window.'
              : `${compliance.longBullets} bullet(s) exceed 25 words.`}
          />
          <ComplianceRow
            ok={(compliance.metriclessBullets ?? 0) <= Math.max(1, Math.floor((cv?.experience?.flatMap?.((e) => e.bullets || []).length || 1) / 3))}
            label="Quantified impact"
            hint={(compliance.metriclessBullets ?? 0) === 0
              ? 'Every bullet includes a metric.'
              : `${compliance.metriclessBullets} bullet(s) lack a number. Add %, $, time saved, or scale.`}
          />
          <ComplianceRow
            ok
            label="Contact in body (not header/footer)"
            hint="Always satisfied by our templates — parsers skip page headers/footers."
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <List title="Matched" items={ats.matchedKeywords} tone="match" />
        <List title="Weak / partial" items={ats.weakKeywords} tone="partial" />
        <List title="Missing" items={ats.missingKeywords} tone="miss" />
      </div>

      {ats.recommendedAdditions?.length > 0 && (
        <div className="card p-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1 font-semibold">Recommended</div>
          <div className="font-display text-xl font-bold mb-1">Worth surfacing — if true</div>
          <div className="text-xs text-ink-500 mb-4 max-w-xl">
            Only add these if they accurately reflect skills you actually have. The tool never invents experience.
          </div>
          <div className="flex flex-wrap gap-2">
            {ats.recommendedAdditions.map((k) => (
              <span key={k} className="chip border-spark-500/40 bg-spark-500/10 text-spark-600">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {ats.warnings?.length > 0 && (
        <div className="card p-6 border-peach-300">
          <div className="text-[10px] uppercase tracking-[0.22em] text-peach-600 mb-1 font-semibold">Watch</div>
          <div className="font-display text-xl font-bold mb-3">Formatting notes</div>
          <ul className="text-sm text-ink-700 space-y-1.5">
            {ats.warnings.map((w, i) => (
              <li key={i} className="pl-4 relative">
                <span className="absolute left-0 top-[9px] h-1 w-1 rounded-full bg-peach-500" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <GithubHealthCard />
    </div>
  );
}

function ComplianceRow({ ok, label, hint }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          ok ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
        }`}
      >
        {ok ? '✓' : '!'}
      </span>
      <div className="min-w-0">
        <div className="font-semibold text-ink-950">{label}</div>
        <div className="text-[11px] text-ink-500 leading-relaxed">{hint}</div>
      </div>
    </div>
  );
}

function Big({ score }) {
  const value = typeof score === 'number' ? score : '—';
  return (
    <div className="text-right">
      <div className="font-display text-6xl font-bold tracking-tight text-ink-950 leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mt-2">Overall</div>
    </div>
  );
}

function ScoreTile({ label, score }) {
  const value = typeof score === 'number' ? score : 0;
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-ink-950">{value}</div>
      <div className="mt-3 h-1 rounded-full bg-cream-200 overflow-hidden">
        <div
          className="h-full bg-ink-950"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function List({ title, items, tone }) {
  const toneCls = { match: 'chip-match', partial: 'chip-partial', miss: 'chip-miss' }[tone];
  return (
    <div className="card p-5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-2 font-semibold">{title}</div>
      {items?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((k) => (
            <span key={k} className={`chip ${toneCls}`}>{k}</span>
          ))}
        </div>
      ) : (
        <div className="text-sm text-ink-400 italic">None</div>
      )}
    </div>
  );
}
