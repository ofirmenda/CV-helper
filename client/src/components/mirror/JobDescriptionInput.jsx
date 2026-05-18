import { useAppStore } from '../../store/useAppStore.js';
import KeywordChip from './KeywordChip.jsx';
import { highlightKeywords } from '../../utils/highlightKeywords.jsx';

const SAMPLE_JD = `Senior Frontend Engineer, Growth

We're looking for a Senior Frontend Engineer to own our experimentation and acquisition surfaces.

Requirements:
- 5+ years of production React + TypeScript
- Strong CSS skills; Tailwind, modern component patterns
- Experience with Next.js or similar SSR frameworks
- Solid grasp of REST APIs and GraphQL
- A/B testing, Core Web Vitals, performance optimization
- AWS, Docker, GitHub Actions

You will:
- Lead the technical direction for growth features
- Mentor mid-level engineers
- Drive Core Web Vitals across marketing and onboarding`;

export default function JobDescriptionInput() {
  const jd = useAppStore((s) => s.jd);
  const setJd = useAppStore((s) => s.setJd);
  const analyze = useAppStore((s) => s.analyze);
  const result = useAppStore((s) => s.result);
  const status = useAppStore((s) => s.status);
  const hoveredKeyword = useAppStore((s) => s.ui.hoveredKeyword);
  const setHovered = useAppStore((s) => s.setHoveredKeyword);

  const keywords = result?.keywords || [];
  const canAnalyze = jd && jd.trim().length >= 20 && status !== 'analyzing';
  const showHighlighted = keywords.length > 0 && jd;

  return (
    <div className="card p-7 min-h-[640px] relative overflow-hidden">
      <div className="absolute top-0 right-0 h-px w-32 bg-gradient-to-l from-spark-500/60 to-transparent" />

      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400">01 / Job description</div>
          <h2 className="font-display text-xl font-bold mt-1 text-ink-950">Paste the role</h2>
        </div>
        <div className="flex items-center gap-3">
          {!jd && (
            <button
              className="text-xs text-spark-600 hover:text-spark-500 transition"
              onClick={() => setJd(SAMPLE_JD)}
            >
              Try sample →
            </button>
          )}
        </div>
      </div>

      {showHighlighted ? (
        <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-950 max-h-[420px] overflow-y-auto p-3 rounded-xl bg-cream-50/60 border border-cream-200">
          {highlightKeywords(jd, keywords, {
            hoveredTerm: hoveredKeyword,
            onHover: setHovered,
            onLeave: () => setHovered(null),
          })}
        </div>
      ) : (
        <textarea
          className="input-light min-h-[420px] resize-none font-mono text-xs leading-relaxed"
          placeholder="Paste a job description here…"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
        />
      )}

      <div className="mt-5 flex items-center gap-3 justify-between">
        <span className="text-xs text-ink-500">
          {jd.length} chars
          {keywords.length > 0 && <span className="ml-2">· {keywords.length} keywords</span>}
        </span>
        <button className="btn-accent" onClick={() => analyze()} disabled={!canAnalyze}>
          {status === 'analyzing' ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
              Analyzing
            </>
          ) : (
            <>Fit to this job description →</>
          )}
        </button>
      </div>

      {keywords.length > 0 && (
        <div className="mt-7">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-3">Detected keywords</div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k) => (
              <KeywordChip key={k.term} keyword={k} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
