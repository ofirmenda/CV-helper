// Per-user data layer. Replaces the previous global JSON file storage
// (`cv_base.json`, `latest_result.json`) — each user now has their own
// rows in `user_cv` and `user_result`.

import db from '../db/init.js';
import bcrypt from 'bcryptjs';
import { encryptSecret, decryptSecret } from './cryptoStore.js';
import { seedCv } from './seed.js';

const BCRYPT_ROUNDS = 12; // ~250ms per hash — good speed/safety trade-off

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function adminEmail() {
  return (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
}

// Stamp is_admin + is_approved on the row whose email matches ADMIN_EMAIL.
// Called on every fresh insert so newly-created admin rows are usable right
// away without an out-of-band manual UPDATE.
function autoFlagAdmin(email) {
  const a = adminEmail();
  if (!a) return;
  if (String(email || '').toLowerCase() === a) {
    db.prepare('UPDATE users SET is_admin = 1, is_approved = 1 WHERE LOWER(email) = ?').run(a);
  }
}

const findByEmail = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
const findByGoogleSub = db.prepare('SELECT * FROM users WHERE google_sub = ? LIMIT 1');
const findById = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
const insertUser = db.prepare(
  `INSERT INTO users (google_sub, email, name, picture, last_login_at)
   VALUES (?, ?, ?, ?, unixepoch())`
);
const updateLastLogin = db.prepare('UPDATE users SET last_login_at = unixepoch() WHERE id = ?');
const updateProfile = db.prepare(
  `UPDATE users SET name = COALESCE(?, name), picture = COALESCE(?, picture), google_sub = COALESCE(?, google_sub) WHERE id = ?`
);
const updateOpenAiKey = db.prepare('UPDATE users SET openai_api_key_encrypted = ? WHERE id = ?');
const updateOnboardedAt = db.prepare('UPDATE users SET onboarded_at = unixepoch() WHERE id = ?');
const updateTemplate = db.prepare('UPDATE users SET template = ? WHERE id = ?');
const updateTargetMarket = db.prepare('UPDATE users SET target_market = ? WHERE id = ?');
const updateApproved = db.prepare('UPDATE users SET is_approved = ? WHERE id = ?');
const updatePasswordHash = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const insertPasswordUser = db.prepare(
  `INSERT INTO users (email, name, password_hash, is_approved, last_login_at)
   VALUES (?, ?, ?, ?, unixepoch())`
);

// Preapproved emails table — anyone in here is auto-approved on first sign-in,
// regardless of which auth method they use (Google or password).
const selectPreapproved = db.prepare('SELECT email, added_at FROM preapproved_emails ORDER BY added_at DESC');
const insertPreapproved = db.prepare(
  'INSERT OR IGNORE INTO preapproved_emails (email, added_by_user_id) VALUES (?, ?)'
);
const deletePreapproved = db.prepare('DELETE FROM preapproved_emails WHERE email = ?');
const isPreapprovedStmt = db.prepare('SELECT 1 FROM preapproved_emails WHERE email = ? LIMIT 1');

function isPreapproved(email) {
  return Boolean(isPreapprovedStmt.get(normalizeEmail(email)));
}

// Admin views: pending = unapproved non-admin; approved = approved non-admin.
// Admins themselves are excluded so the list focuses on people the admin can act on.
const selectPending = db.prepare(
  `SELECT id, email, name, picture, created_at, last_login_at, is_admin
     FROM users WHERE is_approved = 0 AND is_admin = 0 ORDER BY created_at DESC`
);
const selectApproved = db.prepare(
  `SELECT id, email, name, picture, created_at, last_login_at, is_admin
     FROM users WHERE is_approved = 1 ORDER BY is_admin DESC, last_login_at DESC`
);

const getCv = db.prepare('SELECT cv_json FROM user_cv WHERE user_id = ?');
const upsertCv = db.prepare(
  `INSERT INTO user_cv (user_id, cv_json, updated_at)
   VALUES (?, ?, unixepoch())
   ON CONFLICT(user_id) DO UPDATE SET cv_json = excluded.cv_json, updated_at = unixepoch()`
);
const getResult = db.prepare('SELECT result_json FROM user_result WHERE user_id = ?');
const upsertResult = db.prepare(
  `INSERT INTO user_result (user_id, result_json, updated_at)
   VALUES (?, ?, unixepoch())
   ON CONFLICT(user_id) DO UPDATE SET result_json = excluded.result_json, updated_at = unixepoch()`
);

export const userStore = {
  findById: (id) => findById.get(id),
  findByEmail: (email) => findByEmail.get(email),
  findByGoogleSub: (sub) => findByGoogleSub.get(sub),

  // Upsert by Google sub or email. Returns the user record.
  upsertFromGoogle: ({ sub, email, name, picture }) => {
    let existing = sub ? findByGoogleSub.get(sub) : null;
    if (!existing && email) existing = findByEmail.get(email);
    if (existing) {
      updateProfile.run(name || null, picture || null, sub || null, existing.id);
      updateLastLogin.run(existing.id);
      autoFlagAdmin(existing.email);
      // If pre-approved retroactively (admin added their email after they signed in once), bring them in.
      if (!existing.is_approved && isPreapproved(existing.email)) {
        updateApproved.run(1, existing.id);
      }
      return findById.get(existing.id);
    }
    const info = insertUser.run(sub || null, email, name || null, picture || null);
    autoFlagAdmin(email);
    // Auto-approve if their email was pre-approved by the admin.
    if (isPreapproved(email)) updateApproved.run(1, info.lastInsertRowid);
    return findById.get(info.lastInsertRowid);
  },

  // Dev-mode bypass: sign in as any email without Google.
  upsertDevUser: ({ email, name }) => {
    let existing = findByEmail.get(email);
    if (existing) {
      updateLastLogin.run(existing.id);
      autoFlagAdmin(existing.email);
      if (!existing.is_approved && isPreapproved(existing.email)) {
        updateApproved.run(1, existing.id);
      }
      return findById.get(existing.id);
    }
    const info = insertUser.run(null, email, name || email.split('@')[0], null);
    autoFlagAdmin(email);
    if (isPreapproved(email)) updateApproved.run(1, info.lastInsertRowid);
    return findById.get(info.lastInsertRowid);
  },

  // --- Email + password auth ---
  // Creates a brand-new password-backed user. The caller (auth route) must
  // already have validated that the email is in the preapproved list, so we
  // mark this user is_approved=1 from the start.
  createPasswordUser: ({ email, name, password }) => {
    const normalized = normalizeEmail(email);
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const info = insertPasswordUser.run(normalized, name || normalized.split('@')[0], hash, 1);
    autoFlagAdmin(normalized);
    return findById.get(info.lastInsertRowid);
  },

  // Verify a password against the stored hash. Returns the user record on
  // success, null on failure. Constant-time-ish via bcrypt.compareSync.
  verifyPassword: ({ email, password }) => {
    const user = findByEmail.get(normalizeEmail(email));
    if (!user || !user.password_hash) return null;
    if (!bcrypt.compareSync(password, user.password_hash)) return null;
    updateLastLogin.run(user.id);
    autoFlagAdmin(user.email);
    if (!user.is_approved && isPreapproved(user.email)) {
      updateApproved.run(1, user.id);
      return findById.get(user.id);
    }
    return user;
  },

  setPassword: (userId, password) => {
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    updatePasswordHash.run(hash, userId);
  },

  // --- Preapproved emails ---
  isPreapproved,
  listPreapprovedEmails: () => selectPreapproved.all(),
  addPreapprovedEmail: (email, byUserId) => {
    insertPreapproved.run(normalizeEmail(email), byUserId || null);
    // If the user already signed in once (and got stuck on Waiting for Approval),
    // approve them now retroactively.
    const existing = findByEmail.get(normalizeEmail(email));
    if (existing && !existing.is_approved) updateApproved.run(1, existing.id);
  },
  removePreapprovedEmail: (email) => deletePreapproved.run(normalizeEmail(email)),

  setOnboarded: (userId) => updateOnboardedAt.run(userId),
  setTemplate: (userId, template) => updateTemplate.run(template, userId),
  setTargetMarket: (userId, targetMarket) => updateTargetMarket.run(targetMarket, userId),

  setOpenAiKey: (userId, plaintextOrNull) => {
    const enc = plaintextOrNull ? encryptSecret(plaintextOrNull) : null;
    updateOpenAiKey.run(enc, userId);
  },
  getOpenAiKey: (userId) => {
    const row = findById.get(userId);
    if (!row || !row.openai_api_key_encrypted) return null;
    return decryptSecret(row.openai_api_key_encrypted);
  },
  hasOpenAiKey: (userId) => {
    const row = findById.get(userId);
    return Boolean(row && row.openai_api_key_encrypted);
  },

  // --- Admin actions ---
  listPendingUsers: () => selectPending.all(),
  listApprovedUsers: () => selectApproved.all(),
  setApproved: (userId, approved) => updateApproved.run(approved ? 1 : 0, userId),

  getCv: (userId) => {
    const row = getCv.get(userId);
    if (!row) return null;
    try { return JSON.parse(row.cv_json); } catch { return null; }
  },
  saveCv: (userId, cv) => upsertCv.run(userId, JSON.stringify(cv)),

  // Seed the user with a starter CV the first time they log in.
  ensureCv: (userId) => {
    const row = getCv.get(userId);
    if (row) return JSON.parse(row.cv_json);
    const seeded = seedCv();
    upsertCv.run(userId, JSON.stringify(seeded));
    return seeded;
  },

  getResult: (userId) => {
    const row = getResult.get(userId);
    if (!row) return null;
    try { return JSON.parse(row.result_json); } catch { return null; }
  },
  saveResult: (userId, result) => upsertResult.run(userId, JSON.stringify(result)),
};
