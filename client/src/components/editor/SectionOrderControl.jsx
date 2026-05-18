import { useMemo, useState } from 'react';

const ALL_SECTIONS = ['summary', 'skills', 'experience', 'projects', 'achievements', 'education', 'languages'];
const LABELS = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  achievements: 'Achievements',
  education: 'Education',
  languages: 'Languages',
};

function defaultOrder(cv) {
  const present = ALL_SECTIONS.filter((k) => {
    if (k === 'summary') return !!cv?.summary;
    return Array.isArray(cv?.[k]) && cv[k].length;
  });
  return present;
}

export default function SectionOrderControl({ cv, value, suggestion, onChange, compact = false }) {
  const order = useMemo(() => {
    if (Array.isArray(value) && value.length) return value;
    return defaultOrder(cv);
  }, [value, cv]);

  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const moveItem = (idx, direction) => {
    const next = [...order];
    const swap = idx + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  const reorderTo = (fromIdx, toIdx) => {
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) return;
    const next = [...order];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next);
  };

  const applySuggestion = () => {
    if (Array.isArray(suggestion) && suggestion.length) onChange(suggestion);
  };

  const suggestionDifferent =
    Array.isArray(suggestion) &&
    suggestion.length &&
    (suggestion.length !== order.length || suggestion.some((s, i) => s !== order[i]));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 gap-3">
        {!compact && (
          <h3 className="font-display text-lg font-bold tracking-tight text-ink-950">Section order</h3>
        )}
        <div className={`flex items-center gap-3 ${compact ? 'ml-0' : 'ml-auto'}`}>
          {suggestionDifferent && (
            <button
              type="button"
              onClick={applySuggestion}
              className="text-xs font-medium text-spark-600 hover:text-spark-500 underline-offset-2 hover:underline"
            >
              Apply suggested order
            </button>
          )}
          <span className="text-[11px] text-ink-400">Drag to reorder · or use ↑ ↓</span>
        </div>
      </div>
      <ol className="space-y-1.5">
        {order.map((key, i) => {
          const isDragging = dragIdx === i;
          const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
          return (
            <li
              key={key}
              draggable
              onDragStart={(e) => {
                setDragIdx(i);
                e.dataTransfer.effectAllowed = 'move';
                // Some browsers require setData to actually start a drag.
                try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* ignore */ }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overIdx !== i) setOverIdx(i);
              }}
              onDragLeave={() => {
                if (overIdx === i) setOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx != null) reorderTo(dragIdx, i);
                setDragIdx(null);
                setOverIdx(null);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setOverIdx(null);
              }}
              className={`flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 select-none transition ${
                isDragging
                  ? 'border-ink-950 opacity-50'
                  : isOver
                  ? 'border-ink-950 ring-2 ring-ink-950/15'
                  : 'border-cream-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="cursor-grab active:cursor-grabbing text-ink-400 text-base leading-none" title="Drag to reorder" aria-hidden>⋮⋮</span>
                <span className="h-6 w-6 rounded-full bg-cream-100 text-ink-700 grid place-items-center text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-ink-950 truncate">{LABELS[key] || key}</span>
                {Array.isArray(suggestion) && suggestion[i] !== key && (
                  <span className="text-[10px] uppercase tracking-wider text-peach-600 whitespace-nowrap">
                    suggested: {LABELS[suggestion[i]] || suggestion[i]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(i, -1)}
                  disabled={i === 0}
                  className="h-7 w-7 rounded-lg border border-cream-200 bg-white text-ink-700 disabled:opacity-30 hover:border-ink-700 hover:text-ink-950"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(i, 1)}
                  disabled={i === order.length - 1}
                  className="h-7 w-7 rounded-lg border border-cream-200 bg-white text-ink-700 disabled:opacity-30 hover:border-ink-700 hover:text-ink-950"
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
