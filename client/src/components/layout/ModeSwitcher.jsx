import { useAppStore } from '../../store/useAppStore.js';

const MODES = [
  { id: 'mirror', label: 'Mirror', hint: 'Visual connections' },
  { id: 'rewrite', label: 'Rewrite', hint: 'Section approval' },
  { id: 'improve', label: 'Improve', hint: 'ATS analysis' },
];

export default function ModeSwitcher() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const result = useAppStore((s) => s.result);

  return (
    <div className="px-6 pb-8 flex justify-center">
      <div className="flex items-end gap-10 border-b border-cream-200">
        {MODES.map((m) => {
          const active = mode === m.id;
          const disabled = !result && m.id !== 'mirror';
          return (
            <button
              key={m.id}
              disabled={disabled}
              onClick={() => setMode(m.id)}
              className={`relative pb-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 group ${
                active ? 'text-ink-950' : 'text-ink-500 hover:text-ink-950'
              }`}
              title={disabled ? 'Run Analyze first' : m.hint}
            >
              <div className="font-display text-2xl font-bold tracking-tight">{m.label}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-ink-400">{m.hint}</div>
              {active && (
                <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-ink-950" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
