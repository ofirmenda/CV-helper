const TECH_DICT = [
  'react', 'react.js', 'vue', 'vue.js', 'angular', 'svelte', 'next.js', 'nuxt', 'remix',
  'node.js', 'nodejs', 'node', 'express', 'fastify', 'nestjs', 'koa',
  'typescript', 'javascript', 'python', 'java', 'go', 'golang', 'rust', 'kotlin', 'swift',
  'c++', 'c#', 'ruby', 'php', 'scala', 'elixir', 'assembly',
  'html', 'css', 'sass', 'tailwind', 'tailwindcss', 'bootstrap', 'styled-components',
  'redux', 'zustand', 'mobx', 'rxjs', 'graphql', 'apollo', 'rest', 'rest api', 'grpc', 'websocket',
  'aws', 'azure', 'gcp', 'google cloud', 'firebase', 'vercel', 'netlify', 'heroku',
  'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'helm', 'istio',
  'jenkins', 'github actions', 'gitlab ci', 'circleci', 'argo',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'mongo', 'redis', 'elasticsearch', 'dynamodb',
  'sql', 'nosql', 'sqlite', 'cassandra', 'kafka', 'rabbitmq', 'sqs',
  'machine learning', 'deep learning', 'pytorch', 'tensorflow', 'scikit-learn', 'pandas', 'numpy',
  'llm', 'rag', 'langchain', 'openai', 'anthropic', 'embeddings', 'vector database', 'pinecone',
  'ci/cd', 'devops', 'sre', 'observability', 'monitoring', 'prometheus', 'grafana', 'datadog',
  'linux', 'bash', 'unix', 'shell', 'powershell',
  'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence',
  'agile', 'scrum', 'kanban',
  'tcp/ip', 'http', 'https', 'dns', 'tls', 'oauth', 'jwt', 'saml',
  'system design', 'distributed systems', 'microservices', 'monolith', 'serverless', 'event-driven',
  'unit testing', 'integration testing', 'e2e testing', 'jest', 'vitest', 'cypress', 'playwright',
  'security', 'sql injection', 'xss', 'csrf', 'owasp', 'penetration testing',
  'product management', 'roadmap', 'stakeholder management', 'cross-functional',
  'saas', 'b2b', 'b2c', 'pricing', 'monetization', 'go-to-market', 'gtm',
  'team leadership', 'mentoring', 'hiring', 'people management',
  'data analysis', 'analytics', 'a/b testing', 'experimentation', 'sql',
  'figma', 'sketch', 'adobe xd', 'ux', 'ui', 'design systems',
  'api design', 'api', 'apis', 'sdk', 'cli',
  'performance', 'scalability', 'reliability', 'high availability', 'fault tolerance',
  'caching', 'cdn', 'load balancing', 'message queue',
  'frontend', 'backend', 'fullstack', 'full-stack', 'mobile', 'ios', 'android', 'react native',
];

const STOPWORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','was',
  'are','were','be','been','being','have','has','had','do','does','did','will','would','could','should',
  'may','might','must','can','this','that','these','those','i','you','he','she','it','we','they',
  'what','which','who','whom','whose','when','where','why','how','about','our','your','their','any',
  'all','each','every','some','no','not','only','own','same','so','than','too','very','just','also',
  'into','out','up','down','over','under','again','further','then','once','here','there','etc',
  'using','use','used','make','made','will','include','including','required','requirements','requirement',
]);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractKeywords(jdText, { limit = 20 } = {}) {
  if (!jdText || typeof jdText !== 'string') return [];
  const lower = jdText.toLowerCase();

  const found = new Map();
  for (const term of TECH_DICT) {
    const pattern = new RegExp(`(?<![\\w.+-])${escapeRegExp(term)}(?![\\w])`, 'gi');
    const matches = lower.match(pattern);
    if (matches) {
      const weight = matches.length + (term.includes(' ') ? 0.5 : 0);
      found.set(term, (found.get(term) || 0) + weight);
    }
  }

  const tokens = lower
    .split(/[^a-z0-9.+#-]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
  const tokenCounts = new Map();
  for (const t of tokens) {
    if (TECH_DICT.includes(t)) continue;
    tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
  }

  const fromDict = Array.from(found.entries()).map(([term, weight]) => ({
    term,
    weight,
    category: 'tech',
    source: 'dictionary',
  }));

  const ranked = fromDict.sort((a, b) => b.weight - a.weight).slice(0, limit);
  return ranked;
}

export function categorizeMatches(cv, keywords) {
  const cvText = serializeCv(cv).toLowerCase();
  const matched = [];
  const partial = [];
  const missing = [];

  for (const kw of keywords) {
    const t = kw.term.toLowerCase();
    const re = new RegExp(`(?<![\\w.+-])${escapeRegExp(t)}(?![\\w])`, 'i');
    if (re.test(cvText)) {
      matched.push(kw);
      continue;
    }
    const head = t.split(/[\s.\-]/)[0];
    if (head && head.length > 2 && new RegExp(`\\b${escapeRegExp(head)}\\b`, 'i').test(cvText)) {
      partial.push(kw);
      continue;
    }
    missing.push(kw);
  }
  return { matched, partial, missing };
}

export function serializeCv(cv) {
  if (!cv) return '';
  const parts = [];
  if (cv.personalInfo) parts.push(Object.values(cv.personalInfo).filter(Boolean).join(' '));
  if (cv.summary) parts.push(cv.summary);
  // Skills may be either an array of strings or an array of {category, items[]} groups.
  if (Array.isArray(cv.skills)) {
    for (const s of cv.skills) {
      if (typeof s === 'string') parts.push(s);
      else if (s && typeof s === 'object') {
        if (s.category) parts.push(s.category);
        if (Array.isArray(s.items)) parts.push(s.items.join(' '));
      }
    }
  }
  for (const exp of cv.experience || []) {
    parts.push([exp.role, exp.company, exp.dates, ...(exp.bullets || [])].filter(Boolean).join(' '));
  }
  for (const proj of cv.projects || []) {
    parts.push([proj.name, proj.description, ...(proj.bullets || [])].filter(Boolean).join(' '));
  }
  for (const edu of cv.education || []) {
    parts.push([edu.degree, edu.institution, edu.dates].filter(Boolean).join(' '));
  }
  if (Array.isArray(cv.languages)) parts.push(cv.languages.map((l) => `${l.name} ${l.level || ''}`).join(' '));
  if (Array.isArray(cv.achievements)) parts.push(cv.achievements.join(' '));
  // User-added custom sections (extras) — their title + content count as CV text.
  if (Array.isArray(cv.extras)) {
    for (const x of cv.extras) {
      if (x && (x.title || x.content)) parts.push(`${x.title || ''} ${x.content || ''}`);
    }
  }
  return parts.join(' \n ');
}

// Suggest a section order based on the JD's emphasis. Heuristic:
// - Summary is always first (recruiters read it first).
// - Then either Skills or Experience first, depending on which the JD weights more.
// - Projects after experience if it exists.
// - Education and Languages at the end (rarely the differentiator).
// - User extras after Projects, before Education.
// Sum years across all experience entries based on their date ranges.
// Robust to multiple formats: "2019 - PRESENT", "January 2021 – March 2023",
// "01/2021 – 03/2023", "2019 - 2023".
function totalYearsOfExperience(experience) {
  if (!Array.isArray(experience)) return 0;
  let years = 0;
  for (const e of experience) {
    if (!e?.dates) continue;
    const dates = String(e.dates);
    // Match the first 4-digit year and the second token (year or Present/Current).
    const m = dates.match(/(\d{4})\D+(\d{4}|present|current|now)/i);
    if (!m) continue;
    const start = parseInt(m[1], 10);
    const endRaw = m[2];
    const end = /present|current|now/i.test(endRaw)
      ? new Date().getFullYear()
      : parseInt(endRaw, 10);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      years += end - start;
    }
  }
  return years;
}

// Classify the CV's seniority to drive section ordering. For juniors with
// projects, projects should sit near the top — they're the strongest signal
// when work history is thin.
export function detectSeniority(cv) {
  const title = (cv?.personalInfo?.title || '').toLowerCase();
  const expCount = (cv?.experience || []).length;
  const projCount = (cv?.projects || []).length;
  const years = totalYearsOfExperience(cv?.experience);

  let juniorScore = 0;
  if (expCount === 0) juniorScore += 3;
  else if (expCount === 1) juniorScore += 1;
  if (years < 2) juniorScore += 2;
  else if (years < 4) juniorScore += 1;
  if (/student|junior|intern|graduate|entry.?level|trainee|new\s*grad/i.test(title)) juniorScore += 2;

  let seniorScore = 0;
  if (expCount >= 4) seniorScore += 2;
  if (years >= 8) seniorScore += 2;
  if (/\b(senior|sr\.?|director|lead|principal|head of|chief|vp|architect|staff)\b/i.test(title)) {
    seniorScore += 1;
  }

  if (juniorScore >= 3 && seniorScore === 0 && projCount >= 1) return 'junior';
  if (seniorScore >= 3 && juniorScore <= 1) return 'senior';
  return 'mid';
}

export function suggestSectionOrder(cv, jd) {
  const text = (jd || '').toLowerCase();
  const skillsHits = (text.match(/\bskill|stack|tooling|tech|proficien|familiar|fluent in|expertise/g) || []).length;
  const expHits = (text.match(/\byear|experience|prior|background|previous role|career|track record/g) || []).length;
  const order = ['summary'];
  const hasSkills = Array.isArray(cv?.skills) && cv.skills.length;
  const hasExp = Array.isArray(cv?.experience) && cv.experience.length;
  const hasProj = Array.isArray(cv?.projects) && cv.projects.length;
  const hasEdu = Array.isArray(cv?.education) && cv.education.length;
  const hasLang = Array.isArray(cv?.languages) && cv.languages.length;
  const hasAch = Array.isArray(cv?.achievements) && cv.achievements.length;

  // Israel mode: bilingual or multilingual candidates put Languages right after
  // Summary — it's a major competitive signal (research §205–222).
  const isIL = cv?.targetMarket === 'israel';
  const langCount = hasLang ? cv.languages.length : 0;
  if (isIL && langCount >= 2) order.push('languages');

  const seniority = detectSeniority(cv);

  if (seniority === 'junior') {
    // Junior CV: Projects (and Education) are the strongest signal. Lift them
    // ahead of thin or absent work history.
    if (hasProj) order.push('projects');
    if (hasSkills) order.push('skills');
    if (hasEdu) order.push('education');
    if (hasExp) order.push('experience');
    if (hasAch) order.push('achievements');
  } else {
    // Mid + Senior: experience leads (unless the JD is overwhelmingly skills-heavy).
    if (skillsHits >= expHits + 2 && seniority !== 'senior') {
      if (hasSkills) order.push('skills');
      if (hasExp) order.push('experience');
    } else {
      if (hasExp) order.push('experience');
      if (hasSkills) order.push('skills');
    }
    if (hasProj) order.push('projects');
    if (hasAch) order.push('achievements');
    if (hasEdu) order.push('education');
  }

  if (hasLang && !order.includes('languages')) order.push('languages');
  return order;
}

export function findCvMatches(cv, term) {
  const targets = [];
  const re = new RegExp(`(?<![\\w.+-])${escapeRegExp(term)}(?![\\w])`, 'i');
  if (cv.summary && re.test(cv.summary)) targets.push({ sectionId: 'summary' });
  if (Array.isArray(cv.skills)) {
    cv.skills.forEach((s, i) => {
      const v = typeof s === 'string' ? s : `${s.category || ''} ${(s.items || []).join(' ')}`;
      if (re.test(v)) targets.push({ sectionId: 'skills', itemIndex: i });
    });
  }
  (cv.experience || []).forEach((exp, i) => {
    const txt = [exp.role, exp.company, ...(exp.bullets || [])].join(' ');
    if (re.test(txt)) targets.push({ sectionId: 'experience', itemIndex: i });
  });
  (cv.projects || []).forEach((p, i) => {
    const txt = [p.name, p.description, ...(p.bullets || [])].join(' ');
    if (re.test(txt)) targets.push({ sectionId: 'projects', itemIndex: i });
  });
  return targets;
}
