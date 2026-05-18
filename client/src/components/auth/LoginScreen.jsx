import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import { api } from '../../api/client.js';

// Three sign-in paths, surfaced based on what the server supports:
//   - Google OAuth (always shown when AUTH_PROVIDER=google)
//   - Email + password (always available — gated by the preapproved-emails list)
//   - Dev shortcut (only when AUTH_PROVIDER!=google AND we're in dev mode)
// The user toggles between Sign in / Sign up for the email+password form.
export default function LoginScreen() {
  const authProvider = useAppStore((s) => s.authProvider);
  const signinDev = useAppStore((s) => s.signinDev);
  const signinPassword = useAppStore((s) => s.signinPassword);
  const signupPassword = useAppStore((s) => s.signupPassword);

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'dev'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const showGoogle = authProvider === 'google';
  // Dev shortcut is only meaningful when Google isn't configured — otherwise
  // it'd be confusing to offer "any email, no password" alongside real auth.
  const showDevShortcut = authProvider !== 'google';

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) return setErr('Please enter an email.');

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        if (!password) { setErr('Enter your password.'); return; }
        await signinPassword(cleanEmail, password);
      } else if (mode === 'signup') {
        if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
        await signupPassword(cleanEmail, name.trim(), password);
      } else if (mode === 'dev') {
        await signinDev(cleanEmail, name.trim());
      }
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
          {/* Visual crop: zoom into the mirror, hiding the source image's
              surrounding whitespace without needing to edit the file. */}
          <div className="h-32 w-32 mx-auto mb-3 overflow-hidden flex items-center justify-center">
            <img
              src="/logo1.png"
              alt=""
              className="w-full h-full object-contain scale-150"
              aria-hidden="true"
            />
          </div>
          <div className="font-display text-3xl font-bold tracking-tight text-ink-950 mb-2">
            CV Mirror <span className="accent-script text-4xl ml-0.5">AI</span>
          </div>
          <p className="text-sm text-ink-500">
            Sign in to tailor your CV to any job, side-by-side with the description.
          </p>
        </div>

        {showGoogle && (
          <>
            <a href={api.googleSigninUrl()} className="btn-primary w-full">
              <svg viewBox="0 0 18 18" className="h-4 w-4">
                <path
                  fill="#fff"
                  d="M9 7.5v3h4.2c-.2 1.1-1.4 3.2-4.2 3.2-2.5 0-4.6-2.1-4.6-4.7S6.5 4.3 9 4.3c1.4 0 2.4.6 3 1.1l2-2C12.7 2.2 11 1.5 9 1.5 4.9 1.5 1.5 4.9 1.5 9s3.4 7.5 7.5 7.5c4.3 0 7.2-3 7.2-7.3 0-.5 0-.9-.1-1.2H9z"
                />
              </svg>
              Sign in with Google
            </a>
            <Divider label="or" />
          </>
        )}

        {/* Email + password form. Switches between sign-in and sign-up modes. */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode !== 'dev' && (
            <div className="flex gap-1 mb-1">
              <ModeTab active={mode === 'signin'} onClick={() => { setMode('signin'); setErr(null); }}>
                Sign in
              </ModeTab>
              <ModeTab active={mode === 'signup'} onClick={() => { setMode('signup'); setErr(null); }}>
                Sign up
              </ModeTab>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5 font-semibold">
              Email
            </label>
            <input
              type="email"
              autoFocus
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-light"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5 font-semibold">
                Name <span className="text-ink-300 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="input-light"
              />
            </div>
          )}

          {mode !== 'dev' && (
            <div>
              <label className="block text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5 font-semibold">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                className="input-light"
              />
            </div>
          )}

          {mode === 'dev' && (
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
          )}

          {err && <div className="text-xs text-rose-600">{err}</div>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : mode === 'signup' ? 'Create account →'
              : mode === 'dev' ? 'Continue →'
              : 'Sign in →'}
          </button>

          {mode === 'signup' && (
            <p className="text-[11px] text-ink-400 text-center pt-1 leading-relaxed">
              Sign-up is invitation-only. The admin must add your email to the
              pre-approved list before you can create an account.
            </p>
          )}

          {showDevShortcut && mode !== 'dev' && (
            <p className="text-[11px] text-ink-400 text-center pt-1">
              Local dev?{' '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-ink-700"
                onClick={() => { setMode('dev'); setErr(null); setPassword(''); }}
              >
                Use the email-only dev shortcut
              </button>
            </p>
          )}
          {mode === 'dev' && (
            <p className="text-[11px] text-ink-400 text-center pt-1">
              <button
                type="button"
                className="underline underline-offset-2 hover:text-ink-700"
                onClick={() => { setMode('signin'); setErr(null); }}
              >
                ← Back to email + password
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-cream-200" />
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400">{label}</div>
      <div className="flex-1 h-px bg-cream-200" />
    </div>
  );
}

function ModeTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-ink-950 text-cream-50'
          : 'bg-white text-ink-500 hover:text-ink-950 border border-cream-200'
      }`}
    >
      {children}
    </button>
  );
}
