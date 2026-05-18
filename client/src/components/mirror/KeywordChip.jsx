import { useAppStore } from '../../store/useAppStore.js';

const STATUS_CLASS = {
  match: 'chip-match',
  partial: 'chip-partial',
  miss: 'chip-miss',
};

const DOT = {
  match: 'bg-emerald-500',
  partial: 'bg-amber-500',
  miss: 'bg-rose-500',
};

export default function KeywordChip({ keyword }) {
  const setHovered = useAppStore((s) => s.setHoveredKeyword);
  const hovered = useAppStore((s) => s.ui.hoveredKeyword);

  const isHovered = hovered === keyword.term;
  const cls = STATUS_CLASS[keyword.status] || STATUS_CLASS.match;

  return (
    <button
      onMouseEnter={() => setHovered(keyword.term)}
      onMouseLeave={() => setHovered(null)}
      className={`chip ${cls} ${isHovered ? 'ring-2 ring-offset-1 ring-spark-500/60' : ''}`}
      title={`${keyword.term} — ${keyword.status}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[keyword.status] || DOT.match}`} />
      <span>{keyword.term}</span>
    </button>
  );
}
