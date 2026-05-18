import { useAppStore } from '../../store/useAppStore.js';

export default function TopBar({ onOpenSettings }) {
  const provider = useAppStore((s) => s.provider);
  const model = useAppStore((s) => s.model);
  const status = useAppStore((s) => s.status);
  const targetMarket = useAppStore((s) => s.targetMarket);
  const setTargetMarket = useAppStore((s) => s.setTargetMarket);
  const user = useAppStore((s) => s.user);
  const isAdmin = useAppStore((s) => s.isAdmin);

  return (
    <header className="px-6 pt-10 pb-6 relative">
      {/* Identity pill — top-right corner. Clicking opens settings. */}
      {user && (
        <button
          onClick={onOpenSettings}
          className="absolute top-6 right-6 inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white px-2.5 py-1 text-xs text-ink-700 hover:border-cream-300 transition shadow-soft"
          title="Account settings"
        >
          <Avatar user={user} />
          <span className="hidden sm:inline max-w-[140px] truncate">
            {user.name || user.email}
          </span>
          {isAdmin && (
            <span
              className="text-[9px] uppercase tracking-wider bg-ink-950 text-cream-50 rounded-full px-1.5 py-0.5"
              title="You're an admin"
            >
              Admin
            </span>
          )}
        </button>
      )}

      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-2">
          <img
            src="/logo.png"
            alt=""
            className="h-12 w-12 object-contain"
            aria-hidden="true"
          />
          <div className="font-display text-3xl font-bold tracking-tight text-ink-950">
            CV Mirror <span className="accent-script text-4xl ml-0.5">AI</span>
          </div>
        </div>
        <div className="text-sm text-ink-500 flex items-center gap-2.5 flex-wrap justify-center max-w-2xl">
          <span>Reflect your CV through the job description.</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-white border border-cream-200 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-700"
            title={model ? `Using ${model}` : `Provider: ${provider}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${provider === 'openai' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {provider}
            {model && <span className="text-ink-400 normal-case ml-1">· {model}</span>}
          </span>
          <MarketSwitch value={targetMarket} onChange={setTargetMarket} />
          {status === 'analyzing' && (
            <span className="text-xs text-ink-500 animate-pulse">· Analyzing</span>
          )}
        </div>
      </div>
    </header>
  );
}

function Avatar({ user }) {
  if (user?.picture) {
    return <img src={user.picture} alt="" className="h-5 w-5 rounded-full object-cover" />;
  }
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="h-5 w-5 rounded-full bg-ink-950 text-cream-50 grid place-items-center text-[10px] font-semibold">
      {initial}
    </span>
  );
}

function MarketSwitch({ value, onChange }) {
  const options = [
    { id: 'global', label: 'Global' },
    { id: 'israel', label: 'Israel' },
  ];
  return (
    <span
      className="inline-flex items-center rounded-full border border-cream-200 bg-white p-0.5"
      title="Tailors the editor + AI for your target job market."
    >
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-full transition ${
            value === o.id ? 'bg-ink-950 text-cream-50' : 'text-ink-500 hover:text-ink-950'
          }`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
