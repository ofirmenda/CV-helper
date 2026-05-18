// Auth routes:
//   GET  /api/auth/me              — current session user (or 401)
//   GET  /api/auth/google          — kick off OAuth redirect
//   GET  /api/auth/google/callback — Google redirects back here
//   POST /api/auth/dev-signin      — dev-only bypass (when AUTH_PROVIDER=dev)
//   POST /api/auth/logout          — destroy session
//
// Passport is configured in server.js. This file just wires the HTTP surface.

import { Router } from 'express';
import passport from 'passport';
import { userStore } from '../services/userStore.js';

const router = Router();

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    picture: u.picture,
    template: u.template,
    targetMarket: u.target_market,
    onboardedAt: u.onboarded_at,
    isAdmin: Boolean(u.is_admin),
    isApproved: Boolean(u.is_approved),
  };
}

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  const fresh = userStore.findById(req.user.id);
  res.json({ user: publicUser(fresh) });
});

router.get('/google', (req, res, next) => {
  if (process.env.AUTH_PROVIDER !== 'google') {
    return res.status(503).json({ error: 'Google OAuth is not configured on this server. Use the dev sign-in.' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { failureRedirect: '/?auth=failed' }, (err, user) => {
    if (err || !user) return res.redirect('/?auth=failed');
    req.login(user, (loginErr) => {
      if (loginErr) return res.redirect('/?auth=failed');
      res.redirect('/');
    });
  })(req, res, next);
});

router.post('/dev-signin', (req, res) => {
  if (process.env.AUTH_PROVIDER === 'google') {
    return res.status(400).json({ error: 'Dev sign-in disabled when AUTH_PROVIDER=google.' });
  }
  // Guard against accidentally exposing email-only sign-in on a public URL.
  // In NODE_ENV=production we BLOCK this route by default — opening it would
  // let any bot scrape /api/auth/dev-signin and spam-create pending accounts.
  // Override only if you really know what you're doing.
  if (
    process.env.NODE_ENV === 'production' &&
    String(process.env.ALLOW_DEV_SIGNIN_IN_PROD || '').toLowerCase() !== 'true'
  ) {
    return res.status(503).json({
      error:
        'Dev sign-in is disabled in production. Configure AUTH_PROVIDER=google ' +
        'with Google OAuth credentials, or set ALLOW_DEV_SIGNIN_IN_PROD=true to override (not recommended).',
      code: 'DEV_SIGNIN_DISABLED_IN_PROD',
    });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Provide a valid email.' });
  }
  const user = userStore.upsertDevUser({ email, name });
  req.login(user, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ user: publicUser(user) });
  });
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err.message });
    req.session?.destroy(() => res.json({ ok: true }));
  });
});

export default router;
export { publicUser };
