import { serializeCv } from './keywordService.js';

const WEIGHTS = {
  keyword: 0.4,
  skills: 0.3,
  experience: 0.2,
  formatting: 0.1,
};

function pct(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function keywordMatchScore({ matched, partial, missing }) {
  const total = matched.length + partial.length + missing.length;
  if (!total) return 50;
  const score = (matched.length + partial.length * 0.5) / total;
  return pct(score * 100);
}

function skillsMatchScore(cv, keywords) {
  if (!keywords.length) return 60;
  const skillTokens = new Set();
  for (const s of cv.skills || []) {
    if (typeof s === 'string') {
      skillTokens.add(s.toLowerCase());
    } else if (s && Array.isArray(s.items)) {
      s.items.forEach((it) => skillTokens.add(String(it).toLowerCase()));
    }
  }
  let hits = 0;
  for (const k of keywords) {
    if (skillTokens.has(k.term.toLowerCase())) hits += 1;
  }
  return pct((hits / keywords.length) * 100);
}

function experienceMatchScore(cv, matched) {
  const expText = (cv.experience || [])
    .map((e) => `${e.role} ${e.company} ${(e.bullets || []).join(' ')}`)
    .join(' ')
    .toLowerCase();
  if (!matched.length) return 50;
  let hits = 0;
  for (const k of matched) {
    if (expText.includes(k.term.toLowerCase())) hits += 1;
  }
  return pct((hits / matched.length) * 100);
}

// Passive / weak openers research §104 flags. Bullets starting with these
// should be rewritten to lead with an active verb.
const PASSIVE_OPENERS = [
  'responsible for', 'tasked with', 'worked on', 'assisted with', 'helped with',
  'helped to', 'helped in', 'duties included', 'duties involved', 'in charge of',
  'involved in', 'participated in', 'contributed to', 'familiar with',
  'experience with', 'experience in', 'served as',
];

// Quantified-impact regex: %, $, x-multiplier, "N+" growth, or any digit run >= 2.
const METRIC_RE = /(?:\d+\s*%|\$\s*\d|\bx\s*\d|\b\d+\+|\b\d{2,})/i;

function bulletIssues(bullet) {
  const issues = [];
  if (!bullet || !bullet.trim()) return issues;
  const lower = bullet.trim().toLowerCase();
  const wordCount = bullet.trim().split(/\s+/).length;
  if (wordCount > 25) issues.push({ kind: 'long', label: `${wordCount} words (target ≤ 25)` });
  for (const opener of PASSIVE_OPENERS) {
    if (lower.startsWith(opener)) {
      issues.push({ kind: 'passive', label: `passive opener: "${opener}"` });
      break;
    }
  }
  if (!METRIC_RE.test(bullet)) issues.push({ kind: 'no-metric', label: 'no quantified impact' });
  return issues;
}

export function bulletDiagnostics(cv) {
  const out = [];
  for (let i = 0; i < (cv.experience || []).length; i += 1) {
    const exp = cv.experience[i];
    for (let j = 0; j < (exp.bullets || []).length; j += 1) {
      const issues = bulletIssues(exp.bullets[j]);
      if (issues.length) {
        out.push({ section: 'experience', entryIndex: i, bulletIndex: j, bullet: exp.bullets[j], issues });
      }
    }
  }
  for (let i = 0; i < (cv.projects || []).length; i += 1) {
    const proj = cv.projects[i];
    for (let j = 0; j < (proj.bullets || []).length; j += 1) {
      const issues = bulletIssues(proj.bullets[j]);
      if (issues.length) {
        out.push({ section: 'projects', entryIndex: i, bulletIndex: j, bullet: proj.bullets[j], issues });
      }
    }
  }
  return out;
}

// Layout / compliance flags. The current built-in templates have known
// properties; the frontend can decide what to surface based on the chosen one.
export function complianceFlags(cv) {
  const flags = {
    ambiguousDates: 0,
    passiveBullets: 0,
    longBullets: 0,
    metriclessBullets: 0,
  };
  const allBullets = [
    ...((cv.experience || []).flatMap((e) => e.bullets || [])),
    ...((cv.projects || []).flatMap((p) => p.bullets || [])),
  ];
  for (const b of allBullets) {
    const issues = bulletIssues(b);
    for (const i of issues) {
      if (i.kind === 'long') flags.longBullets += 1;
      else if (i.kind === 'passive') flags.passiveBullets += 1;
      else if (i.kind === 'no-metric') flags.metriclessBullets += 1;
    }
  }
  for (const e of cv.experience || []) {
    if (e.dates && /^\d{4}\s*[-–—]\s*(?:\d{4}|present|current)\s*$/i.test(e.dates.trim())) {
      flags.ambiguousDates += 1;
    }
  }
  return flags;
}

function formattingScore(cv) {
  let score = 100;
  const warnings = [];
  if (!cv.summary || cv.summary.length < 40) {
    score -= 15;
    warnings.push('Summary is missing or very short — recruiters often look at it first.');
  }
  if (!cv.experience || !cv.experience.length) {
    score -= 25;
    warnings.push('No experience entries found.');
  } else {
    const datedRoles = cv.experience.filter((e) => e.dates && e.dates.match(/\d{4}/));
    if (datedRoles.length < cv.experience.length) {
      score -= 10;
      warnings.push('Some experience entries are missing date ranges.');
    }
    const bullets = cv.experience.flatMap((e) => e.bullets || []);
    const longBullets = bullets.filter((b) => b.length > 220).length;
    if (longBullets > 0) {
      score -= 5;
      warnings.push(`${longBullets} bullet point(s) are very long (>220 chars). Tighten them up.`);
    }
    const shortBullets = bullets.filter((b) => b.length < 40 && b.length > 0).length;
    if (shortBullets > 2) {
      score -= 5;
      warnings.push(`${shortBullets} bullet point(s) feel underdeveloped (<40 chars).`);
    }
  }
  if (!cv.skills || !cv.skills.length) {
    score -= 15;
    warnings.push('No skills section — ATS heavily weighs the skills block.');
  }
  return { score: pct(score), warnings };
}

export function scoreAts(cv, jd, { keywords, matched, partial, missing }) {
  void jd;
  void serializeCv;
  const keywordScore = keywordMatchScore({ matched, partial, missing });
  const skillsScore = skillsMatchScore(cv, keywords);
  const experienceScore = experienceMatchScore(cv, matched);
  const { score: formatting, warnings } = formattingScore(cv);
  const diagnostics = bulletDiagnostics(cv);
  const compliance = complianceFlags(cv);

  const overall = pct(
    keywordScore * WEIGHTS.keyword +
      skillsScore * WEIGHTS.skills +
      experienceScore * WEIGHTS.experience +
      formatting * WEIGHTS.formatting
  );

  const recommendedAdditions = missing
    .filter((k) => k.term.length <= 18)
    .slice(0, 6)
    .map((k) => k.term);

  return {
    overallScore: overall,
    keywordMatchScore: keywordScore,
    skillsMatchScore: skillsScore,
    experienceMatchScore: experienceScore,
    formattingScore: formatting,
    matchedKeywords: matched.map((k) => k.term),
    partialKeywords: partial.map((k) => k.term),
    missingKeywords: missing.map((k) => k.term),
    weakKeywords: partial.map((k) => k.term),
    recommendedAdditions,
    warnings,
    bulletDiagnostics: diagnostics,
    compliance,
  };
}
