import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import SQLiteStoreFactory from 'connect-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import './db/init.js'; // ensures the DB file + tables exist before anything else
import { userStore } from './services/userStore.js';
import cvRoutes from './routes/cvRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import authRoutes, { publicUser } from './routes/authRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0'; // bind on all interfaces so Fly/proxies can reach us
const isProd = process.env.NODE_ENV === 'production';

// Production safety checks — fail loud at boot rather than silently shipping
// a misconfigured deploy. Each check prints a clear actionable warning; the
// truly dangerous ones throw so the process exits and the deploy fails fast.
if (isProd) {
  const fatal = [];
  const warn = [];
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    fatal.push('SESSION_SECRET must be set to a random string of ≥ 32 characters.');
  }
  if (!process.env.CRYPTO_SECRET || process.env.CRYPTO_SECRET.length < 32) {
    fatal.push('CRYPTO_SECRET must be set to a random string of ≥ 32 characters.');
  }
  if (!process.env.ADMIN_EMAIL) {
    warn.push('ADMIN_EMAIL is not set — nobody will be auto-approved as admin on first sign-in.');
  }
  if (process.env.AUTH_PROVIDER !== 'google'
      && String(process.env.ALLOW_DEV_SIGNIN_IN_PROD || '').toLowerCase() !== 'true') {
    warn.push('AUTH_PROVIDER is not "google" in production — dev sign-in is BLOCKED. Nobody can sign in until you configure Google OAuth (or set ALLOW_DEV_SIGNIN_IN_PROD=true).');
  }
  if (process.env.AI_PROVIDER === 'openai' && !process.env.OPENAI_API_KEY) {
    warn.push('AI_PROVIDER=openai but OPENAI_API_KEY is not set — analyze/critique will fail with 503.');
  }
  for (const w of warn) console.warn('[boot warning]', w);
  if (fatal.length) {
    for (const f of fatal) console.error('[boot FATAL]', f);
    throw new Error('Refusing to start: fix the boot errors above.');
  }
}

// DATA_DIR is where SQLite + the sessions DB live. In dev → server/data. In
// production on Fly → mounted volume at /data so the database survives deploys.
// UPLOAD_DIR holds temporary multer files only — no persistence required.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
for (const p of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const app = express();

// In production, place the reverse proxy in front; trust it so secure cookies work.
if (isProd) app.set('trust proxy', 1);

// Sessions backed by SQLite. Same DB file pattern; sessions live in
// server/data/sessions.db so they survive restarts.
const SQLiteStore = SQLiteStoreFactory(session);
app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: DATA_DIR }),
    secret: process.env.SESSION_SECRET || 'dev-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Passport plumbing. Serialize the user id only; rehydrate via userStore.
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  try {
    const u = userStore.findById(id);
    if (!u) return done(null, false);
    done(null, u);
  } catch (err) {
    done(err);
  }
});

// Configure Google strategy only when credentials are present.
if (process.env.AUTH_PROVIDER === 'google') {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/api/auth/google/callback`;
  if (!clientID || !clientSecret) {
    console.warn(
      '[auth] AUTH_PROVIDER=google but GOOGLE_CLIENT_ID/SECRET are missing. Google sign-in will fail.'
    );
  } else {
    passport.use(
      new GoogleStrategy(
        { clientID, clientSecret, callbackURL },
        (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('Google profile missing email'));
            const user = userStore.upsertFromGoogle({
              sub: profile.id,
              email,
              name: profile.displayName,
              picture: profile.photos?.[0]?.value,
            });
            done(null, user);
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  const model = provider === 'openai' ? (process.env.OPENAI_MODEL || 'gpt-4o') : null;
  res.json({
    ok: true,
    provider,
    model,
    authProvider: process.env.AUTH_PROVIDER || 'dev',
    user: publicUser(req.user),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api', analysisRoutes);
app.use('/api/export', exportRoutes);

// In production, serve the built React client from this same Node process so
// the API and the SPA share an origin (no CORS, cookies just work). The
// client build output lives at <repo>/client/dist after `npm run build`.
// In dev we leave this off — vite's dev server proxies /api to us.
if (isProd) {
  const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    // SPA fallback: any non-/api GET that hasn't been handled yet returns
    // index.html so client-side routing works on direct URLs / refresh.
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn(`[server] NODE_ENV=production but ${clientDist} is missing — run "npm run build" in client/.`);
  }
}

app.use((err, req, res, _next) => {
  // Be defensive: openai SDK and other libs sometimes throw non-Error values
  // (objects, strings) or have nested `.response.data` payloads. Build a
  // best-effort, always-stringy error body so the client never sees an empty
  // 500 again.
  const status = (err && (err.status || err.statusCode)) || 500;
  const message =
    (err && (err.message || err.error?.message)) ||
    (typeof err === 'string' ? err : null) ||
    'Internal error';
  const code = err && (err.code || err.error?.code);
  console.error(`[server error] ${req?.method} ${req?.originalUrl} →`, err);
  res.status(status).json({ error: String(message), code });
});

// Last-line-of-defense: anything that escapes route handlers (e.g. promise
// rejections that bypassed try/catch) shouldn't take the process down silently.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

app.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`CV Mirror server listening on http://${displayHost}:${PORT}`);
  console.log(`AI provider: ${process.env.AI_PROVIDER || 'mock'} | Auth: ${process.env.AUTH_PROVIDER || 'dev'} | Data: ${DATA_DIR}`);
});
