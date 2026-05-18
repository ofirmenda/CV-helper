import { Router } from 'express';
import { requireApproved } from '../middleware/auth.js';
import { userStore } from '../services/userStore.js';
import { maskSecret } from '../services/cryptoStore.js';

const router = Router();

// All settings routes require approved access.
router.use(requireApproved);

router.get('/', (req, res) => {
  const u = userStore.findById(req.user.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const key = u.openai_api_key_encrypted ? userStore.getOpenAiKey(u.id) : null;
  res.json({
    settings: {
      template: u.template || null,
      targetMarket: u.target_market || 'global',
      onboardedAt: u.onboarded_at || null,
      openAiKeyMasked: key ? maskSecret(key) : null,
      hasOpenAiKey: Boolean(key),
    },
  });
});

router.put('/openai-key', (req, res) => {
  const key = String(req.body?.key || '').trim();
  if (!key) {
    userStore.setOpenAiKey(req.user.id, null);
    return res.json({ ok: true, cleared: true });
  }
  if (!/^sk-[A-Za-z0-9_\-]{16,}$/.test(key)) {
    return res.status(400).json({ error: 'That doesn\'t look like an OpenAI API key (expected sk-...).' });
  }
  userStore.setOpenAiKey(req.user.id, key);
  res.json({ ok: true, masked: maskSecret(key) });
});

router.put('/template', (req, res) => {
  const template = String(req.body?.template || '').trim();
  if (!template) return res.status(400).json({ error: 'template is required' });
  userStore.setTemplate(req.user.id, template);
  res.json({ ok: true });
});

router.put('/target-market', (req, res) => {
  const tm = String(req.body?.targetMarket || '').toLowerCase();
  if (!['global', 'israel'].includes(tm)) {
    return res.status(400).json({ error: 'targetMarket must be "global" or "israel"' });
  }
  userStore.setTargetMarket(req.user.id, tm);
  res.json({ ok: true });
});

router.post('/complete-onboarding', (req, res) => {
  userStore.setOnboarded(req.user.id);
  res.json({ ok: true });
});

export default router;
