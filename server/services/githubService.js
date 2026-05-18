// Lightweight GitHub investigator. Given a GitHub username + a list of keywords,
// scan the user's public repos for evidence of each keyword. Uses unauthenticated
// requests (60 req/hour rate limit, plenty for one CV run).
//
// Returns a map keyword -> [{repo, evidence, url}, ...]

// Accept any of:
//   octocat
//   @octocat
//   github.com/octocat
//   https://github.com/octocat
//   https://github.com/octocat/repo
// Returns a clean username, or null if we can't recognize one.
function parseUsername(input) {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  // Strip protocol and any leading @ / trailing slash.
  s = s.replace(/^https?:\/\//i, '').replace(/^@/, '').replace(/\/+$/, '');
  // If the input mentions github.com/<x>, capture x.
  const ghMatch = s.match(/github\.com\/([\w][\w-]{0,38})/i);
  if (ghMatch) return ghMatch[1];
  // Otherwise treat the whole thing as a bare username.
  // GitHub usernames: alphanumeric or hyphens, can't start with hyphen, <= 39 chars.
  const userMatch = s.match(/^([\w][\w-]{0,38})$/);
  return userMatch ? userMatch[1] : null;
}

const UA = 'CV-Mirror-AI/0.1';

async function ghFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function fetchRepos(username) {
  // Top 30 by updated.
  return ghFetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=30&sort=updated`);
}

async function fetchReadme(owner, repo) {
  try {
    const data = await ghFetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`);
    if (data && data.content) {
      // GitHub returns base64-encoded content.
      return Buffer.from(data.content, 'base64').toString('utf8');
    }
  } catch {
    // No README, ignore.
  }
  return '';
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function snippetAround(text, term, span = 90) {
  if (!text) return '';
  const re = new RegExp(escapeRegExp(term), 'i');
  const m = text.match(re);
  if (!m) return '';
  const idx = m.index;
  const start = Math.max(0, idx - span);
  const end = Math.min(text.length, idx + term.length + span);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

export async function investigateGithub({ username, keywords }) {
  const user = parseUsername(username);
  if (!user) {
    return {
      error: `Couldn't read "${username}" as a GitHub username. Try just the username (e.g. octocat) or a profile URL (https://github.com/octocat).`,
      findings: {},
      username: null,
    };
  }
  if (!Array.isArray(keywords) || !keywords.length) {
    return { username: user, findings: {} };
  }

  let repos;
  try {
    repos = await fetchRepos(user);
  } catch (err) {
    return { username: user, error: `Could not fetch repos for ${user}: ${err.message}`, findings: {} };
  }
  if (!Array.isArray(repos) || !repos.length) {
    return { username: user, findings: {} };
  }

  // Light, parallel scan. For each repo: collect description + language + topics first.
  const findings = {};
  for (const kw of keywords) findings[kw] = [];

  const readmePromises = repos.slice(0, 12).map(async (repo) => {
    const readme = await fetchReadme(repo.owner.login, repo.name);
    return { repo, readme };
  });
  const readmes = await Promise.all(readmePromises);

  for (const kw of keywords) {
    const re = new RegExp(`(?<![\\w.+-])${escapeRegExp(kw)}(?![\\w])`, 'i');
    for (const { repo, readme } of readmes) {
      const haystacks = [
        { source: 'repo name', text: repo.name },
        { source: 'description', text: repo.description || '' },
        { source: 'language', text: repo.language || '' },
        { source: 'topics', text: (repo.topics || []).join(' ') },
        { source: 'README', text: readme },
      ];
      let bestEvidence = null;
      for (const h of haystacks) {
        if (h.text && re.test(h.text)) {
          const evidence = h.source === 'README' ? snippetAround(h.text, kw) : h.text;
          bestEvidence = { source: h.source, evidence };
          break; // first signal wins per repo per keyword
        }
      }
      if (bestEvidence) {
        findings[kw].push({
          repo: repo.name,
          url: repo.html_url,
          source: bestEvidence.source,
          evidence: bestEvidence.evidence,
        });
      }
    }
  }

  return { username: user, findings };
}

// ----------------------------------------------------------------------------
// Profile-quality assessment + project↔repo matching (research §142–177).
// Single GitHub API call (top 30 repos by updated) plus one optional README
// for the profile-README trick. Keeps us inside the 60-req/hr unauthenticated
// budget.
// ----------------------------------------------------------------------------

function hasDemoLink(readme) {
  if (!readme) return false;
  // Heuristic: a "Demo", "Live", or deployed-link line near the top.
  const head = readme.slice(0, 4000).toLowerCase();
  return /(\bdemo\b|\blive\b|\bdeployed\b|netlify\.app|vercel\.app|fly\.dev|herokuapp\.com|github\.io|onrender\.com)/.test(
    head
  );
}

function recencyDaysFromNow(iso) {
  if (!iso) return Infinity;
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return Infinity;
  return ms / (1000 * 60 * 60 * 24);
}

export async function assessGithubProfile(usernameInput) {
  const user = parseUsername(usernameInput);
  if (!user) {
    return {
      error: `Couldn't read "${usernameInput}" as a GitHub username. Try just the username or a profile URL.`,
      username: null,
    };
  }

  let repos;
  try {
    repos = await fetchRepos(user);
  } catch (err) {
    return { username: user, error: `Could not fetch repos: ${err.message}` };
  }
  if (!Array.isArray(repos)) repos = [];

  // Filter out forks. Profile-README repo (user/user) is also surfaced separately.
  const ownRepos = repos.filter((r) => !r.fork);
  const profileReadmeRepo = repos.find((r) => r.name && r.name.toLowerCase() === user.toLowerCase());

  // Strongest 6 by stars (approximation of pinned per research §151).
  const topRepos = [...ownRepos]
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 6);

  // Fetch READMEs for the top repos (parallel).
  const topReadmes = await Promise.all(
    topRepos.map(async (r) => ({ repo: r, readme: await fetchReadme(r.owner.login, r.name) }))
  );

  const profileReadme = profileReadmeRepo
    ? await fetchReadme(profileReadmeRepo.owner.login, profileReadmeRepo.name)
    : '';

  // Tech stack: union of languages + topics across top 10 repos.
  const techSet = new Set();
  for (const r of ownRepos.slice(0, 10)) {
    if (r.language) techSet.add(String(r.language));
    for (const t of r.topics || []) techSet.add(String(t));
  }
  const techStack = [...techSet];

  // Compute per-repo READMEs + license + demo presence.
  const perRepo = topReadmes.map(({ repo, readme }) => ({
    name: repo.name,
    url: repo.html_url,
    stars: repo.stargazers_count || 0,
    hasReadme: Boolean(readme && readme.trim().length > 80),
    hasDescription: Boolean(repo.description && repo.description.trim()),
    hasLicense: Boolean(repo.license && repo.license.spdx_id),
    licenseName: repo.license?.spdx_id || null,
    topicsCount: Array.isArray(repo.topics) ? repo.topics.length : 0,
    hasDemo: hasDemoLink(readme),
    daysSinceCommit: recencyDaysFromNow(repo.pushed_at),
  }));

  // Checklist + score.
  const checks = [];
  const totalStrong = topRepos.length;
  checks.push({
    id: 'profile-readme',
    label: 'Profile README present',
    pass: Boolean(profileReadme && profileReadme.trim().length > 80),
    hint: profileReadme
      ? 'Your /' + user + '/' + user + ' repo serves as a public bio.'
      : 'Create a repo named "' + user + '" to unlock a profile README (developer-specific cover letter).',
  });
  checks.push({
    id: 'pinned-count',
    label: 'Strong public repos (4–6)',
    pass: totalStrong >= 4,
    hint:
      totalStrong >= 4
        ? `${totalStrong} strong public repos found.`
        : `Only ${totalStrong} strong public repo${totalStrong === 1 ? '' : 's'} surfaced. Aim for 4–6.`,
  });
  const readmeCount = perRepo.filter((r) => r.hasReadme).length;
  checks.push({
    id: 'readmes',
    label: 'READMEs on top repos',
    pass: totalStrong > 0 && readmeCount === totalStrong,
    hint:
      totalStrong === 0
        ? 'No public repos to evaluate.'
        : `${readmeCount} of ${totalStrong} top repos have a substantive README.`,
  });
  const demoCount = perRepo.filter((r) => r.hasDemo).length;
  checks.push({
    id: 'demos',
    label: 'Live/demo links',
    pass: totalStrong > 0 && demoCount >= Math.min(2, totalStrong),
    hint:
      totalStrong === 0
        ? 'No public repos to evaluate.'
        : `${demoCount} top repo${demoCount === 1 ? '' : 's'} link to a live demo.`,
  });
  const licenseCount = perRepo.filter((r) => r.hasLicense).length;
  checks.push({
    id: 'licenses',
    label: 'Open-source license on top repos',
    pass: totalStrong > 0 && licenseCount >= Math.min(2, totalStrong),
    hint:
      totalStrong === 0
        ? 'No public repos to evaluate.'
        : `${licenseCount} of ${totalStrong} top repos have a license (MIT, Apache 2.0, etc.).`,
  });
  const recent = perRepo.filter((r) => r.daysSinceCommit < 60).length;
  checks.push({
    id: 'recency',
    label: 'Recent activity (last 60 days)',
    pass: recent > 0,
    hint:
      recent > 0
        ? `${recent} top repo${recent === 1 ? '' : 's'} updated in the last 60 days.`
        : 'No top repos have a recent commit. Recruiters look for an active heartbeat.',
  });

  const passCount = checks.filter((c) => c.pass).length;
  const score = Math.round((passCount / checks.length) * 100);

  return {
    username: user,
    score,
    checks,
    topRepos: perRepo,
    techStack,
    profileReadmePresent: Boolean(profileReadme && profileReadme.trim().length > 80),
  };
}

// Match each cv.projects entry against the user's public repos. Returns a
// per-project best-match (name normalized, longest common substring).
function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function similarity(a, b) {
  const na = normalizeKey(a);
  const nb = normalizeKey(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  // Crude Jaccard over bigrams.
  const bigrams = (s) => {
    const out = new Set();
    for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(na);
  const B = bigrams(nb);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export async function matchProjectsToRepos({ username, projects }) {
  const user = parseUsername(username);
  if (!user) return { username: null, matches: [] };
  if (!Array.isArray(projects) || !projects.length) return { username: user, matches: [] };

  let repos;
  try {
    repos = await fetchRepos(user);
  } catch (err) {
    return { username: user, error: `Could not fetch repos: ${err.message}`, matches: [] };
  }
  if (!Array.isArray(repos)) return { username: user, matches: [] };

  const ownRepos = repos.filter((r) => !r.fork);
  const matches = [];
  for (let i = 0; i < projects.length; i += 1) {
    const p = projects[i];
    const projectKey = `${p.name || ''} ${p.description || ''}`;
    let best = null;
    for (const r of ownRepos) {
      const repoKey = `${r.name} ${r.description || ''} ${(r.topics || []).join(' ')}`;
      const score = Math.max(similarity(p.name, r.name), similarity(projectKey, repoKey) * 0.9);
      if (!best || score > best.confidence) {
        best = { repo: r.name, url: r.html_url, confidence: score };
      }
    }
    if (best && best.confidence >= 0.45) {
      matches.push({ projectIndex: i, projectName: p.name || '', ...best });
    }
  }
  return { username: user, matches };
}
