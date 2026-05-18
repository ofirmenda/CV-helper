import { useAppStore } from '../../store/useAppStore.js';
import JobDescriptionInput from './JobDescriptionInput.jsx';
import CVPanel from './CVPanel.jsx';
import ScoreCircle from './ScoreCircle.jsx';
import Legend from './Legend.jsx';

export default function MirrorView() {
  const cv = useAppStore((s) => s.cv);
  const result = useAppStore((s) => s.result);
  const error = useAppStore((s) => s.error);
  const setMode = useAppStore((s) => s.setMode);

  if (!cv) {
    return <div className="text-center py-24 text-ink-400">Loading your CV…</div>;
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-5">
        <JobDescriptionInput />
      </div>

      <div className="col-span-12 lg:col-span-2 flex flex-col items-center justify-start gap-5 pt-10">
        <ScoreCircle score={result?.ats?.overallScore ?? null} />
        <Legend />
        {!result && !error && (
          <div className="mt-1 text-xs text-ink-500 text-center leading-relaxed">
            Paste a job description and click <span className="font-semibold text-ink-950">Fit to this job description</span> to see the mirror form.
          </div>
        )}
        {error && (
          <div className="mt-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 text-center">
            <div className="font-semibold mb-0.5">Analyze failed</div>
            <div>{error}</div>
          </div>
        )}
        {result && !error && (
          <button
            onClick={() => setMode('rewrite')}
            className="mt-2 w-full rounded-2xl border-2 border-peach-500/40 bg-gradient-to-br from-peach-100 to-white p-4 text-left hover:border-peach-500 hover:from-peach-100/80 transition group shadow-soft"
          >
            <div className="text-[10px] uppercase tracking-[0.22em] text-peach-600 font-semibold mb-1">
              Next step
            </div>
            <div className="font-display text-sm font-bold text-ink-950 flex items-center justify-between gap-2">
              Continue to rewrite
              <span className="text-peach-500 group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
            <div className="text-[11px] text-ink-500 mt-1 leading-snug">
              Recruiter critique + section approval.
            </div>
          </button>
        )}
      </div>

      <div className="col-span-12 lg:col-span-5">
        <CVPanel cv={cv} />
      </div>
    </div>
  );
}
