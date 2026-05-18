const TEMPLATES = [
  {
    id: 'template-modern',
    label: 'Tech / Student',
    description: 'Left sidebar with icons. Best for engineering, technical, and student CVs.',
    preview: (
      <svg viewBox="0 0 240 320" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <rect width="240" height="320" fill="#fff" />
        <rect x="0" y="0" width="90" height="320" fill="#E5E7EB" />
        <rect x="90" y="0" width="150" height="60" fill="#D6DCEC" />
        <rect x="98" y="18" width="100" height="14" fill="#1a1916" />
        <rect x="98" y="38" width="70" height="6" fill="#4c4c4c" />
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x="10" y={28 + i * 18} width="70" height="6" fill="#9CA3AF" opacity={i % 3 === 0 ? 1 : 0.6} />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={i} x="100" y={76 + i * 14} width={i % 4 === 0 ? 100 : 130} height={i % 4 === 0 ? 8 : 4} fill={i % 4 === 0 ? '#1a1916' : '#4B5563'} opacity={i % 4 === 0 ? 1 : 0.7} />
        ))}
      </svg>
    ),
  },
  {
    id: 'template-classic',
    label: 'Executive',
    description: 'Right sidebar, monochrome. Best for senior / leadership / long histories.',
    preview: (
      <svg viewBox="0 0 240 320" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <rect width="240" height="320" fill="#fff" />
        <rect x="0" y="0" width="240" height="60" fill="#F3F4F6" />
        <rect x="15" y="18" width="100" height="18" fill="#1a1916" />
        <rect x="15" y="42" width="60" height="6" fill="#6B7280" />
        <rect x="170" y="14" width="55" height="6" fill="#1a1916" />
        <rect x="160" y="26" width="65" height="4" fill="#4c4c4c" />
        <rect x="170" y="34" width="55" height="4" fill="#4c4c4c" />
        <rect x="155" y="42" width="70" height="4" fill="#4c4c4c" />
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={`l${i}`} x="15" y={76 + i * 14} width={i % 4 === 0 ? 80 : 130} height={i % 4 === 0 ? 6 : 4} fill={i % 4 === 0 ? '#1a1916' : '#4c4c4c'} opacity={i % 4 === 0 ? 1 : 0.7} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={`r${i}`} x="160" y={76 + i * 16} width={i % 3 === 0 ? 60 : 70} height={i % 3 === 0 ? 7 : 5} fill={i % 3 === 0 ? '#1a1916' : '#6B7280'} />
        ))}
      </svg>
    ),
  },
  {
    id: 'template-ats-safe',
    label: 'ATS Safe',
    description: 'Plain single-column, no icons or sidebars. Best for portals (Workday, Greenhouse, LinkedIn Easy Apply) where a parser reads first.',
    preview: (
      <svg viewBox="0 0 240 320" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <rect width="240" height="320" fill="#fff" />
        <rect x="20" y="20" width="140" height="14" fill="#1a1916" />
        <rect x="20" y="40" width="90" height="6" fill="#4c4c4c" />
        <rect x="20" y="52" width="170" height="4" fill="#6B7280" />
        <rect x="20" y="66" width="200" height="0.75" fill="#1a1916" />
        {Array.from({ length: 5 }).map((_, blk) => (
          <g key={blk}>
            <rect x="20" y={84 + blk * 46} width="60" height="8" fill="#1a1916" />
            <rect x="20" y={96 + blk * 46} width="200" height="0.5" fill="#1a1916" />
            {Array.from({ length: 3 }).map((_, line) => (
              <rect
                key={line}
                x="28"
                y={106 + blk * 46 + line * 8}
                width={line === 0 ? 180 : 160}
                height={4}
                fill="#4c4c4c"
                opacity={0.7}
              />
            ))}
          </g>
        ))}
      </svg>
    ),
  },
];

export default function TemplatePicker({ value, onChange, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-sm grid place-items-center p-6">
      <div className="card w-full max-w-4xl">
        <div className="flex items-center justify-between p-6 border-b border-cream-200">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1">Step 01</div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Choose a PDF template</h2>
            <div className="text-sm text-ink-500 mt-1">
              Pick the look for your final PDF. You can change this any time before export.
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="grid md:grid-cols-3 gap-5 p-6">
          {TEMPLATES.map((t) => {
            const active = value === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  onClose();
                }}
                className={`text-left rounded-2xl border p-5 transition group ${
                  active
                    ? 'border-ink-950 bg-cream-50/80 ring-2 ring-ink-950'
                    : 'border-cream-200 bg-white hover:border-ink-300'
                }`}
              >
                <div className="aspect-[3/4] rounded-xl overflow-hidden border border-cream-200 bg-white">
                  {t.preview}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg font-bold tracking-tight">{t.label}</div>
                    <div className="text-xs text-ink-500 mt-0.5 max-w-xs">{t.description}</div>
                  </div>
                  {active && <span className="chip chip-match">Selected</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { TEMPLATES };
