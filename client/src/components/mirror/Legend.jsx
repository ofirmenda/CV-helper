export default function Legend() {
  return (
    <div className="w-full">
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-2 text-center">Legend</div>
      <div className="flex items-center justify-center gap-4 text-xs text-ink-700">
        <Item color="#22c55e" label="Matched" />
        <Item color="#eab308" label="Partial" />
        <Item color="#ef4444" label="Missing" />
      </div>
    </div>
  );
}

function Item({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
