// Authentication middleware.
//   requireAuth     — session exists.
//   requireApproved — session exists AND the user is approved by an admin.
//   requireAdmin    — session exists AND the user is flagged as admin.
//
// Reads from passport's req.user (populated by deserializeUser).

export function requireAuth(req, res, next) {
  if (req.user && req.user.id) return next();
  return res.status(401).json({ error: 'Not signed in' });
}

export function requireApproved(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  if (!req.user.is_approved) {
    // 403 with a specific code so the client can show the "waiting for approval"
    // screen instead of treating it as a generic auth failure.
    return res
      .status(403)
      .json({ error: 'Account pending admin approval.', code: 'NOT_APPROVED' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admins only.', code: 'NOT_ADMIN' });
  }
  next();
}
