import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import DiffView from './DiffView.jsx';
import InlineEditor from './InlineEditor.jsx';
import { bulletIssues, bulletsFromAfter, summaryStats } from '../../utils/bulletQuality.js';

function findIntegratedKeywords(after, keywords) {
  if (!after || !Array.isArray(keywords)) return [];
  const lower = after.toLowerCase();
  return keywords.filter((k) => {
    const term = (typeof k === 'string' ? k : k.term || '').toLowerCase();
    if (!term || term.length < 2) return false;
    return lower.includes(term);
  });
}

const STATUS_BADGE = {
  approved: { label: 'Approved', cls: 'chip-match' },
  edited: { label: 'Edited', cls: 'border-spark-500/40 bg-spark-500/10 text-spark-600 chip' },
  rejected: { label: 'Original kept', cls: 'border-ink-300 bg-cream-100 text-ink-700 chip' },
  pending: { label: 'Pending', cls: 'border-cream-300 bg-white text-ink-500 chip' },
};

export default function SectionReviewCard({ name, proposal, decision }) {
  const approve = useAppStore((s) => s.approveSection);
  const reject = useAppStore((s) => s.rejectSection);
  const edit = useAppStore((s) => s.editSection);
  const skip = useAppStore((s) => s.skipSection);
  const result = useAppStore((s) => s.result);
  const [editing, setEditing] = useState(false);

  const status = decision?.status || 'pending';
  const badge = STATUS_BADGE[status];

  const beforeEmpty = !proposal.before || !proposal.before.trim();
  const afterEmpty = !proposal.after || !proposal.after.trim();
  const noChange = beforeEmpty && afterEmpty;

  // Surface the ATS-derived keywords against this rewrite: what JD keywords the
  // AI successfully wove in, what's still missing, what's already present.
  const ats = result?.ats || {};
  const integratedNow = useMemo(
    () => findIntegratedKeywords(proposal.after, ats.missingKeywords || []),
    [proposal.after, ats.missingKeywords]
  );
  const stillMissing = useMemo(
    () => (ats.missingKeywords || []).filter((k) => !findIntegratedKeywords(proposal.after, [k]).length),
    [proposal.after, ats.missingKeywords]
  );
  const alreadyPresent = useMemo(
    () => findIntegratedKeywords(proposal.after, ats.matchedKeywords || []),
    [proposal.after, ats.matchedKeywords]
  );

  return (
    <div className="card p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h3 className="font-display text-2xl font-bold capitalize tracking-tight">{name}</h3>
          <span className={status === 'approved' ? 'chip chip-match' : badge.cls}>{badge.label}</span>
        </div>
        <div className="text-xs text-ink-500 max-w-xs text-right">
          Decide what stays. Original is preserved unless you approve or edit.
        </div>
      </div>

      {noChange ? (
        <div className="text-sm text-ink-400 italic">
          No content in this section — nothing to review.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-5">
            <Panel title="Before — your CV">
              <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-700">
                {proposal.before || '—'}
              </pre>
            </Panel>
            <Panel title="After — AI suggestion" accent>
              {!editing && (
                <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-950">
                  {proposal.after || '—'}
                </pre>
              )}
            </Panel>
          </div>

          <Panel title="Word-level diff">
            <DiffView before={proposal.before} after={proposal.after} />
          </Panel>

          {(name === 'experience' || name === 'projects') && (
            <BulletQualityPanel name={name} after={proposal.after} />
          )}

          {name === 'summary' && (
            <SummaryQualityPanel after={proposal.after} keywords={result?.keywords} />
          )}

          {(integratedNow.length > 0 || stillMissing.length > 0 || alreadyPresent.length > 0) && (
            <Panel title="ATS keyword coverage">
              <div className="space-y-2.5">
                {integratedNow.length > 0 && (
                  <KeywordRow
                    label="Woven into the rewrite"
                    items={integratedNow}
                    tone="match"
                    hint="Previously missing — the AI integrated these into the suggested rewrite."
                  />
                )}
                {alreadyPresent.length > 0 && (
                  <KeywordRow
                    label="Already present"
                    items={alreadyPresent}
                    tone="partial"
                    hint="Matched in the JD and surfaced in this section."
                  />
                )}
                {stillMissing.length > 0 && (
                  <KeywordRow
                    label="Still missing"
                    items={stillMissing}
                    tone="miss"
                    hint="The AI did not find safe evidence in your CV. Add only if accurate."
                  />
                )}
              </div>
            </Panel>
          )}

          {proposal.changes?.length > 0 && (
            <Panel title="Changes">
              <ul className="text-sm text-ink-950 space-y-1.5">
                {proposal.changes.map((c, i) => (
                  <li key={i} className="pl-4 relative">
                    <span className="absolute left-0 top-[9px] h-1 w-1 rounded-full bg-peach-500" />
                    {c}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {proposal.reason && (
            <Panel title="Why this helps">
              <p className="text-sm text-ink-700 leading-relaxed">{proposal.reason}</p>
            </Panel>
          )}
        </>
      )}

      {editing && (
        <Panel title="Edit suggestion">
          <InlineEditor
            initial={decision?.finalText || proposal.after || ''}
            onSave={(text) => {
              edit(name, text);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-cream-200">
        <button className="btn-primary" onClick={() => approve(name)} disabled={editing || noChange}>
          Approve AI version
        </button>
        <button className="btn-ghost" onClick={() => setEditing(true)} disabled={noChange}>
          Edit
        </button>
        <button className="btn-ghost" onClick={() => reject(name)} disabled={editing}>
          Keep original
        </button>
        <button className="btn-ghost" onClick={() => skip()}>
          Skip
        </button>
      </div>
    </div>
  );
}

function Panel({ title, accent, children }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? 'border-spark-500/30 bg-spark-500/5' : 'border-cream-200 bg-cream-50/60'
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-3 font-semibold">{title}</div>
      {children}
    </div>
  );
}

const ISSUE_TONE = {
  long: 'border-amber-300/70 bg-amber-50 text-amber-700',
  passive: 'border-rose-300/70 bg-rose-50 text-rose-600',
  'no-metric': 'border-amber-300/70 bg-amber-50 text-amber-700',
};
const ISSUE_LABEL = {
  long: 'long',
  passive: 'passive',
  'no-metric': 'no metric',
};

function BulletQualityPanel({ name, after }) {
  const bullets = useMemo(() => bulletsFromAfter(name, after), [name, after]);
  const rows = useMemo(
    () => bullets.map((b) => ({ text: b, issues: bulletIssues(b) })),
    [bullets]
  );
  if (!rows.length) return null;
  const cleanCount = rows.filter((r) => r.issues.length === 0).length;
  return (
    <Panel title="Bullet quality">
      <div className="text-[11px] text-ink-500 mb-3">
        <span className="font-semibold text-ink-950">{cleanCount}</span> of {rows.length} bullets meet
        STAR &amp; ATS guidelines (≤ 25 words, active verb, quantified outcome).
      </div>
      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                r.issues.length === 0 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}
              title={r.issues.length === 0 ? 'Looks great' : r.issues.map((i) => i.label).join(' · ')}
            >
              {r.issues.length === 0 ? '✓' : '!'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[12px] leading-relaxed text-ink-950">{r.text}</div>
              {r.issues.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.issues.map((iss, j) => (
                    <span key={j} className={`chip ${ISSUE_TONE[iss.kind] || ''}`}>
                      {ISSUE_LABEL[iss.kind] || iss.kind}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function SummaryQualityPanel({ after, keywords }) {
  const stats = useMemo(() => summaryStats(after || ''), [after]);
  const top5 = useMemo(() => (keywords || []).slice(0, 5).map((k) => k.term || k), [keywords]);
  const found = useMemo(
    () => top5.filter((t) => (after || '').toLowerCase().includes(String(t).toLowerCase())),
    [top5, after]
  );
  if (!after) return null;
  const sentencesOk = stats.sentences >= 3 && stats.sentences <= 4;
  return (
    <Panel title="Summary quality">
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              sentencesOk ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {sentencesOk ? '✓' : '!'}
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-ink-950">Sentence count: {stats.sentences}</div>
            <div className="text-[11px] text-ink-500">Target: 3–4 sentences (movie-trailer pitch).</div>
          </div>
        </div>
        {top5.length > 0 && (
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                found.length >= Math.min(2, top5.length) ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {found.length >= Math.min(2, top5.length) ? '✓' : '!'}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-ink-950">
                Top JD keywords in summary: {found.length} of {top5.length}
              </div>
              <div className="text-[11px] text-ink-500">
                Surfacing 2–3 of the JD's strongest signals up top is the difference between "interesting"
                and "obviously qualified".
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function KeywordRow({ label, items, tone, hint }) {
  const cls = { match: 'chip-match', partial: 'chip-partial', miss: 'chip-miss' }[tone] || 'chip-match';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-xs font-semibold text-ink-950">{label}</span>
        {hint && <span className="text-[11px] text-ink-500 text-right max-w-md">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((k) => (
          <span key={k} className={`chip ${cls}`}>{k}</span>
        ))}
      </div>
    </div>
  );
}
