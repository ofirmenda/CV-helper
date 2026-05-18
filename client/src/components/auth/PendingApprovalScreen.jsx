import { useAppStore } from '../../store/useAppStore.js';

// Signed in but waiting for the admin to flip is_approved=1 on this row.
// Polite holding page. The user can sign out (so a different email can try) or
// just refresh once the admin notifies them. Re-firing /me will move the store
// from 'pending' to 'authed' when the admin acts.
export default function PendingApprovalScreen() {
  const user = useAppStore((s) => s.user);
  const signout = useAppStore((s) => s.signout);
  const loadAuth = useAppStore((s) => s.loadAuth);

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="text-[10px] uppercase tracking-[0.22em] text-amber-600 mb-2 font-semibold">
          Waiting for approval
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink-950 mb-3">
          Access request sent
        </h2>
        <p className="text-sm text-ink-500 leading-relaxed mb-5">
          Thanks for signing in
          {user?.email ? <> as <span className="font-semibold text-ink-700">{user.email}</span></> : null}.
          An admin needs to approve your account before you can use CV Mirror AI.
          You'll get full access once they click <span className="font-semibold text-ink-950">Approve</span>.
        </p>
        <div className="flex items-center gap-3 justify-center">
          <button className="btn-primary" onClick={() => loadAuth()}>
            I've been approved — refresh
          </button>
          <button
            className="text-xs text-ink-400 hover:text-ink-950 underline-offset-2 hover:underline"
            onClick={signout}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
