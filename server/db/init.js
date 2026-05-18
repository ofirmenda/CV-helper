// SQLite schema for CV Mirror AI.
// Single-file database at server/data/cv-mirror.db. We use synchronous
// better-sqlite3 because Node handles request concurrency at a level above the
// DB, and the sync API is dramatically simpler than the async alternatives.
//
// Tables:
//   users       — one row per signed-in user (approval-gated; one admin)
//   user_cv     — exactly one row per user (their base CV)
//   user_result — exactly one row per user (their latest analyze result)
//   sessions    — handled by connect-sqlite3 in a separate file (sessions.db)

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR can be overridden via env so we can point at a mounted volume in
// production (e.g. Fly's /data). Defaults to server/data for local dev.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'cv-mirror.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub                  TEXT UNIQUE,
    email                       TEXT NOT NULL UNIQUE,
    name                        TEXT,
    picture                     TEXT,
    openai_api_key_encrypted    TEXT,
    target_market               TEXT NOT NULL DEFAULT 'global',
    template                    TEXT,
    onboarded_at                INTEGER,
    is_admin                    INTEGER NOT NULL DEFAULT 0,
    is_approved                 INTEGER NOT NULL DEFAULT 0,
    created_at                  INTEGER NOT NULL DEFAULT (unixepoch()),
    last_login_at               INTEGER
  );

  CREATE TABLE IF NOT EXISTS user_cv (
    user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    cv_json   TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS user_result (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    result_json TEXT NOT NULL,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// Idempotent column migrations — if the DB was created before is_admin /
// is_approved existed, add them. Default 0 means existing users are locked out
// until the admin approves them, which is the safe failure mode.
(function migrate() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!cols.includes('is_admin')) {
    db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  }
  if (!cols.includes('is_approved')) {
    db.exec('ALTER TABLE users ADD COLUMN is_approved INTEGER NOT NULL DEFAULT 0');
  }
})();

// Promote the configured admin email to is_admin + is_approved on every boot.
// Run idempotently so changing ADMIN_EMAIL during dev re-promotes the new one.
const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
if (adminEmail) {
  db.prepare(
    'UPDATE users SET is_admin = 1, is_approved = 1 WHERE LOWER(email) = ?'
  ).run(adminEmail);
}

// One-shot template-ID rename migration. Old IDs (template-ofir / template-tali)
// were named after specific people; renamed to neutral labels. Existing users
// in the DB had their template column pointing at the old IDs; remap so they
// don't end up with a stale, unrecognized value.
db.prepare("UPDATE users SET template = 'template-modern' WHERE template = 'template-ofir'").run();
db.prepare("UPDATE users SET template = 'template-classic' WHERE template = 'template-tali'").run();

export default db;
export { DB_PATH, DATA_DIR };
