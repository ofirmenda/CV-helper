import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore.js';

const STEPS = [
  { id: 'template', label: 'Template', hint: 'PDF look' },
  { id: 'cv', label: 'Your CV', hint: 'Upload or edit' },
  { id: 'jd', label: 'Fit to job', hint: 'Paste the role' },
  { id: 'tailor', label: 'Rewrite', hint: 'Review & approve' },
  { id: 'export', label: 'Export', hint: 'Download PDF' },
];

function hasMeaningfulCv(cv) {
  if (!cv) return false;
  const hasName = !!cv.personalInfo?.name;
  const hasSummary = !!cv.summary && cv.summary.length > 30;
  const hasExp = Array.isArray(cv.experience) && cv.experience.length > 0;
  const hasSkills = Array.isArray(cv.skills) && cv.skills.length > 0;
  return hasName && (hasSummary || hasExp || hasSkills);
}

function allApproved(approvals, sections) {
  if (!sections) return false;
  const keys = Object.keys(sections);
  if (!keys.length) return false;
  return keys.every((n) => approvals?.[n]?.status && approvals[n].status !== 'pending');
}

export default function FlowStepper({ template, onPickTemplate, onOpenEditor, onOpenExport }) {
  const cv = useAppStore((s) => s.cv);
  const jd = useAppStore((s) => s.jd);
  const result = useAppStore((s) => s.result);
  const approvals = useAppStore((s) => s.approvals);
  const setMode = useAppStore((s) => s.setMode);

  const statuses = useMemo(() => {
    const cvDone = hasMeaningfulCv(cv);
    const jdDone = jd && jd.trim().length >= 20;
    return {
      template: Boolean(template),
      cv: cvDone,
      jd: jdDone,
      tailor: Boolean(result) && allApproved(approvals, result?.sections),
      export: false,
    };
  }, [cv, jd, result, template, approvals]);

  // A step is reachable once its preconditions hold. The strict gating between
  // steps is intentionally loose for steps 1-2 and 5 (template / CV / export)
  // so the user can always reach them once a CV exists.
  function isReady(stepId, i) {
    switch (stepId) {
      case 'template':
        return true;
      case 'cv':
        return Boolean(template);
      case 'jd':
        return Boolean(template) && statuses.cv;
      case 'tailor':
        return Boolean(template) && statuses.cv && statuses.jd;
      case 'export':
        return Boolean(template) && statuses.cv;
      default:
        return i === 0 || Object.values(statuses).slice(0, i).every(Boolean);
    }
  }

  return (
    <div className="px-6 pb-8">
      <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-2">
        {STEPS.map((step, i) => {
          const done = statuses[step.id];
          const ready = isReady(step.id, i);
          return (
            <div key={step.id} className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (step.id === 'template') onPickTemplate?.();
                  else if (step.id === 'cv') onOpenEditor?.();
                  else if (step.id === 'jd') {
                    setMode('mirror');
                    setTimeout(() => {
                      const ta = document.querySelector('textarea[placeholder*="job description" i]');
                      ta?.focus();
                      ta?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                  } else if (step.id === 'tailor') {
                    setMode(result ? 'rewrite' : 'mirror');
                  } else if (step.id === 'export') {
                    onOpenExport?.();
                  }
                }}
                disabled={!ready && !done}
                className={`group inline-flex items-center gap-2.5 transition disabled:cursor-not-allowed ${
                  done
                    ? 'text-ink-950'
                    : ready
                    ? 'text-ink-950 hover:text-peach-500'
                    : 'text-ink-400'
                }`}
              >
                <span
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition ${
                    done
                      ? 'bg-ink-950 text-cream-50'
                      : ready
                      ? 'border border-ink-950 text-ink-950 group-hover:bg-ink-950 group-hover:text-cream-50'
                      : 'border border-cream-300 text-ink-400'
                  }`}
                >
                  {done ? (
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="text-sm font-medium whitespace-nowrap">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-8 bg-cream-200" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
