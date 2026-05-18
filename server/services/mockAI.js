import { serializeCv } from './keywordService.js';

function topMatched(keywords, matched, n = 5) {
  const set = new Set(matched.map((k) => k.term));
  return keywords.filter((k) => set.has(k.term)).slice(0, n);
}

function diffWords(before, after) {
  const beforeWords = new Set(before.toLowerCase().split(/\W+/).filter(Boolean));
  const afterWords = after.toLowerCase().split(/\W+/).filter(Boolean);
  const added = [];
  const seen = new Set();
  for (const w of afterWords) {
    if (!beforeWords.has(w) && !seen.has(w) && w.length > 2) {
      added.push(w);
      seen.add(w);
    }
  }
  return added;
}

function tailorSummary(cv, matched) {
  const before = cv.summary || '';
  const focus = matched.map((k) => k.term).slice(0, 4);
  const target = cv.personalInfo?.title || 'professional';
  const focusPhrase = focus.length
    ? `with hands-on experience in ${focus.slice(0, -1).join(', ')}${focus.length > 1 ? ' and ' : ''}${focus[focus.length - 1]}`
    : '';
  const after = focus.length
    ? `${before.replace(/[.\s]+$/, '')}. Specifically targeting ${target} roles ${focusPhrase}, with a focus on shipping production-ready outcomes.`.trim()
    : before;
  const changes = focus.length
    ? [`Emphasized ${focus.join(', ')} to mirror the JD's primary requirements`, 'Tightened closing sentence to highlight delivery outcomes']
    : ['No high-priority keywords found in JD; left summary unchanged'];
  return {
    before,
    after,
    changes,
    reason: focus.length
      ? `The job description prioritizes ${focus.join(', ')}; surfacing these in the opening sentence improves ATS keyword scoring and grabs recruiter attention in the first 6 seconds.`
      : 'Summary kept as-is because no priority keywords were detected in the JD.',
  };
}

function tailorSkills(cv, matched, missing) {
  const before = formatSkills(cv.skills);
  const matchedSet = new Set(matched.map((k) => k.term.toLowerCase()));
  let reordered;
  if (Array.isArray(cv.skills) && cv.skills.length && typeof cv.skills[0] === 'object') {
    reordered = cv.skills.map((group) => {
      const items = Array.isArray(group.items) ? [...group.items] : [];
      items.sort((a, b) => {
        const aM = matchedSet.has(a.toLowerCase()) ? 1 : 0;
        const bM = matchedSet.has(b.toLowerCase()) ? 1 : 0;
        return bM - aM;
      });
      return { ...group, items };
    });
  } else if (Array.isArray(cv.skills)) {
    reordered = [...cv.skills].sort((a, b) => {
      const aM = matchedSet.has(String(a).toLowerCase()) ? 1 : 0;
      const bM = matchedSet.has(String(b).toLowerCase()) ? 1 : 0;
      return bM - aM;
    });
  } else {
    reordered = cv.skills;
  }
  const after = formatSkills(reordered);
  const changes = [];
  if (matched.length) changes.push(`Reordered to lead with ${matched.slice(0, 3).map((k) => k.term).join(', ')}`);
  const recoverable = missing
    .filter((k) => k.term.length <= 18)
    .slice(0, 2)
    .map((k) => k.term);
  if (recoverable.length) {
    changes.push(`Suggested additions (only if truly applicable): ${recoverable.join(', ')}`);
  }
  if (!changes.length) changes.push('No reordering needed; skills already aligned');
  return {
    before,
    after,
    changes,
    reason: 'ATS parsers and recruiters scan skills top-to-bottom. Putting JD-matched skills first increases visibility and keyword density.',
    _reordered: reordered,
  };
}

function formatSkills(skills) {
  if (!Array.isArray(skills) || !skills.length) return '';
  if (typeof skills[0] === 'object') {
    return skills.map((g) => `${g.category}: ${(g.items || []).join(', ')}`).join('\n');
  }
  return skills.join(', ');
}

function tailorExperience(cv, matched) {
  const before = (cv.experience || [])
    .map((e) => `${e.role} — ${e.company} (${e.dates})\n${(e.bullets || []).map((b) => `• ${b}`).join('\n')}`)
    .join('\n\n');

  const matchedTerms = matched.map((k) => k.term.toLowerCase());
  const rewritten = (cv.experience || []).map((exp) => {
    const sorted = [...(exp.bullets || [])].sort((a, b) => {
      const aHits = matchedTerms.filter((t) => a.toLowerCase().includes(t)).length;
      const bHits = matchedTerms.filter((t) => b.toLowerCase().includes(t)).length;
      return bHits - aHits;
    });
    return { ...exp, bullets: sorted };
  });
  const after = rewritten
    .map((e) => `${e.role} — ${e.company} (${e.dates})\n${(e.bullets || []).map((b) => `• ${b}`).join('\n')}`)
    .join('\n\n');

  const changes = matched.length
    ? [`Reordered bullets across each role to surface ${matched.slice(0, 2).map((k) => k.term).join(', ')}-related impact first`]
    : ['No reordering needed; bullets are already JD-aligned'];

  return {
    before,
    after,
    changes,
    reason:
      'Recruiters often read only the first 2 bullets per role. Promoting the most JD-relevant accomplishments to the top maximizes signal in that window — no content invented or removed.',
    _rewritten: rewritten,
  };
}

function tailorProjects(cv, matched) {
  const projects = cv.projects || [];
  if (!projects.length) {
    return {
      before: '',
      after: '',
      changes: ['No projects section to tailor'],
      reason: 'Skipped — no projects in current CV.',
      _rewritten: [],
    };
  }
  const matchedTerms = matched.map((k) => k.term.toLowerCase());
  const sorted = [...projects].sort((a, b) => {
    const aText = `${a.name} ${a.description} ${(a.bullets || []).join(' ')}`.toLowerCase();
    const bText = `${b.name} ${b.description} ${(b.bullets || []).join(' ')}`.toLowerCase();
    const aHits = matchedTerms.filter((t) => aText.includes(t)).length;
    const bHits = matchedTerms.filter((t) => bText.includes(t)).length;
    return bHits - aHits;
  });
  const fmt = (list) => list.map((p) => `${p.name}\n${p.description || ''}\n${(p.bullets || []).map((b) => `• ${b}`).join('\n')}`).join('\n\n');
  return {
    before: fmt(projects),
    after: fmt(sorted),
    changes: matched.length
      ? [`Reordered projects to lead with ones using ${matched.slice(0, 2).map((k) => k.term).join(', ')}`]
      : ['Projects unchanged'],
    reason: 'Leading with the most relevant project signals fit immediately to recruiters skimming the section.',
    _rewritten: sorted,
  };
}

function tailorEducation(cv) {
  const txt = (cv.education || []).map((e) => `${e.degree} — ${e.institution} (${e.dates})`).join('\n');
  return {
    before: txt,
    after: txt,
    changes: ['Education unchanged — factual content should not be rewritten'],
    reason: 'Education is verifiable factual data. No tailoring applied — this preserves accuracy.',
  };
}

function tailorLanguages(cv) {
  const txt = (cv.languages || []).map((l) => `${l.name} — ${l.level || ''}`).join('\n');
  return {
    before: txt,
    after: txt,
    changes: ['Languages unchanged — factual content should not be rewritten'],
    reason: 'Language proficiency is factual. No tailoring applied.',
  };
}

export function mockTailor(cv, jd, { matched = [], missing = [], keywords = [] } = {}) {
  void jd;
  void serializeCv;
  const topMatch = topMatched(keywords, matched, 5);

  const summary = tailorSummary(cv, topMatch);
  const skills = tailorSkills(cv, matched, missing);
  const experience = tailorExperience(cv, matched);
  const projects = tailorProjects(cv, matched);
  const education = tailorEducation(cv);
  const languages = tailorLanguages(cv);

  return {
    sections: {
      summary: { before: summary.before, after: summary.after, changes: summary.changes, reason: summary.reason },
      skills: { before: skills.before, after: skills.after, changes: skills.changes, reason: skills.reason },
      experience: {
        before: experience.before,
        after: experience.after,
        changes: experience.changes,
        reason: experience.reason,
      },
      projects: { before: projects.before, after: projects.after, changes: projects.changes, reason: projects.reason },
      education: {
        before: education.before,
        after: education.after,
        changes: education.changes,
        reason: education.reason,
      },
      languages: {
        before: languages.before,
        after: languages.after,
        changes: languages.changes,
        reason: languages.reason,
      },
    },
    _structured: {
      skills: skills._reordered,
      experience: experience._rewritten,
      projects: projects._rewritten,
    },
  };
}

export { diffWords };

// Deterministic mock recruiter critique. Used when AI_PROVIDER=mock so the UI
// is fully exercisable without an API key. Tries to be specific by referencing
// the user's real bullets/section text rather than generic filler.
export function mockCritique(cv, jd, analysis = {}) {
  const missing = (analysis.missing || []).map((k) => (typeof k === 'string' ? k : k.term));
  const matched = (analysis.matched || []).map((k) => (typeof k === 'string' ? k : k.term));

  // Pick up to 2 long-but-no-metric bullets from the first experience entry.
  const firstExp = (cv.experience || [])[0] || { bullets: [] };
  const targetBullets = [];
  for (let j = 0; j < (firstExp.bullets || []).length; j += 1) {
    const b = firstExp.bullets[j];
    if (!b) continue;
    const wordy = b.trim().split(/\s+/).length > 18;
    const noMetric = !/(\d+\s*%|\$\s*\d|\bx\s*\d|\b\d+\+|\b\d{2,})/i.test(b);
    if (wordy || noMetric) {
      targetBullets.push({ entryIndex: 0, bulletIndex: j, before: b, after: `Led ${b.replace(/^(Led|Built|Managed|Worked on)\s+/i, '')}` });
      if (targetBullets.length === 2) break;
    }
  }

  const summaryBefore = cv.summary || '';
  const focus = matched.slice(0, 3).join(', ');
  const summaryAfter = summaryBefore
    ? `${summaryBefore.replace(/[.\s]+$/, '')}. Closely aligned with the role's priorities${focus ? ` in ${focus}` : ''}.`
    : '';

  const weaknesses = [
    {
      point: 'Summary reads like a duty list, not a value pitch.',
      evidence: (summaryBefore || '').slice(0, 90) || '(no summary)',
      fix: 'Open with role + years of experience, then ONE quantified win, then a value-prop line referencing top JD keywords.',
    },
    {
      point: 'Experience bullets are dense and rarely quantified.',
      evidence: firstExp.bullets?.[0] || '(no experience bullets)',
      fix: 'Rewrite the longest bullet as STAR in ≤25 words, leading with an active verb and ending with a number (%, $, hours saved).',
    },
    {
      point: 'No GitHub or live-demo links surfaced near the role-relevant projects.',
      evidence: cv.personalInfo?.github || '(no github)',
      fix: 'Add a clickable GitHub URL on the most-relevant project; mention the repo name inline in its bullets.',
    },
    {
      point: 'Skills are listed flat — categories aren\'t obviously matched to the JD.',
      evidence: (cv.skills?.[0]?.items || []).slice(0, 5).join(', ') || '(no skills)',
      fix: `Regroup skills into JD-matched buckets (e.g. ${(matched.slice(0, 2).join(' / ') || 'Frontend / Backend')}, Tooling) so the screener\'s eye lands where it matters.`,
    },
    {
      point: 'Achievements section is sparse or missing — recruiters expect concrete recognitions.',
      evidence: (cv.achievements || []).slice(0, 2).join(' · ') || '(no achievements)',
      fix: 'Add 2–3 one-line achievements: hackathons, internal awards, top-N rankings, certifications, or open-source merges.',
    },
  ].slice(0, 5);

  return {
    weaknesses,
    positioning: {
      current: cv.personalInfo?.title
        ? `${cv.personalInfo.title} with a generic profile — broad but not differentiated.`
        : 'A broadly-skilled candidate without a clear specialization signal.',
      target: jd
        ? 'A focused operator with quantified impact in the role\'s exact domain.'
        : 'A focused operator with quantified impact in their core domain.',
      gap: 'Tighten the framing so the strongest 2–3 outcomes show up in the first 8 seconds of skim.',
    },
    improvedSections: {
      summary: summaryAfter ? { before: summaryBefore, after: summaryAfter } : null,
      experienceBullets: targetBullets,
    },
    missingKeywords: missing.slice(0, 6).map((term) => ({
      term,
      suggestionToInclude: `Surface ${term} in the bullet describing the project where you most directly used it.`,
    })),
    changeLog: [
      ...(summaryAfter ? [{ change: 'Tightened summary closing line', why: 'Shows JD alignment in the first read.' }] : []),
      ...targetBullets.map((b, i) => ({
        change: `Rewrote experience bullet ${i + 1}`,
        why: 'Leads with an active verb and keeps the bullet readable in one breath.',
      })),
      ...(missing.length
        ? [{ change: `Flagged ${missing.length} missing keyword(s)`, why: 'These are JD must-haves the screener will search for.' }]
        : []),
    ],
  };
}
