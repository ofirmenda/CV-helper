import { Router } from 'express';
import { renderPdf } from '../services/pdfService.js';
import { requireApproved } from '../middleware/auth.js';

// LastName_FirstName_Resume per research §50, §232. If name is missing or just
// one token, fall back to a sensible default.
function resumeFilename(cv, ext) {
  const raw = (cv?.personalInfo?.name || '').trim();
  if (!raw) return `cv.${ext}`;
  const sanitize = (s) => s.replace(/[^A-Za-zÀ-ÿ'-]+/g, '');
  const parts = raw.split(/\s+/).map(sanitize).filter(Boolean);
  if (parts.length === 0) return `cv.${ext}`;
  if (parts.length === 1) return `${parts[0]}_Resume.${ext}`;
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${last}_${first}_Resume.${ext}`;
}

const router = Router();

// All export routes require approved access.
router.use(requireApproved);

function cvToMarkdown(cv) {
  const out = [];
  const pi = cv.personalInfo || {};
  if (pi.name) out.push(`# ${pi.name}`);
  if (pi.title) out.push(`*${pi.title}*`);
  const contact = [pi.email, pi.phone, pi.linkedin, pi.github].filter(Boolean).join(' • ');
  if (contact) out.push(contact);
  out.push('');

  if (cv.summary) {
    out.push('## Summary');
    out.push(cv.summary);
    out.push('');
  }

  if (Array.isArray(cv.skills) && cv.skills.length) {
    out.push('## Skills');
    for (const s of cv.skills) {
      if (typeof s === 'string') {
        out.push(`- ${s}`);
      } else if (s && Array.isArray(s.items)) {
        out.push(`**${s.category}:** ${s.items.join(', ')}`);
      }
    }
    out.push('');
  }

  if (Array.isArray(cv.experience) && cv.experience.length) {
    out.push('## Experience');
    for (const exp of cv.experience) {
      out.push(`### ${exp.role || ''} — ${exp.company || ''}`);
      if (exp.dates) out.push(`*${exp.dates}*`);
      for (const b of exp.bullets || []) out.push(`- ${b}`);
      out.push('');
    }
  }

  if (Array.isArray(cv.projects) && cv.projects.length) {
    out.push('## Projects');
    for (const p of cv.projects) {
      out.push(`### ${p.name || ''}`);
      if (p.description) out.push(p.description);
      for (const b of p.bullets || []) out.push(`- ${b}`);
      out.push('');
    }
  }

  if (Array.isArray(cv.education) && cv.education.length) {
    out.push('## Education');
    for (const e of cv.education) {
      out.push(`- **${e.degree || ''}** — ${e.institution || ''} ${e.dates ? `(${e.dates})` : ''}`);
    }
    out.push('');
  }

  if (Array.isArray(cv.achievements) && cv.achievements.length) {
    out.push('## Achievements');
    for (const a of cv.achievements) out.push(`- ${a}`);
    out.push('');
  }

  if (Array.isArray(cv.languages) && cv.languages.length) {
    out.push('## Languages');
    for (const l of cv.languages) {
      out.push(`- ${l.name}${l.level ? ` — ${l.level}` : ''}`);
    }
  }

  return out.join('\n');
}

// Plain-text variant for ATS preview. Strips all markdown / decoration so the
// reader sees roughly what a Workday/Greenhouse parser would see in its
// fielded representation. Reading order is preserved top-to-bottom.
function cvToPlainText(cv) {
  const out = [];
  const pi = cv.personalInfo || {};
  if (pi.name) out.push(pi.name.toUpperCase());
  if (pi.title) out.push(pi.title);
  const contact = [pi.email, pi.phone, pi.linkedin, pi.github, pi.location]
    .filter(Boolean)
    .join(' | ');
  if (contact) out.push(contact);
  out.push('');

  if (cv.summary) {
    out.push('SUMMARY');
    out.push(cv.summary);
    out.push('');
  }

  if (Array.isArray(cv.skills) && cv.skills.length) {
    out.push('SKILLS');
    for (const s of cv.skills) {
      if (typeof s === 'string') out.push(s);
      else if (s && Array.isArray(s.items)) out.push(`${s.category}: ${s.items.join(', ')}`);
    }
    out.push('');
  }

  if (Array.isArray(cv.experience) && cv.experience.length) {
    out.push('EXPERIENCE');
    for (const exp of cv.experience) {
      const header = [exp.role, exp.company].filter(Boolean).join(' — ');
      out.push(header);
      if (exp.dates) out.push(exp.dates);
      for (const b of exp.bullets || []) out.push(`* ${b}`);
      out.push('');
    }
  }

  if (Array.isArray(cv.projects) && cv.projects.length) {
    out.push('PROJECTS');
    for (const p of cv.projects) {
      if (p.name) out.push(p.name);
      if (p.description) out.push(p.description);
      for (const b of p.bullets || []) out.push(`* ${b}`);
      out.push('');
    }
  }

  if (Array.isArray(cv.education) && cv.education.length) {
    out.push('EDUCATION');
    for (const e of cv.education) {
      const parts = [e.degree, e.institution].filter(Boolean).join(' — ');
      const line = e.dates ? `${parts} (${e.dates})` : parts;
      if (line) out.push(line);
    }
    out.push('');
  }

  if (Array.isArray(cv.achievements) && cv.achievements.length) {
    out.push('ACHIEVEMENTS');
    for (const a of cv.achievements) out.push(`* ${a}`);
    out.push('');
  }

  if (Array.isArray(cv.languages) && cv.languages.length) {
    out.push('LANGUAGES');
    for (const l of cv.languages) {
      out.push(`${l.name}${l.level ? ` — ${l.level}` : ''}`);
    }
    out.push('');
  }

  if (Array.isArray(cv.extras) && cv.extras.length) {
    for (const x of cv.extras) {
      if (!x || (!x.title && !x.content)) continue;
      if (x.title) out.push(x.title.toUpperCase());
      if (x.content) out.push(x.content);
      out.push('');
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

router.post('/pdf', async (req, res, next) => {
  try {
    const { cv, template, onePage } = req.body || {};
    if (!cv || typeof cv !== 'object') {
      return res.status(400).json({ error: 'Request must include {cv}.' });
    }
    const pdf = await renderPdf({ cv, template, onePage: Boolean(onePage) });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${resumeFilename(cv, 'pdf')}"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.post('/markdown', async (req, res, next) => {
  try {
    const { cv } = req.body || {};
    if (!cv || typeof cv !== 'object') {
      return res.status(400).json({ error: 'Request must include {cv}.' });
    }
    const md = cvToMarkdown(cv);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${resumeFilename(cv, 'md')}"`);
    res.send(md);
  } catch (err) {
    next(err);
  }
});

router.post('/plaintext', async (req, res, next) => {
  try {
    const { cv } = req.body || {};
    if (!cv || typeof cv !== 'object') {
      return res.status(400).json({ error: 'Request must include {cv}.' });
    }
    const txt = cvToPlainText(cv);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(txt);
  } catch (err) {
    next(err);
  }
});

export default router;
