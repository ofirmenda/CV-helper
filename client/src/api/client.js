// All requests include credentials so the session cookie (set by passport on
// sign-in) rides along. Without this, the browser drops the cookie and every
// /api call comes back 401.
async function request(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    credentials: 'include',
    ...opts,
  });
  // Read the body ONCE as text, then try to parse — calling res.json() and
  // res.text() both consume the stream, so chaining them throws
  // "body stream already read" and masks the real error.
  const raw = await res.text().catch(() => '');
  let body = null;
  if (raw) {
    try { body = JSON.parse(raw); } catch { /* non-JSON response — body stays null */ }
  }
  if (!res.ok) {
    const message = body?.error || raw || `Request failed: ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.code = body?.code;
    throw err;
  }
  return body ?? {};
}

export const api = {
  // --- auth + settings ---
  health: () => request('/api/health'),
  me: () => request('/api/auth/me'),
  devSignin: (email, name) =>
    request('/api/auth/dev-signin', { method: 'POST', body: JSON.stringify({ email, name }) }),
  signup: (email, name, password) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, name, password }) }),
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  googleSigninUrl: () => '/api/auth/google',

  getSettings: () => request('/api/settings'),
  setTemplateOnServer: (template) =>
    request('/api/settings/template', { method: 'PUT', body: JSON.stringify({ template }) }),
  setTargetMarketOnServer: (targetMarket) =>
    request('/api/settings/target-market', { method: 'PUT', body: JSON.stringify({ targetMarket }) }),
  completeOnboardingOnServer: () =>
    request('/api/settings/complete-onboarding', { method: 'POST' }),

  // --- admin ---
  adminListUsers: () => request('/api/admin/users'),
  adminApprove: (id) => request(`/api/admin/users/${id}/approve`, { method: 'POST' }),
  adminRevoke: (id) => request(`/api/admin/users/${id}/revoke`, { method: 'POST' }),
  adminListPreapproved: () => request('/api/admin/preapproved'),
  adminAddPreapproved: (email) =>
    request('/api/admin/preapproved', { method: 'POST', body: JSON.stringify({ email }) }),
  adminRemovePreapproved: (email) =>
    request(`/api/admin/preapproved/${encodeURIComponent(email)}`, { method: 'DELETE' }),

  // --- core data ---
  getCv: () => request('/api/cv'),
  saveCv: (cv) => request('/api/cv', { method: 'PUT', body: JSON.stringify({ cv }) }),
  uploadCv: async (file, targetMarket = 'global') => {
    const formData = new FormData();
    formData.append('file', file);
    if (targetMarket) formData.append('targetMarket', targetMarket);
    const res = await fetch('/api/cv/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(detail.error || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
  // `opts` accepts { confirmedAbsent: string[], githubEvidence: Array<{keyword, repo, source, evidence, url}> }
  // sent by the Missing-Keywords Q&A so the LLM can respect "no" answers and
  // use GitHub findings as evidence when re-analyzing.
  analyze: (cv, jd, userContext, opts = {}) =>
    request('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ cv, jd, userContext, ...opts }),
    }),
  critique: (cv, jd) =>
    request('/api/critique', { method: 'POST', body: JSON.stringify({ cv, jd }) }),
  latestResult: () => request('/api/analyze/latest'),
  githubInvestigate: (username, keywords) =>
    request('/api/github-investigate', { method: 'POST', body: JSON.stringify({ username, keywords }) }),
  githubProfile: (username) =>
    request('/api/github-profile', { method: 'POST', body: JSON.stringify({ username }) }),
  matchProjectsToRepos: (username, projects) =>
    request('/api/projects-to-repos', { method: 'POST', body: JSON.stringify({ username, projects }) }),
  exportPdf: async (cv, template, opts = {}) => {
    const res = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cv, template, onePage: opts.onePage === true }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(detail.error || `PDF export failed: ${res.status}`);
    }
    return res.blob();
  },
  exportMarkdown: async (cv) => {
    const res = await fetch('/api/export/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cv }),
    });
    if (!res.ok) throw new Error('Markdown export failed');
    return res.text();
  },
  exportPlainText: async (cv) => {
    const res = await fetch('/api/export/plaintext', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cv }),
    });
    if (!res.ok) throw new Error('Plain-text export failed');
    return res.text();
  },
};
