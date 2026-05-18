// Mirror of server/services/atsService.js diagnostics — kept lightweight so we
// can analyze bullets locally as the user types or as new AI output arrives.

const PASSIVE_OPENERS = [
  'responsible for', 'tasked with', 'worked on', 'assisted with', 'helped with',
  'helped to', 'helped in', 'duties included', 'duties involved', 'in charge of',
  'involved in', 'participated in', 'contributed to', 'familiar with',
  'experience with', 'experience in', 'served as',
];
const METRIC_RE = /(?:\d+\s*%|\$\s*\d|\bx\s*\d|\b\d+\+|\b\d{2,})/i;

export function bulletIssues(bullet) {
  const issues = [];
  if (!bullet || !bullet.trim()) return issues;
  const trimmed = bullet.trim();
  const lower = trimmed.toLowerCase();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 25) issues.push({ kind: 'long', label: `${wordCount} words` });
  for (const opener of PASSIVE_OPENERS) {
    if (lower.startsWith(opener)) {
      issues.push({ kind: 'passive', label: `passive: "${opener}"` });
      break;
    }
  }
  if (!METRIC_RE.test(trimmed)) issues.push({ kind: 'no-metric', label: 'no metric' });
  return issues;
}

// Pull bullets out of the "after" text for a section. Same parsing rules as
// the server's structureCv: blank lines split blocks; lines starting with -, *, •
// are bullets; the first line of an experience block is the header, not a bullet.
export function bulletsFromAfter(name, after) {
  if (!after) return [];
  const text = String(after);
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    // For experience/projects, the first line is a header.
    const startIdx = name === 'summary' || name === 'skills' || name === 'languages' || name === 'education' ? 0 : 1;
    for (let i = startIdx; i < lines.length; i += 1) {
      const stripped = lines[i].replace(/^[-•*]\s*/, '').trim();
      if (stripped) out.push(stripped);
    }
  }
  return out;
}

export function summaryStats(text) {
  if (!text) return { sentences: 0, words: 0 };
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  return { sentences, words };
}
