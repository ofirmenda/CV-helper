import { create } from 'zustand';
import { api } from '../api/client.js';

export const SECTION_ORDER = ['summary', 'skills', 'experience', 'projects', 'achievements', 'education', 'languages'];

const emptyApprovals = () =>
  SECTION_ORDER.reduce((acc, name) => {
    acc[name] = { status: 'pending', finalText: '' };
    return acc;
  }, {});

function buildTailoredCv(cv, approvals, result) {
  if (!cv || !result) return cv;
  const out = JSON.parse(JSON.stringify(cv));
  for (const name of SECTION_ORDER) {
    const decision = approvals?.[name];
    const proposal = result.sections?.[name];
    if (!decision || !proposal) continue;
    if (decision.status === 'pending') continue;
    if (decision.status === 'rejected') continue;
    if (name === 'summary') {
      out.summary = decision.finalText;
    } else if (name === 'skills') {
      out.skills = parseSkillsText(decision.finalText, out.skills);
    } else if (name === 'experience') {
      out.experience = parseExperienceText(decision.finalText, out.experience);
    } else if (name === 'projects') {
      out.projects = parseProjectsText(decision.finalText, out.projects);
    } else if (name === 'achievements') {
      out.achievements = decision.finalText
        .split('\n')
        .map((l) => l.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
    }
  }
  return out;
}

function parseSkillsText(text, fallback) {
  if (!text || !text.trim()) return fallback;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const isGrouped = lines.some((l) => /^[^:]+:\s*.+/.test(l));
  if (isGrouped) {
    return lines
      .map((l) => {
        const m = l.match(/^([^:]+):\s*(.+)$/);
        if (!m) return null;
        return { category: m[1].trim(), items: m[2].split(/,\s*/).map((s) => s.trim()).filter(Boolean) };
      })
      .filter(Boolean);
  }
  return lines;
}

function parseExperienceText(text, fallback) {
  if (!text || !text.trim()) return fallback;
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const headerMatch = lines[0]?.match(/^(.+?)\s*[—-]\s*(.+?)\s*\((.+)\)$/);
    const original = fallback?.[i] || {};
    if (headerMatch) {
      return {
        role: headerMatch[1].trim(),
        company: headerMatch[2].trim(),
        dates: headerMatch[3].trim(),
        bullets: lines.slice(1).map((l) => l.replace(/^[•\-*]\s*/, '')).filter(Boolean),
      };
    }
    return {
      ...original,
      bullets: lines.slice(1).map((l) => l.replace(/^[•\-*]\s*/, '')).filter(Boolean),
    };
  });
}

function parseProjectsText(text, fallback) {
  if (!text || !text.trim()) return fallback;
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const original = fallback?.[i] || {};
    return {
      name: lines[0] || original.name || '',
      description: lines[1] && !lines[1].startsWith('•') && !lines[1].startsWith('-') ? lines[1] : original.description || '',
      bullets: lines
        .slice(lines[1] && !lines[1].startsWith('•') && !lines[1].startsWith('-') ? 2 : 1)
        .map((l) => l.replace(/^[•\-*]\s*/, ''))
        .filter(Boolean),
    };
  });
}

export const useAppStore = create((set, get) => ({
  cv: null,
  jd: '',
  result: null,
  approvals: emptyApprovals(),
  currentSectionIndex: 0,
  mode: 'mirror',
  status: 'idle',
  error: null,
  provider: 'mock',
  model: null,
  critique: null,
  critiqueStatus: 'idle', // 'idle' | 'loading' | 'error'
  critiqueError: null,
  template: (typeof localStorage !== 'undefined' && localStorage.getItem('cvmirror.template')) || null,
  targetMarket:
    (typeof localStorage !== 'undefined' && localStorage.getItem('cvmirror.targetMarket')) || 'global',
  onboardedAt:
    (typeof localStorage !== 'undefined' && localStorage.getItem('cvmirror.onboardedAt')) || null,
  ui: { hoveredKeyword: null },

  // --- Auth state ---
  user: null,
  // 'unknown' | 'authed' | 'pending' | 'guest' — drives the AuthGate routing.
  //   unknown — still figuring out whether you're signed in
  //   pending — signed in but waiting for admin approval (PendingApprovalScreen)
  //   authed  — fully approved, app shell renders
  //   guest   — not signed in, LoginScreen renders
  authStatus: 'unknown',
  authProvider: 'dev', // surfaced from /api/health; controls which login UI to show
  isAdmin: false,

  setCv: (cv) => set({ cv }),
  setJd: (jd) => set({ jd }),
  setMode: (mode) => set({ mode }),
  setTemplate: (template) => {
    if (typeof localStorage !== 'undefined') {
      if (template) localStorage.setItem('cvmirror.template', template);
      else localStorage.removeItem('cvmirror.template');
    }
    set({ template });
    if (template) {
      // Best-effort sync to the server-side user profile; ignore failures so the
      // local pick still works if the network hiccups.
      api.setTemplateOnServer(template).catch(() => {});
    }
  },
  setTargetMarket: (targetMarket) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cvmirror.targetMarket', targetMarket);
    }
    set({ targetMarket });
    api.setTargetMarketOnServer(targetMarket).catch(() => {});
  },
  completeOnboarding: () => {
    const ts = String(Date.now());
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cvmirror.onboardedAt', ts);
    }
    set({ onboardedAt: ts });
    api.completeOnboardingOnServer().catch(() => {});
  },
  setHoveredKeyword: (kw) => set((s) => ({ ui: { ...s.ui, hoveredKeyword: kw } })),
  setCurrentSectionIndex: (i) => set({ currentSectionIndex: i }),

  // --- Auth actions ---
  // Boot sequence: call /api/auth/me; if 401 we're a guest, otherwise hydrate
  // the user profile (template / targetMarket / onboardedAt / hasOpenAiKey) AND
  // pull the CV + latest result. Called once on mount by AuthGate.
  loadAuth: async () => {
    try {
      const health = await api.health().catch(() => null);
      if (health) {
        set({
          provider: health.provider || 'mock',
          model: health.model || null,
          authProvider: health.authProvider || 'dev',
        });
      }
      const { user } = await api.me();
      // Unapproved users stop here — the app shell never mounts. Pending status
      // drives PendingApprovalScreen. Once an admin approves them, a refresh /
      // re-call to /me lands them on `authed`.
      if (!user?.isApproved) {
        set({ user, authStatus: 'pending', isAdmin: Boolean(user?.isAdmin) });
        return;
      }
      // Server is source of truth for profile fields — overlay them on whatever
      // localStorage had so two different users on the same browser don't get
      // crossed wires.
      const patch = {
        user,
        authStatus: 'authed',
        isAdmin: Boolean(user?.isAdmin),
      };
      if (user?.template) {
        patch.template = user.template;
        if (typeof localStorage !== 'undefined') localStorage.setItem('cvmirror.template', user.template);
      }
      if (user?.targetMarket) {
        patch.targetMarket = user.targetMarket;
        if (typeof localStorage !== 'undefined') localStorage.setItem('cvmirror.targetMarket', user.targetMarket);
      }
      if (user?.onboardedAt) {
        patch.onboardedAt = String(user.onboardedAt);
        if (typeof localStorage !== 'undefined') localStorage.setItem('cvmirror.onboardedAt', String(user.onboardedAt));
      }
      set(patch);
      await get().loadInitial();
    } catch (err) {
      if (err.status === 401) {
        set({ authStatus: 'guest', user: null, isAdmin: false });
      } else {
        console.error('loadAuth failed:', err);
        // Still mark as guest so the user sees the login screen rather than a
        // permanent splash — they can retry by submitting credentials.
        set({ authStatus: 'guest', user: null, isAdmin: false, error: err.message });
      }
    }
  },

  signinDev: async (email, name) => {
    const { user } = await api.devSignin(email, name);
    const isAdmin = Boolean(user?.isAdmin);
    if (!user?.isApproved) {
      set({ user, authStatus: 'pending', isAdmin });
      return;
    }
    set({ user, authStatus: 'authed', isAdmin });
    if (user?.template) set({ template: user.template });
    if (user?.targetMarket) set({ targetMarket: user.targetMarket });
    if (user?.onboardedAt) set({ onboardedAt: String(user.onboardedAt) });
    await get().loadInitial();
  },

  signout: async () => {
    try { await api.logout(); } catch (_) { /* best effort */ }
    // Clear every per-user thing in the store; localStorage is intentionally
    // untouched so the next user signing into the same browser still sees
    // their own template / market once /me hydrates.
    set({
      user: null,
      authStatus: 'guest',
      isAdmin: false,
      cv: null,
      result: null,
      jd: '',
      approvals: emptyApprovals(),
      critique: null,
      critiqueStatus: 'idle',
      critiqueError: null,
    });
  },

  loadInitial: async () => {
    // Refresh = fresh slate. We deliberately do NOT pull /api/analyze/latest
    // here — each new session starts with no JD, no keywords, no prior result
    // bleeding through from the previous job. The base CV (persistent across
    // sessions) is the only thing we hydrate.
    try {
      const { cv } = await api.getCv();
      set({
        cv,
        result: null,
        jd: '',
        approvals: emptyApprovals(),
        critique: null,
        critiqueStatus: 'idle',
        critiqueError: null,
      });
    } catch (err) {
      console.error(err);
      set({ error: err.message });
    }
  },

  saveCv: async () => {
    const cv = get().cv;
    if (!cv) return;
    await api.saveCv(cv);
  },

  uploadCv: async (file) => {
    set({ status: 'uploading', error: null });
    try {
      const { targetMarket } = get();
      const { cv } = await api.uploadCv(file, targetMarket);
      set({ cv, status: 'idle' });
      await api.saveCv(cv);
      return cv;
    } catch (err) {
      set({ status: 'idle', error: err.message });
      throw err;
    }
  },

  analyze: async () => {
    const { cv, jd, status, targetMarket } = get();
    if (!cv || !jd) return;
    // Guard against double-clicks landing concurrent calls; the button is also
    // disabled, but this protects against keyboard-repeat / programmatic calls.
    if (status === 'analyzing') return;
    set({ status: 'analyzing', error: null });
    try {
      const cvWithMarket = { ...cv, targetMarket };
      const result = await api.analyze(cvWithMarket, jd);
      if (!result || typeof result !== 'object') {
        throw new Error('Server returned an empty analysis.');
      }
      const approvals = emptyApprovals();
      for (const name of SECTION_ORDER) {
        if (result.sections?.[name]) {
          approvals[name] = { status: 'pending', finalText: result.sections[name].after };
        }
      }
      set({
        result,
        approvals,
        currentSectionIndex: 0,
        provider: result.provider || 'mock',
        status: 'idle',
        error: null,
        // Wipe any previous critique — it was for the prior JD.
        critique: null,
        critiqueStatus: 'idle',
        critiqueError: null,
      });
      try {
        await api.saveCv(cv);
      } catch (e) {
        // Saving the CV is best-effort; surface as a soft warning, don't blow up the analysis.
        console.warn('saveCv failed after analyze:', e);
      }
    } catch (err) {
      console.error('analyze failed:', err);
      // Important: do NOT re-throw. The button's click handler doesn't await us
      // and unhandled rejections were breaking the next render in some cases.
      set({ status: 'idle', error: err.message || 'Analyze failed.' });
    }
  },

  fetchCritique: async () => {
    const { cv, jd, critique, critiqueStatus } = get();
    if (!cv) return;
    if (critique) return; // already loaded for the current analyze cycle
    if (critiqueStatus === 'loading') return;
    set({ critiqueStatus: 'loading', critiqueError: null });
    try {
      const out = await api.critique(cv, jd || '');
      set({ critique: out, critiqueStatus: 'idle' });
    } catch (err) {
      console.error('critique failed:', err);
      set({ critiqueStatus: 'error', critiqueError: err.message || 'Critique failed.' });
    }
  },

  approveSection: (name) => {
    const { result, approvals } = get();
    const proposal = result?.sections?.[name];
    if (!proposal) return;
    set({
      approvals: {
        ...approvals,
        [name]: { status: 'approved', finalText: proposal.after },
      },
    });
    get().advanceSection();
  },

  rejectSection: (name) => {
    const { result, approvals } = get();
    const proposal = result?.sections?.[name];
    if (!proposal) return;
    set({
      approvals: {
        ...approvals,
        [name]: { status: 'rejected', finalText: proposal.before },
      },
    });
    get().advanceSection();
  },

  editSection: (name, text) => {
    const { approvals } = get();
    set({
      approvals: {
        ...approvals,
        [name]: { status: 'edited', finalText: text },
      },
    });
    get().advanceSection();
  },

  skipSection: () => {
    get().advanceSection();
  },

  jumpToSection: (i) => set({ currentSectionIndex: i }),

  advanceSection: () => {
    const { currentSectionIndex, approvals, result } = get();
    const available = SECTION_ORDER.filter((n) => result?.sections?.[n]);
    let next = currentSectionIndex + 1;
    while (next < available.length && approvals[available[next]]?.status !== 'pending') {
      next += 1;
    }
    if (next >= available.length) {
      const firstPending = available.findIndex((n) => approvals[n]?.status === 'pending');
      if (firstPending >= 0) {
        set({ currentSectionIndex: firstPending });
        return;
      }
    }
    set({ currentSectionIndex: Math.min(next, available.length - 1) });
  },

  tailoredCv: () => {
    const { cv, approvals, result } = get();
    return buildTailoredCv(cv, approvals, result);
  },

  resetApprovals: () => {
    const { result } = get();
    const approvals = emptyApprovals();
    for (const name of SECTION_ORDER) {
      if (result?.sections?.[name]) {
        approvals[name] = { status: 'pending', finalText: result.sections[name].after };
      }
    }
    set({ approvals, currentSectionIndex: 0 });
  },
}));

export { buildTailoredCv };
