import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

// Modal for the admin to approve / revoke users. Shows two lists: pending
// (clear call-to-action: Approve) and approved (with a Revoke link). Admins
// themselves appear in the approved list with a badge but no revoke button.
export default function AdminPanel({ onClose }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [preapproved, setPreapproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null); // id (or email) of the row being mutated
  const [newEmail, setNewEmail] = useState('');

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const [users, pre] = await Promise.all([
        api.adminListUsers(),
        api.adminListPreapproved(),
      ]);
      setPending(users.pending || []);
      setApproved(users.approved || []);
      setPreapproved(pre.emails || []);
    } catch (e) {
      setErr(e.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function addPreapproved() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(`add:${email}`);
    try {
      await api.adminAddPreapproved(email);
      setNewEmail('');
      await refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function removePreapproved(email) {
    setBusy(`rm:${email}`);
    try {
      await api.adminRemovePreapproved(email);
      await refresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }

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

        <section className="mb-6">
          <h3 className="text-sm font-semibold text-ink-950 mb-1">
            Pre-approved emails <span className="text-ink-400 text-xs font-normal">({preapproved.length})</span>
          </h3>
          <p className="text-[11px] text-ink-500 mb-3 leading-relaxed">
            Anyone in this list can sign up with email + password (no waiting
            room), or Google-sign-in straight into the app.
          </p>

          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPreapproved(); } }}
              placeholder="email@example.com"
              className="input-light flex-1"
            />
            <button
              onClick={addPreapproved}
              disabled={!newEmail.trim() || busy?.startsWith('add:')}
              className="btn-primary text-xs px-3"
            >
              {busy?.startsWith('add:') ? '…' : 'Add'}
            </button>
          </div>

          {preapproved.length === 0 ? (
            <div className="text-xs text-ink-400 italic">No pre-approved emails yet.</div>
          ) : (
            <ul className="divide-y divide-cream-200 rounded-xl border border-cream-200 overflow-hidden">
              {preapproved.map((p) => (
                <li key={p.email} className="flex items-center justify-between gap-3 p-2.5 bg-white">
                  <div className="text-ink-950 truncate font-mono text-xs">{p.email}</div>
                  <button
                    onClick={() => removePreapproved(p.email)}
                    disabled={busy === `rm:${p.email}`}
                    className="text-xs text-rose-600 hover:underline whitespace-nowrap"
                  >
                    {busy === `rm:${p.email}` ? '…' : 'Remove'}
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
