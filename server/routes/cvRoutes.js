import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extractCvFromFile } from '../services/extractionService.js';
import { userStore } from '../services/userStore.js';
import { requireApproved } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// UPLOAD_DIR holds short-lived multer temp files (deleted after the route
// finishes). In production we point this at a tmpfs (e.g. /tmp) so we don't
// fill the persistent volume with junk.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.use(requireApproved);

router.get('/', (req, res) => {
  const cv = userStore.ensureCv(req.user.id);
  res.json({ cv });
});

router.put('/', (req, res) => {
  const { cv } = req.body || {};
  if (!cv || typeof cv !== 'object') {
    return res.status(400).json({ error: 'Request body must include {cv: object}.' });
  }
  userStore.saveCv(req.user.id, cv);
  res.json({ ok: true });
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  console.log('[upload] start — user=', req.user?.id, 'file=', req.file?.originalname, 'mime=', req.file?.mimetype, 'size=', req.file?.size);
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const tmpPath = req.file.path;
  try {
    // Prefer the user's saved market over the request param; either is fine.
    const u = userStore.findById(req.user.id);
    const targetMarket =
      req.body?.targetMarket || req.query?.targetMarket || u?.target_market || 'global';
    console.log('[upload] step: extract from file (market=', targetMarket, ')');
    const { cv, usedAi } = await extractCvFromFile(tmpPath, req.file.mimetype, { targetMarket });
    console.log('[upload] step: extracted (usedAi=', usedAi, ')');
    userStore.saveCv(req.user.id, cv);
    console.log('[upload] step: saved to db');
    res.json({ cv });
    console.log('[upload] done');
  } catch (err) {
    console.error('[upload] crashed:', err);
    next(err);
  } finally {
    fs.unlink(tmpPath).catch(() => {});
  }
});

export default router;
