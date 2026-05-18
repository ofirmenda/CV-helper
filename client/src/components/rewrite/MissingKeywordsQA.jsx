import { useEffect, useMemo, useState } from 'react';
import { useAppStore, SECTION_ORDER } from '../../store/useAppStore.js';
import { api } from '../../api/client.js';

const INITIAL = { answer: null, text: '' }; // answer: 'yes' | 'no' | null

export default function MissingKeywordsQA({ onDone }) {
  const cv = useAppStore((s) => s.cv);
  const jd = useAppStore((s) => s.jd);
  const result = useAppStore((s) => s.result);
  const setCv = useAppStore((s) => s.setCv);
  const saveCv = useAppStore((s) => s.saveCv);
  const setStore = useAppStore.setState;

  const missing = useMemo(() => result?.ats?.missingKeywords || [], [result]);
  const [entries, setEntries] = useState(() =>
    missing.reduce((acc, k) => { acc[k] = { ...INITIAL }; return acc; }, {})
  );
  // Re-sync entries when missing keywords change (e.g. after a refine roundtrip).
  // Without this, a second analyze leaves stale entry keys and the inputs vanish.
  useEffect(() => {
    setEntries((prev) => {
      const next = {};
      for (const k of missing) next[k] = prev[k] || { ...INITIAL };
      return next;
    });
  }, [missing.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ghBusy, setGhBusy] = useState(false);
  const [ghResult, setGhResult] = useState(null);
  const [ghError, setGhError] = useState(null);
  const [githubInput, setGithubInput] = useState(cv?.personalInfo?.github || '');
  useEffect(() => {
    setGithubInput(cv?.personalInfo?.github || '');
  }, [cv?.personalInfo?.github]);

  const answeredYes = Object.entries(entries).filter(([, v]) => v.answer === 'yes' && v.text.trim().length > 5).length;
  const answeredNo = Object.values(entries).filter((v) => v.answer === 'no').length;
  // Flatten GitHub findings keyed by keyword — only keywords still in the missing
  // set, and exclude any the user explicitly marked No (their "no" wins).
  const githubEvidence = (() => {
    if (!ghResult?.findings) return [];
    const out = [];
    for (const kw of missing) {
      if (entries[kw]?.answer === 'no') continue; // explicit no overrides github
      const arr = ghResult.findings[kw] || [];
      for (const f of arr.slice(0, 3)) {
        out.push({
          keyword: kw,
          repo: f.repo,
          source: f.source,
          evidence: f.evidence,
          url: f.url,
        });
      }
    }
    return out;
  })();
  const hasAnySignal = answeredYes > 0 || answeredNo > 0 || githubEvidence.length > 0;

  function setAnswer(keyword, answer) {
    setEntries((e) => ({ ...e, [keyword]: { ...e[keyword], answer } }));
  }
  function setText(keyword, text) {
    setEntries((e) => ({ ...e, [keyword]: { ...e[keyword], text } }));
  }

  async function investigateGithub() {
    const username = (githubInput || '').trim();
    if (!username) {
      setGhError('Enter a GitHub username or profile URL.');
      return;
    }
    setGhBusy(true);
    setGhError(null);
    try {
      const data = await api.githubInvestigate(username, missing);
      if (data.error) setGhError(data.error);
      setGhResult(data);
      // Persist to CV so it shows up in the editor + future analyses.
      if (cv && cv.personalInfo?.github !== username) {
        const nextCv = { ...cv, personalInfo: { ...(cv.personalInfo || {}), github: username } };
        setCv(nextCv);
        saveCv().catch(() => {});
      }
    } catch (e) {
      setGhError(e.message);
    } finally {
      setGhBusy(false);
    }
  }

  function applyGithubEvidence(keyword, finding) {
    const draft = `Found in my GitHub repo "${finding.repo}" — ${finding.source}: ${finding.evidence}`;
    setEntries((e) => ({ ...e, [keyword]: { answer: 'yes', text: draft } }));
  }

  async function submit({ skip } = {}) {
    setBusy(true);
    setError(null);
    try {
      if (skip) {
        onDone?.();
        return;
      }
      const userContext = Object.entries(entries)
        .filter(([, v]) => v.answer === 'yes' && v.text.trim().length > 5)
        .map(([keyword, v]) => ({ keyword, explanation: v.text.trim() }));
      const confirmedAbsent = Object.entries(entries)
        .filter(([, v]) => v.answer === 'no')
        .map(([keyword]) => keyword);
      // Bail out only if there is genuinely nothing new to tell the LLM —
      // the GitHub findings alone are enough signal to justify a refine.
      if (!userContext.length && !confirmedAbsent.length && !githubEvidence.length) {
        onDone?.();
        return;
      }
      const refined = await api.analyze(cv, jd, userContext, {
        confirmedAbsent,
        githubEvidence,
      });
      const approvals = SECTION_ORDER.reduce((acc, name) => {
        if (refined.sections?.[name]) acc[name] = { status: 'pending', finalText: refined.sections[name].after };
        else acc[name] = { status: 'pending', finalText: '' };
        return acc;
      }, {});
      setStore({ result: refined, approvals, currentSectionIndex: 0, provider: refined.provider });
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!missing.length) {
    onDone?.();
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1">Step 03a / Fill the gaps</div>
        <h2 className="font-display text-3xl font-bold tracking-tight">Tell us about the missing pieces</h2>
        <div className="text-sm text-ink-500 mt-2 max-w-2xl leading-relaxed">
          The job description mentions{' '}
          <span className="font-semibold text-ink-950">{missing.length} keywords</span> we couldn't find in
          your CV. For each, mark <span className="font-semibold">Yes</span> if you have real experience —
          then say a sentence. The AI will weave only verified context into your CV.
        </div>
      </div>

      {/* GitHub investigator */}
      <div className="card p-5 mb-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div>
            <div className="text-sm font-semibold text-ink-950">Investigate GitHub for evidence</div>
            <div className="text-xs text-ink-500 mt-0.5">
              We'll scan a user's public repos (README, description, language, topics) for each missing keyword.
            </div>
          </div>
          {ghResult?.username && (
            <span className="text-[11px] text-ink-400">
              Last scanned: <span className="font-mono text-ink-700">{ghResult.username}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="input-light flex-1"
            placeholder="github.com/yourusername  (or just yourusername)"
            value={githubInput}
            onChange={(e) => setGithubInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !ghBusy && githubInput.trim()) investigateGithub();
            }}
          />
          <button
            className="btn-primary"
            onClick={investigateGithub}
            disabled={ghBusy || !githubInput.trim()}
          >
            {ghBusy ? 'Scanning…' : ghResult ? 'Re-scan' : 'Scan'}
          </button>
        </div>
        <div className="mt-2 text-[11px] text-ink-400">
          {cv?.personalInfo?.github
            ? <>Saved to your CV. Edit to change.</>
            : <>Will be saved to your CV on scan.</>
          }
        </div>
      </div>
      {ghError && <div className="text-xs text-rose-600 mb-3">GitHub: {ghError}</div>}

      <div className="space-y-3">
        {missing.map((k) => {
          const entry = entries[k];
          const ghFindings = (ghResult?.findings?.[k] || []).slice(0, 3);
          return (
            <div key={k} className="card p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="chip chip-miss">{k}</span>
                  <span className="text-[11px] text-ink-500">Have you done this?</span>
                </div>
                <div className="flex items-center gap-1">
                  <YesNoButton selected={entry.answer === 'yes'} onClick={() => setAnswer(k, 'yes')} label="Yes" tone="yes" />
                  <YesNoButton selected={entry.answer === 'no'} onClick={() => setAnswer(k, 'no')} label="No" tone="no" />
                </div>
              </div>

              {ghFindings.length > 0 && (
                <div className="mt-3 rounded-xl border border-cream-200 bg-cream-50/60 p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400 font-semibold mb-1.5">
                    Found in your GitHub
                  </div>
                  <ul className="space-y-1.5 text-xs text-ink-700">
                    {ghFindings.map((f, i) => (
                      <li key={i} className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-ink-950 underline decoration-cream-300 hover:decoration-ink-700"
                          >
                            {f.repo}
                          </a>
                          <span className="text-ink-500"> · {f.source}</span>
                          <div className="text-ink-700 mt-0.5 truncate">{f.evidence}</div>
                        </div>
                        <button
                          className="text-[11px] text-spark-600 hover:text-spark-500 whitespace-nowrap font-medium"
                          onClick={() => applyGithubEvidence(k, f)}
                        >
                          Use this →
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {entry.answer === 'yes' && (
                <div className="mt-3">
                  <div className="text-[11px] text-ink-500 mb-1.5">Say more — when, where, what did you do?</div>
                  <textarea
                    className="input-light w-full min-h-[70px] resize-y leading-relaxed"
                    rows={2}
                    placeholder={`e.g. "Built ${k} pipelines on the Pulse project (2023) using AWS Lambda."`}
                    value={entry.text}
                    onChange={(e) => setText(k, e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="mt-4 text-sm text-rose-600">{error}</div>}

      <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-ink-500 leading-relaxed">
          {[
            answeredYes && `${answeredYes} yes`,
            answeredNo && `${answeredNo} no`,
            githubEvidence.length && `${githubEvidence.length} from GitHub`,
          ].filter(Boolean).join(' · ') || `${missing.length} keyword${missing.length === 1 ? '' : 's'} pending`}
          {hasAnySignal && (
            <> · <span className="text-ink-700">all signals will refine the analysis</span></>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => submit({ skip: true })} disabled={busy}>
            Skip — go straight to review
          </button>
          <button className="btn-primary" onClick={() => submit()} disabled={busy || !hasAnySignal}>
            {busy ? 'Refining…' : 'Refine analysis'}
          </button>
        </div>
      </div>
    </div>
  );
}

function YesNoButton({ selected, onClick, label, tone }) {
  const base = 'rounded-full px-3 py-1 text-xs font-semibold transition border';
  const yes = selected
    ? 'border-emerald-500 bg-emerald-500 text-white'
    : 'border-cream-300 bg-white text-ink-700 hover:border-emerald-400 hover:text-emerald-700';
  const no = selected
    ? 'border-ink-950 bg-ink-950 text-cream-50'
    : 'border-cream-300 bg-white text-ink-700 hover:border-ink-700';
  return (
    <button type="button" onClick={onClick} className={`${base} ${tone === 'yes' ? yes : no}`}>
      {label}
    </button>
  );
}
