import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import DiffView from './DiffView.jsx';

const COLLAPSE_KEY = 'cvmirror.critiqueCollapsed';

export default function RecruiterCritique() {
  const cv = useAppStore((s) => s.cv);
  const jd = useAppStore((s) => s.jd);
  const critique = useAppStore((s) => s.critique);
  const critiqueStatus = useAppStore((s) => s.critiqueStatus);
  const critiqueError = useAppStore((s) => s.critiqueError);
  const fetchCritique = useAppStore((s) => s.fetchCritique);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  });

  // Auto-fetch once when the Rewrite mode mounts and we don't have a critique yet.
  useEffect(() => {
    if (!cv) return;
    if (critique || critiqueStatus !== 'idle') return;
    fetchCritique();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cv && JSON.stringify(cv.personalInfo), jd]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      if (typeof localStorage !== 'undefined') {
        if (next) localStorage.setItem(COLLAPSE_KEY, '1');
        else localStorage.removeItem(COLLAPSE_KEY);
      }
      return next;
    });
  }

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1 font-semibold">
            Recruiter critique
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-950">
            What a hiring manager would notice first
          </h2>
          <div className="text-xs text-ink-500 mt-1 max-w-2xl leading-relaxed">
            A 5-step honest read — weaknesses, positioning, focused rewrites, missing keywords, and a
            change log. Generated from your CV{jd ? ' and the job description' : ' (no JD pasted)'}.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-ghost text-xs"
            onClick={() => {
              useAppStore.setState({ critique: null });
              fetchCritique();
            }}
            disabled={critiqueStatus === 'loading'}
          >
            {critiqueStatus === 'loading' ? 'Generating…' : 'Re-run'}
          </button>
          <button
            className="text-xs text-ink-500 hover:text-ink-950 underline-offset-2 hover:underline"
            onClick={toggleCollapsed}
          >
            {collapsed ? 'Show critique' : 'Hide critique'}
          </button>
        </div>
      </div>

      {critiqueError && <div className="text-xs text-rose-600 mb-3">Critique error: {critiqueError}</div>}

      {!collapsed && (
        <>
          {critiqueStatus === 'loading' && !critique && <SkeletonPanels />}
          {critique && <RenderedCritique data={critique} />}
        </>
      )}
    </div>
  );
}

function SkeletonPanels() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 rounded-xl bg-cream-100" />
      <div className="h-20 rounded-xl bg-cream-100" />
      <div className="h-32 rounded-xl bg-cream-100" />
      <div className="h-12 rounded-xl bg-cream-100" />
    </div>
  );
}

function Panel({ title, hint, children }) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50/60 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 font-semibold">{title}</div>
        {hint && <div className="text-[11px] text-ink-500 max-w-md text-right">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function RenderedCritique({ data }) {
  const { weaknesses = [], positioning = {}, improvedSections = {}, missingKeywords = [], changeLog = [] } = data;
  return (
    <div className="space-y-4">
      {weaknesses.length > 0 && (
        <Panel title="Top weaknesses + fixes" hint="Each diagnosis has a concrete fix you can apply.">
          <ol className="text-sm text-ink-950 space-y-3.5">
            {weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-ink-950 text-cream-50 text-[10px] font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{w.point}</div>
                  {w.evidence && (
                    <div className="mt-1 text-[11px] text-ink-500 italic border-l-2 border-cream-300 pl-2">
                      "{w.evidence}"
                    </div>
                  )}
                  {w.fix && (
                    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-peach-100 border border-peach-300/70 px-2.5 py-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-peach-600 font-semibold mt-0.5 whitespace-nowrap">
                        Fix
                      </span>
                      <span className="text-[12.5px] text-ink-700 leading-relaxed">{w.fix}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {(positioning.current || positioning.target || positioning.gap) && (
        <Panel title="Positioning" hint="How you read now vs. how you should read for this role.">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-cream-200 bg-white p-3">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Current</div>
              <div className="text-sm text-ink-950">{positioning.current || '—'}</div>
            </div>
            <div className="rounded-xl border border-spark-500/40 bg-spark-500/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-spark-600 font-semibold mb-1">Target</div>
              <div className="text-sm text-ink-950">{positioning.target || '—'}</div>
            </div>
          </div>
          {positioning.gap && (
            <div className="mt-2.5 text-sm text-ink-700 leading-relaxed">
              <span className="font-semibold text-ink-950">Gap: </span>
              {positioning.gap}
            </div>
          )}
        </Panel>
      )}

      {improvedSections.summary && (
        <Panel title="Improved summary" hint="Tightened pitch. Approve/edit in the wizard below.">
          <DiffView before={improvedSections.summary.before} after={improvedSections.summary.after} />
        </Panel>
      )}

      {improvedSections.experienceBullets?.length > 0 && (
        <Panel title="Top bullet rewrites" hint="The 2–3 highest-leverage rewrites. Apply via the section wizard.">
          <ul className="space-y-3">
            {improvedSections.experienceBullets.map((b, i) => (
              <li key={i} className="rounded-xl border border-cream-200 bg-white p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1.5">
                  Experience entry {b.entryIndex + 1} · bullet {b.bulletIndex + 1}
                </div>
                <DiffView before={b.before} after={b.after} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {missingKeywords.length > 0 && (
        <Panel title="Missing keywords" hint="Add only if accurate. Each comes with a natural-sounding suggestion.">
          <ul className="space-y-2 text-sm">
            {missingKeywords.map((m, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="chip chip-miss whitespace-nowrap">{m.term}</span>
                <div className="text-ink-700 leading-relaxed flex-1">{m.suggestionToInclude}</div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {changeLog.length > 0 && (
        <Panel title="Change log" hint="Every suggested change with its rationale.">
          <ul className="space-y-2 text-sm">
            {changeLog.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-peach-500" />
                <div>
                  <span className="font-semibold text-ink-950">{c.change}</span>
                  {c.why && <span className="text-ink-500"> — {c.why}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
