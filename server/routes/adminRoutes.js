// Admin-only endpoints for managing user approval.
//   GET  /api/admin/users           — list pending + approved users
//   POST /api/admin/users/:id/approve
//   POST /api/admin/users/:id/revoke
//
// All routes gated by requireAdmin; the admin flag is set at boot for the
// email in ADMIN_EMAIL (see server/db/init.js).

import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { userStore } from '../services/userStore.js';

const router = Router();

router.use(requireAdmin);

function present(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

router.get('/users', (req, res) => {
  const pending = userStore.listPendingUsers().map(present);
  const approved = userStore.listApprovedUsers().map(present);
  res.json({ pending, approved });
});

router.post('/users/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const target = userStore.findById(id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  userStore.setApproved(id, true);
  res.json({ ok: true });
});

// --- Pre-approved email allowlist ---
// Emails here can sign up via /api/auth/signup without admin approval
// afterwards, and Google sign-ins from these addresses skip the waiting room.

router.get('/preapproved', (_req, res) => {
  res.json({ emails: userStore.listPreapprovedEmails() });
});

router.post('/preapproved', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Provide a valid email.' });
  }
  userStore.addPreapprovedEmail(email, req.user.id);
  res.json({ ok: true });
});

router.delete('/preapproved/:email', (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Provide an email.' });
  userStore.removePreapprovedEmail(email);
  res.json({ ok: true });
});

router.post('/users/:id/revoke', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const target = userStore.findById(id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  // Don't let an admin accidentally revoke themselves — they'd be locked out
  // of their own panel until another admin (or a DB edit) reinstated them.
  if (target.is_admin) {
    return res.status(400).json({ error: 'Cannot revoke an admin.' });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot revoke yourself.' });
  }
  userStore.setApproved(id, false);
  res.json({ ok: true });
});

export default router;
