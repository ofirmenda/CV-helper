import { Router } from 'express';
import { extractKeywords, categorizeMatches, findCvMatches, suggestSectionOrder } from '../services/keywordService.js';
import { scoreAts } from '../services/atsService.js';
import { tailor, currentProvider, critique } from '../services/aiService.js';
import { investigateGithub, assessGithubProfile, matchProjectsToRepos } from '../services/githubService.js';
import { userStore } from '../services/userStore.js';
import { requireApproved } from '../middleware/auth.js';

const router = Router();

// Every analyze / critique / github-* / latest route is per-user AND requires
// admin approval — unapproved users get 403 NOT_APPROVED.
router.use(requireApproved);

router.post('/analyze', async (req, res, next) => {
  console.log('[analyze] start — user=', req.user?.id, 'jd-len=', (req.body?.jd || '').length);
  try {
    const { cv, jd, userContext, confirmedAbsent, githubEvidence } = req.body || {};
    if (!cv || typeof cv !== 'object') {
      return res.status(400).json({ error: 'Request must include {cv, jd}.' });
    }
    if (!jd || typeof jd !== 'string' || jd.trim().length < 20) {
      return res.status(400).json({ error: 'Job description must be at least 20 characters.' });
    }

    console.log('[analyze] step: extract keywords');
    const keywords = extractKeywords(jd, { limit: 24 });
    console.log('[analyze] step: categorize matches');
    const { matched, partial, missing } = categorizeMatches(cv, keywords);
    console.log('[analyze] step: score ats');
    const ats = scoreAts(cv, jd, { keywords, matched, partial, missing });

    console.log('[analyze] step: tailor (provider=', currentProvider(), ')');
    const tailored = await tailor(cv, jd, {
      matched, partial, missing, keywords,
      userContext, confirmedAbsent, githubEvidence,
      userId: req.user.id,
    });
    console.log('[analyze] step: tailor done, sections=', Object.keys(tailored.sections || {}).length);

    const presence = {
      summary: !!(cv.summary && cv.summary.trim()),
      skills: Array.isArray(cv.skills) && cv.skills.length > 0,
      experience: Array.isArray(cv.experience) && cv.experience.length > 0,
      projects: Array.isArray(cv.projects) && cv.projects.length > 0,
      education: Array.isArray(cv.education) && cv.education.length > 0,
      languages: Array.isArray(cv.languages) && cv.languages.length > 0,
      achievements: Array.isArray(cv.achievements) && cv.achievements.length > 0,
    };
    const filteredSections = {};
    for (const [name, sec] of Object.entries(tailored.sections || {})) {
      if (!sec) continue;
      const hasContent = (sec.before && sec.before.trim()) || (sec.after && sec.after.trim());
      if (presence[name] || hasContent) filteredSections[name] = sec;
    }

    const connections = [];
    for (const kw of matched) {
      for (const t of findCvMatches(cv, kw.term)) connections.push({ from: kw.term, to: t, strength: 'match' });
    }
    for (const kw of partial) {
      for (const t of findCvMatches(cv, kw.term.split(/[\s.\-]/)[0] || kw.term)) {
        connections.push({ from: kw.term, to: t, strength: 'partial' });
      }
    }
    for (const kw of missing) connections.push({ from: kw.term, to: null, strength: 'miss' });

    const suggestedSectionOrder = suggestSectionOrder(cv, jd);

    const result = {
      suggestedSectionOrder,
      keywords: keywords.map((k) => ({
        term: k.term,
        weight: k.weight,
        status: matched.find((m) => m.term === k.term)
          ? 'match'
          : partial.find((p) => p.term === k.term)
          ? 'partial'
          : 'miss',
      })),
      sections: filteredSections,
      ats,
      connections,
      provider: currentProvider(),
      generatedAt: new Date().toISOString(),
    };

    userStore.saveResult(req.user.id, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/critique', async (req, res, next) => {
  try {
    const { cv, jd } = req.body || {};
    if (!cv || typeof cv !== 'object') {
      return res.status(400).json({ error: 'Request must include {cv}.' });
    }
    let analysis = {};
    if (jd && typeof jd === 'string' && jd.trim().length >= 20) {
      const keywords = extractKeywords(jd, { limit: 24 });
      analysis = categorizeMatches(cv, keywords);
    }
    const out = await critique(cv, jd || '', { ...analysis, userId: req.user.id });
    res.json(out);
  } catch (err) {
    next(err);
  }
});

router.post('/github-investigate', async (req, res, next) => {
  try {
    const { username, keywords } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });
    if (!Array.isArray(keywords) || !keywords.length) return res.status(400).json({ error: 'keywords[] is required' });
    const result = await investigateGithub({ username, keywords });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/github-profile', async (req, res, next) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });
    const result = await assessGithubProfile(username);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/projects-to-repos', async (req, res, next) => {
  try {
    const { username, projects } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });
    if (!Array.isArray(projects)) return res.status(400).json({ error: 'projects[] is required' });
    const result = await matchProjectsToRepos({ username, projects });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/analyze/latest', (req, res) => {
  const result = userStore.getResult(req.user.id);
  res.json({ result });
});

export default router;
