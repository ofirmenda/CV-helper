import { useMemo, useState } from 'react';
import { useAppStore, SECTION_ORDER } from '../../store/useAppStore.js';
import SectionReviewCard from './SectionReviewCard.jsx';
import ReviewSummary from './ReviewSummary.jsx';
import MissingKeywordsQA from './MissingKeywordsQA.jsx';
import RecruiterCritique from './RecruiterCritique.jsx';

const STATUS_GLYPH = {
  approved: '✓',
  edited: '✎',
  rejected: '✕',
  pending: '○',
};

export default function SectionReviewWizard({ onExport }) {
  const result = useAppStore((s) => s.result);
  const approvals = useAppStore((s) => s.approvals);
  const currentSectionIndex = useAppStore((s) => s.currentSectionIndex);
  const jumpToSection = useAppStore((s) => s.jumpToSection);
  const resetApprovals = useAppStore((s) => s.resetApprovals);
  const [phase, setPhase] = useState('qa'); // 'qa' | 'review'

  const availableSections = useMemo(
    () => SECTION_ORDER.filter((n) => result?.sections?.[n]),
    [result]
  );

  if (!result) {
    return (
      <div className="text-center py-24 text-ink-400">
        Run an analysis from the Mirror tab to start the review wizard.
      </div>
    );
  }

  const allResolved =
    availableSections.length > 0 &&
    availableSections.every((n) => approvals[n]?.status && approvals[n].status !== 'pending');

  const currentName = availableSections[currentSectionIndex];

  // Phase 1: missing-keyword Q&A (always preceded by the recruiter critique panel).
  if (phase === 'qa') {
    return (
      <div className="max-w-5xl mx-auto">
        <RecruiterCritique />
        <MissingKeywordsQA onDone={() => setPhase('review')} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <RecruiterCritique />
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1">Step 04 / Review</div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Section-by-section</h2>
        <div className="text-sm text-ink-500 mt-1">
          Review each AI suggestion. Approve, edit, or keep your original — nothing changes until you decide.
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-x-2 gap-y-2 mb-6">
        {availableSections.map((name, i) => {
          const status = approvals[name]?.status || 'pending';
          const active = i === currentSectionIndex;
          const done = status === 'approved' || status === 'edited';
          const rejected = status === 'rejected';
          return (
            <button
              key={name}
              onClick={() => jumpToSection(i)}
              className={`flex items-center gap-2 transition ${
                active ? 'text-ink-950' : done ? 'text-ink-700' : rejected ? 'text-ink-500' : 'text-ink-400'
              } hover:text-ink-950`}
            >
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold border ${
                  done
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : rejected
                    ? 'bg-cream-100 text-ink-500 border-cream-300'
                    : active
                    ? 'bg-ink-950 text-cream-50 border-ink-950'
                    : 'bg-white text-ink-500 border-cream-300'
                }`}
              >
                {STATUS_GLYPH[status]}
              </span>
              <span className="text-sm font-medium capitalize">{name}</span>
              {i < availableSections.length - 1 && <span className="ml-2 text-cream-300">/</span>}
            </button>
          );
        })}
        <button
          onClick={resetApprovals}
          className="ml-auto text-xs text-ink-400 hover:text-peach-500 underline-offset-2 hover:underline"
        >
          Reset decisions
        </button>
      </div>

      {!allResolved && currentName && (
        <SectionReviewCard
          name={currentName}
          proposal={result.sections[currentName]}
          decision={approvals[currentName]}
        />
      )}

      {allResolved && <ReviewSummary onExport={onExport} />}
    </div>
  );
}
