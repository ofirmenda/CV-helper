import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import { api } from '../../api/client.js';

// Renders either the Google sign-in button (production / AUTH_PROVIDER=google)
// or the dev email shortcut (AUTH_PROVIDER=dev). The decision is driven by
// /api/health → authProvider, which loadAuth() already pulled into the store.
export default function LoginScreen() {
  const authProvider = useAppStore((s) => s.authProvider);
  const signinDev = useAppStore((s) => s.signinDev);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  async function handleDevSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (!email.trim()) return setErr('Please enter an email.');
    setSubmitting(true);
    try {
      await signinDev(email.trim(), name.trim());
    } catch (e2) {
      setErr(e2.message || 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt=""
            className="h-20 w-20 mx-auto mb-3 object-contain"
            aria-hidden="true"
          />
          <div className="font-display text-3xl font-bold tracking-tight text-ink-950 mb-2">
            CV Mirror <span className="accent-script text-4xl ml-0.5">AI</span>
          </div>
          <p className="text-sm text-ink-500">
            Sign in to tailor your CV to any job, side-by-side with the description.
          </p>
        </div>

        {authProvider === 'google' && (
          <a href={api.googleSigninUrl()} className="btn-primary w-full">
            <svg viewBox="0 0 18 18" className="h-4 w-4">
              <path
                fill="#fff"
                d="M9 7.5v3h4.2c-.2 1.1-1.4 3.2-4.2 3.2-2.5 0-4.6-2.1-4.6-4.7S6.5 4.3 9 4.3c1.4 0 2.4.6 3 1.1l2-2C12.7 2.2 11 1.5 9 1.5 4.9 1.5 1.5 4.9 1.5 9s3.4 7.5 7.5 7.5c4.3 0 7.2-3 7.2-7.3 0-.5 0-.9-.1-1.2H9z"
              />
            </svg>
            Sign in with Google
          </a>
        )}

        {authProvider !== 'google' && (
          <form onSubmit={handleDevSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5 font-semibold">
                Email
              </label>
              <input
                type="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-light"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5 font-semibold">
                Name <span className="text-ink-300 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="input-light"
              />
            </div>
            {err && <div className="text-xs text-rose-600">{err}</div>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Signing in…' : 'Continue →'}
            </button>
            <p className="text-[11px] text-ink-400 text-center pt-1 leading-relaxed">
              Dev mode — no password required. Each email gets its own private CV and OpenAI key.
              Switch to Google sign-in by setting <code className="text-ink-700">AUTH_PROVIDER=google</code> in <code className="text-ink-700">server/.env</code>.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
