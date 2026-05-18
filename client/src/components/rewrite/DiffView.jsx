import { useMemo } from 'react';
import { diffWords } from 'diff';

export default function DiffView({ before = '', after = '' }) {
  const parts = useMemo(() => diffWords(before || '', after || ''), [before, after]);
  return (
    <div className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-950">
      {parts.map((p, i) => {
        if (p.added) return <span key={i} className="diff-add">{p.value}</span>;
        if (p.removed) return <span key={i} className="diff-del">{p.value}</span>;
        return <span key={i}>{p.value}</span>;
      })}
    </div>
  );
}
