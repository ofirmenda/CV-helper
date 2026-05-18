import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

// Modal for the admin to approve / revoke users. Shows two lists: pending
// (clear call-to-action: Approve) and approved (with a Revoke link). Admins
// themselves appear in the approved list with a badge but no revoke button.
export default function AdminPanel({ onClose }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null); // id of the row currently being mutated

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const out = await api.adminListUsers();
      setPending(out.pending || []);
      setApproved(out.approved || []);
    } catch (e) {
      setErr(e.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function approve(id) {
    setBusy(id);
    try { await api.adminApprove(id); await refresh(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function revoke(id) {
    if (!confirm('Revoke access for this user? They will be blocked until you re-approve them.')) return;
    setBusy(id);
    try { await api.adminRevoke(id); await refresh(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink-950/45 backdrop-blur-sm grid place-items-center p-6" onClick={onClose}>
      <div className="card w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1 font-semibold">Admin</div>
            <h2 className="font-display text-2xl font-bold text-ink-950">User access</h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink-950 transition text-xl leading-none"
            aria-label="Close admin panel"
          >
            ×
          </button>
        </div>

        {err && <div className="text-xs text-rose-600 mb-3">{err}</div>}

        <section className="mb-6">
          <h3 className="text-sm font-semibold text-ink-950 mb-2">
            Pending approval <span className="text-ink-400 text-xs font-normal">({pending.length})</span>
          </h3>
          {loading ? (
            <div className="text-xs text-ink-400">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="text-xs text-ink-400 italic">No one is waiting.</div>
          ) : (
            <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200 overflow-hidden">
              {pending.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 p-3 bg-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={u} />
                    <div className="min-w-0">
                      <div className="text-sm text-ink-950 truncate">{u.name || u.email}</div>
                      {u.name && <div className="text-xs text-ink-500 truncate">{u.email}</div>}
                    </div>
                  </div>
                  <button
                    onClick={() => approve(u.id)}
                    disabled={busy === u.id}
                    className="btn-accent text-xs px-3 py-1"
                  >
                    {busy === u.id ? '…' : 'Approve'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink-950 mb-2">
            Approved <span className="text-ink-400 text-xs font-normal">({approved.length})</span>
          </h3>
          {loading ? (
            <div className="text-xs text-ink-400">Loading…</div>
          ) : approved.length === 0 ? (
            <div className="text-xs text-ink-400 italic">No one approved yet.</div>
          ) : (
            <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200 overflow-hidden">
              {approved.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 p-3 bg-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={u} />
                    <div className="min-w-0">
                      <div className="text-sm text-ink-950 truncate flex items-center gap-1.5">
                        {u.name || u.email}
                        {u.isAdmin && (
                          <span className="text-[9px] uppercase tracking-wider bg-ink-950 text-cream-50 rounded-full px-1.5 py-0.5">
                            Admin
                          </span>
                        )}
                      </div>
                      {u.name && <div className="text-xs text-ink-500 truncate">{u.email}</div>}
                    </div>
                  </div>
                  {!u.isAdmin && (
                    <button
                      onClick={() => revoke(u.id)}
                      disabled={busy === u.id}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      {busy === u.id ? '…' : 'Revoke'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Avatar({ user }) {
  if (user?.picture) {
    return <img src={user.picture} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />;
  }
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="h-8 w-8 rounded-full bg-ink-950 text-cream-50 grid place-items-center text-xs font-semibold flex-shrink-0">
      {initial}
    </span>
  );
}
