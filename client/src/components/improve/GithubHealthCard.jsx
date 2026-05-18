import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import { api } from '../../api/client.js';

function flattenCvTech(cv) {
  const out = new Set();
  for (const s of cv?.skills || []) {
    if (typeof s === 'string') out.add(s.toLowerCase());
    else if (Array.isArray(s?.items)) for (const it of s.items) out.add(String(it).toLowerCase());
  }
  return out;
}

export default function GithubHealthCard() {
  const cv = useAppStore((s) => s.cv);
  const username = cv?.personalInfo?.github;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function scan() {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.githubProfile(username);
      if (result?.error) setError(result.error);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (username) scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const techMismatch = useMemo(() => {
    if (!data?.techStack) return null;
    const cvTech = flattenCvTech(cv);
    const ghTech = new Set((data.techStack || []).map((t) => t.toLowerCase()));
    const onlyInGithub = [...ghTech].filter((t) => !cvTech.has(t) && t.length > 1);
    const onlyInCv = [...cvTech].filter((t) => !ghTech.has(t) && t.length > 1);
    return { onlyInGithub: onlyInGithub.slice(0, 12), onlyInCv: onlyInCv.slice(0, 12) };
  }, [data, cv]);

  if (!username) return null;

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1 font-semibold">GitHub</div>
          <div className="font-display text-xl font-bold">Profile health</div>
          <div className="text-xs text-ink-500 mt-1">
            Recruiters for engineering roles open your GitHub profile next. This checklist mirrors what they look for.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-display text-3xl font-bold tracking-tight text-ink-950">
              {typeof data?.score === 'number' ? data.score : '—'}
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400">/ 100</div>
          </div>
          <button className="btn-ghost" onClick={scan} disabled={loading}>
            {loading ? 'Scanning…' : 'Re-scan'}
          </button>
        </div>
      </div>

      {error && <div className="text-xs text-rose-600 mb-2">GitHub: {error}</div>}

      {data?.checks && (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mt-3">
          {data.checks.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  c.pass ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                }`}
              >
                {c.pass ? '✓' : '!'}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-ink-950">{c.label}</div>
                <div className="text-[11px] text-ink-500 leading-relaxed">{c.hint}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.topRepos?.length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-2 font-semibold">
            Top repos (approximation of pinned)
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.topRepos.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink-950 underline decoration-cream-300 underline-offset-2 hover:decoration-ink-700"
                >
                  {r.name}
                </a>
                <span className="text-[11px] text-ink-500 flex items-center gap-2">
                  {r.hasReadme ? <span className="text-emerald-600">README</span> : <span className="text-amber-600">no README</span>}
                  <span>·</span>
                  {r.hasDemo ? <span className="text-emerald-600">demo</span> : <span className="text-amber-600">no demo</span>}
                  <span>·</span>
                  {r.hasLicense ? <span className="text-emerald-600">{r.licenseName}</span> : <span className="text-amber-600">no license</span>}
                  <span>·</span>
                  <span>{Number.isFinite(r.daysSinceCommit) ? `${Math.round(r.daysSinceCommit)}d ago` : '—'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {techMismatch && (techMismatch.onlyInCv.length > 0 || techMismatch.onlyInGithub.length > 0) && (
        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          {techMismatch.onlyInCv.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1.5 font-semibold">
                In CV but not on GitHub
              </div>
              <div className="flex flex-wrap gap-1.5">
                {techMismatch.onlyInCv.map((t) => (
                  <span key={t} className="chip chip-partial">{t}</span>
                ))}
              </div>
              <div className="text-[11px] text-ink-500 mt-1.5">
                Consider linking a small repo demonstrating each — recruiters search for the source.
              </div>
            </div>
          )}
          {techMismatch.onlyInGithub.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1.5 font-semibold">
                On GitHub but missing from CV
              </div>
              <div className="flex flex-wrap gap-1.5">
                {techMismatch.onlyInGithub.map((t) => (
                  <span key={t} className="chip chip-match">{t}</span>
                ))}
              </div>
              <div className="text-[11px] text-ink-500 mt-1.5">
                Surfaced in your code — worth adding to Skills if accurate.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
