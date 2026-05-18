import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import AdminPanel from './AdminPanel.jsx';

// Opened from the TopBar user pill. Shows the signed-in identity, the provider
// the server is using, and a sign-out button. Admins additionally see a
// "Manage users" link that opens the AdminPanel modal on top of this one.
export default function SettingsModal({ onClose }) {
  const user = useAppStore((s) => s.user);
  const provider = useAppStore((s) => s.provider);
  const model = useAppStore((s) => s.model);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const signout = useAppStore((s) => s.signout);

  const [adminOpen, setAdminOpen] = useState(false);

  async function handleSignOut() {
    await signout();
    onClose?.();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm grid place-items-center p-6" onClick={onClose}>
        <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1 font-semibold">Account</div>
              <h2 className="font-display text-2xl font-bold text-ink-950 flex items-center gap-2">
                {user?.name || user?.email || 'You'}
                {isAdmin && (
                  <span className="text-[9px] uppercase tracking-wider bg-ink-950 text-cream-50 rounded-full px-1.5 py-0.5">
                    Admin
                  </span>
                )}
              </h2>
              {user?.email && user?.name && (
                <div className="text-xs text-ink-500 mt-0.5">{user.email}</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-ink-400 hover:text-ink-950 transition text-xl leading-none"
              aria-label="Close settings"
            >
              ×
            </button>
          </div>

          <section className="mb-5 text-xs text-ink-500 leading-relaxed">
            AI provider:{' '}
            <span className="font-semibold text-ink-700">{provider}</span>
            {model && <> · model <span className="font-semibold text-ink-700">{model}</span></>}.
            {' '}The OpenAI key is configured by the admin and shared across approved users — you don't need your own.
          </section>

          {isAdmin && (
            <section className="mb-5">
              <button
                onClick={() => setAdminOpen(true)}
                className="btn-ghost w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Manage user access
                </span>
                <span className="text-ink-400">→</span>
              </button>
            </section>
          )}

          <section className="border-t border-cream-200 pt-4 flex items-center justify-between">
            <span className="text-xs text-ink-400">Done? Close this window.</span>
            <button onClick={handleSignOut} className="btn-ghost text-rose-600 hover:text-rose-700">
              Sign out
            </button>
          </section>
        </div>
      </div>

      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
    </>
  );
}
