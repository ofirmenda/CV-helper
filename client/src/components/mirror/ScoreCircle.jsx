import { motion } from 'framer-motion';

export default function ScoreCircle({ score }) {
  const value = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : null;
  const r = 64;
  const c = 2 * Math.PI * r;
  const offset = value == null ? c : c - (c * value) / 100;

  const tone =
    value == null ? 'idle' : value >= 75 ? 'good' : value >= 55 ? 'mid' : 'low';

  const stroke =
    tone === 'good'
      ? '#22c55e'
      : tone === 'mid'
      ? '#eab308'
      : tone === 'low'
      ? '#ef4444'
      : '#0099ff';

  return (
    <div className="relative">
      <svg viewBox="0 0 160 160" className="h-44 w-44">
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(26, 25, 22, 0.08)" strokeWidth="8" />
        <motion.circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-display text-5xl font-bold tracking-tight text-ink-950 leading-none">
          {value == null ? '—' : value}
        </div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mt-2">
          Match
        </div>
      </div>
    </div>
  );
}
