import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import mammoth from 'mammoth';
import { extractCvWithAI, currentProvider } from './aiService.js';

const require = createRequire(import.meta.url);

function itemsToLines(items) {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const heights = sorted.map((it) => it.h).filter((h) => h > 0).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 10;
  const lineGap = medianH * 0.6;
  const blockGap = medianH * 1.8;

  const lines = [];
  let line = [];
  let lastY = null;
  for (const it of sorted) {
    if (lastY !== null) {
      const dy = Math.abs(it.y - lastY);
      if (dy > lineGap) {
        if (line.length) {
          lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
          line = [];
        }
        if (dy > blockGap) lines.push(''); // blank line marks a new block
      }
    }
    line.push(it.str);
    lastY = it.y;
  }
  if (line.length) lines.push(line.join(' ').replace(/\s+/g, ' ').trim());
  return lines;
}

// Detect a real two-column layout. Returns the split x-position if found, else null.
//
// Heuristics (all must hold):
//  - Bimodal x-distribution: two clusters separated by an empty gap band
//  - Gap band spans at least ~10% of page width with effectively zero items
//  - Gap sits near page center (between 30% and 70% of width)
//  - Each side holds >= 25% of items (balanced enough to be a real column)
//  - There must be a meaningful number of items per side (>= 40)
function detectColumnSplit(items, pageWidth) {
  if (items.length < 60) return null;
  if (!pageWidth) return null;

  // Histogram of left-edge x-positions over 50 buckets across the page width.
  const N = 50;
  const buckets = new Array(N).fill(0);
  for (const it of items) {
    const b = Math.min(N - 1, Math.max(0, Math.floor((it.x / pageWidth) * N)));
    buckets[b] += 1;
  }

  // Find the longest run of "empty" buckets near the center.
  const EMPTY_THRESHOLD = Math.max(2, items.length * 0.005); // truly empty, not just sparse
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let i = 0; i < N; i += 1) {
    if (buckets[i] <= EMPTY_THRESHOLD) {
      if (runStart < 0) runStart = i;
      const len = i - runStart + 1;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
    } else {
      runStart = -1;
    }
  }

  if (bestLen < N * 0.10) return null; // gap must span >= 10% of width

  const gapCenter = (bestStart + bestLen / 2) / N;
  if (gapCenter < 0.30 || gapCenter > 0.70) return null; // gap must be near the middle

  // Re-check balance: count items strictly left vs. right of the gap.
  const splitX = ((bestStart + bestLen / 2) / N) * pageWidth;
  let left = 0;
  let right = 0;
  for (const it of items) {
    if (it.x < splitX) left += 1;
    else right += 1;
  }
  if (left < items.length * 0.25 || right < items.length * 0.25) return null;

  return splitX;
}

async function extractPdfText(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await fs.readFile(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        h: it.height || 10,
      }))
      .filter((it) => it.str && it.str.trim());

    const split = detectColumnSplit(items, viewport.width);
    let pageLines;
    if (split != null) {
      const left = items.filter((it) => it.x < split);
      const right = items.filter((it) => it.x >= split);
      pageLines = [...itemsToLines(left), '__COLUMN_BREAK__', ...itemsToLines(right)];
    } else {
      pageLines = itemsToLines(items);
    }
    pages.push(pageLines.join('\n'));
  }
  await doc.cleanup?.();
  return pages.join('\n\n');
}

async function extractDocxText(filePath) {
  const { value } = await mammoth.extractRawText({ path: filePath });
  return value;
}

// Note: trailing ":" is tolerated (e.g. "Professional Experience:")
const SECTION_HEADERS = {
  summary: /^(profile|about me|about|summary|objective|professional summary)\s*:?\s*$/i,
  skills: /^(skills|tech skills|technical skills|core expertise|expertise|core skills)\s*:?\s*$/i,
  experience: /^(experience|work experience|employment|professional experience|work history|military service)\s*:?\s*$/i,
  projects: /^(projects|personal projects|key projects|side projects)\s*:?\s*$/i,
  education: /^(education|academic|qualifications)\s*:?\s*$/i,
  languages: /^(languages|language)\s*:?\s*$/i,
  achievements: /^(achievements|awards|honors|certifications)\s*:?\s*$/i,
  contact: /^(contact|contact info|contact information|personal info)\s*:?\s*$/i,
};

function normalizeHeader(s) {
  // "E D U C A T I O N" -> "EDUCATION"; "T E C H  S K I L L S" -> "TECH SKILLS"
  if (/^(?:[A-Za-z]\s){2,}[A-Za-z]\s*$/.test(s)) {
    return s.replace(/(?<=[A-Za-z])\s(?=[A-Za-z](?:\s|$))/g, '');
  }
  return s;
}

const SECTION_TERMS = {
  summary: ['profile', 'about me', 'about', 'summary', 'objective', 'professional summary'],
  skills: ['skills', 'tech skills', 'technical skills', 'core expertise', 'expertise', 'core skills'],
  experience: ['experience', 'work experience', 'employment', 'professional experience', 'work history', 'military service'],
  projects: ['projects', 'personal projects', 'key projects', 'side projects'],
  education: ['education', 'academic', 'qualifications'],
  languages: ['languages', 'language'],
  achievements: ['achievements', 'awards', 'honors', 'certifications'],
  contact: ['contact', 'contact info', 'contact information', 'personal info'],
};

const SECTION_TERMS_NOSP = {};
for (const [k, terms] of Object.entries(SECTION_TERMS)) {
  SECTION_TERMS_NOSP[k] = terms.map((t) => t.replace(/\s+/g, ''));
}

function detectSection(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.length > 60) return null;
  const candidates = [trimmed, normalizeHeader(trimmed)];
  for (const cand of candidates) {
    for (const [name, re] of Object.entries(SECTION_HEADERS)) {
      if (re.test(cand)) return name;
    }
  }
  // Last resort: despaced match (handles "MILITARYSERVICE" from "M I L I T A R Y  S E R V I C E"
  // when word-boundary double-spaces collapsed during line normalization).
  const despaced = trimmed.replace(/\s+/g, '').toLowerCase();
  if (despaced.length >= 4 && despaced.length <= 32) {
    for (const [name, terms] of Object.entries(SECTION_TERMS_NOSP)) {
      if (terms.includes(despaced)) return name;
    }
  }
  return null;
}

function extractContact(text) {
  const personalInfo = {};
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch) personalInfo.email = emailMatch[0];
  const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  if (phoneMatch) personalInfo.phone = phoneMatch[1].trim();
  const linkedinMatch = text.match(/linkedin\.com\/[\w-]+\/[\w-]+/i);
  if (linkedinMatch) personalInfo.linkedin = linkedinMatch[0];
  const githubMatch = text.match(/github\.com\/[\w-]+/i);
  if (githubMatch) personalInfo.github = githubMatch[0];
  return personalInfo;
}

function splitBullets(text) {
  return text
    .split(/[\n\r]+|(?:•|·|◦|■|●|⁃|-\s)/)
    .map((s) => s.replace(/^[\s•·◦■●⁃-]+/, '').trim())
    .filter((s) => s.length > 5);
}

// A line that begins with a date range followed by a pipe is treated as a new
// experience entry header (single-column dated-pipe style: "2023 - Present | Role, Company").
const ROLE_HEADER_RE = /^(\d{1,2}\/)?(\d{4})\s*[-–—]\s*(present|\d{1,2}\/?\d{2,4})\s*\|/i;

function splitOnRoleHeaders(text) {
  if (!text || !text.trim()) return [];
  const lines = text.split('\n');
  const blocks = [];
  let current = [];
  const flush = () => {
    const block = current.join('\n').trim();
    if (block) blocks.push(block);
    current = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      // Blank line — finishes the current block.
      if (current.length) flush();
      continue;
    }
    if (ROLE_HEADER_RE.test(line) && current.length) {
      // A new role header mid-flow finishes the previous block.
      flush();
    }
    current.push(line);
  }
  flush();
  return blocks;
}

// Date format normalization. Research §61–82: ATS parsers reject
// `Jan '21`, year-only `2021 – 2023`, and single-digit-month forms.
// Convert to ATS-safe variants. Always emit the en-dash separator.

const MONTH_MAP = {
  jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May',
  jun: 'June', jul: 'July', aug: 'August', sep: 'September', sept: 'September',
  oct: 'October', nov: 'November', dec: 'December',
  january: 'January', february: 'February', march: 'March', april: 'April',
  june: 'June', july: 'July', august: 'August', september: 'September',
  october: 'October', november: 'November', december: 'December',
};

function expandYear(yy) {
  // 2-digit year heuristic: 00-39 → 2000s, 40-99 → 1900s. Adjust threshold as needed.
  const n = Number(yy);
  if (Number.isNaN(n)) return yy;
  if (yy.length === 2) return String(n <= 39 ? 2000 + n : 1900 + n);
  return yy;
}

function normalizeOneEndpoint(s) {
  if (!s) return s;
  const t = s.trim();
  if (/^present|current|now$/i.test(t)) return 'Present';

  // "Jan '21" / "Jan 21" / "Jan 2021" / "January 2021"
  const m1 = t.match(/^([A-Za-z]{3,9})\.?\s*['']?(\d{2,4})$/);
  if (m1) {
    const monLower = m1[1].toLowerCase();
    const mon = MONTH_MAP[monLower];
    if (mon) return `${mon} ${expandYear(m1[2])}`;
  }

  // "01/2021" / "1/2021" / "01/21"
  const m2 = t.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (m2) {
    const mm = String(m2[1]).padStart(2, '0');
    return `${mm}/${expandYear(m2[2])}`;
  }

  // "2021" alone — leave as-is (caller decides whether to flag ambiguity).
  if (/^\d{4}$/.test(t)) return t;

  return t;
}

export function normalizeDateRange(input) {
  if (!input || typeof input !== 'string') return { value: input || '', ambiguous: false };
  // Unify separators to en-dash for normalization, but accept any dash form.
  const cleaned = input
    .replace(/\s*[-–—]\s*/, ' – ')
    .replace(/[''‛]/g, "'")
    .trim();
  const parts = cleaned.split(/\s+–\s+/);
  if (parts.length !== 2) {
    // Not a range; just normalize a single endpoint.
    const single = normalizeOneEndpoint(cleaned);
    const ambiguous = /^\d{4}$/.test(single);
    return { value: single, ambiguous };
  }
  const left = normalizeOneEndpoint(parts[0]);
  const right = normalizeOneEndpoint(parts[1]);
  const ambiguous = /^\d{4}$/.test(left) && /^(\d{4}|Present)$/.test(right);
  return { value: `${left} – ${right}`, ambiguous };
}

function parseExperienceBlock(block) {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const entry = { role: '', company: '', dates: '', bullets: [] };
  const datePattern = /(\d{1,2}\/)?(\d{4})\s*[-–—]\s*(present|\d{1,2}\/?\d{2,4})/i;

  // Strategy A — "Dates | Role, Company" (single-line header, dated-pipe style)
  const firstLine = lines[0] || '';
  const inlineMatch = firstLine.match(/^(.+?)\s*\|\s*(.+)$/);
  if (inlineMatch) {
    const left = inlineMatch[1].trim();
    const right = inlineMatch[2].trim();
    const leftDate = left.match(datePattern);
    if (leftDate) {
      entry.dates = normalizeDateRange(leftDate[0]).value;
      // right side is "Role, Company" or just "Role"
      const commaIdx = right.lastIndexOf(',');
      if (commaIdx > 0) {
        entry.role = right.slice(0, commaIdx).trim();
        entry.company = right.slice(commaIdx + 1).trim();
      } else {
        entry.role = right;
      }
      entry.bullets = lines
        .slice(1)
        .flatMap((l) => splitBullets(l))
        .filter(Boolean);
      if (!entry.bullets.length && lines.length > 1) entry.bullets = lines.slice(1);
      return entry;
    }
  }

  // Strategy B — date appears anywhere in the first few lines (existing logic)
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const dateMatch = lines[i].match(datePattern);
    if (dateMatch && !entry.dates) {
      entry.dates = normalizeDateRange(dateMatch[0]).value;
      lines[i] = lines[i].replace(datePattern, '').trim();
    }
  }
  entry.role = lines[0] || '';
  if (lines.length > 1) entry.company = lines[1];
  entry.bullets = lines
    .slice(2)
    .flatMap((l) => splitBullets(l))
    .filter(Boolean);
  if (!entry.bullets.length && lines.length > 2) entry.bullets = lines.slice(2);
  return entry;
}

export function structureCv(rawText) {
  const lines = rawText.split('\n');
  const sections = { header: [] };
  let current = 'header';
  let prevWasBlank = false;
  for (const rawLine of lines) {
    if (rawLine === '__COLUMN_BREAK__') {
      // Crossing into a new column — assume the next block is a fresh header until a section is detected.
      current = 'header';
      prevWasBlank = true;
      continue;
    }
    const line = rawLine.trim();
    if (!line) {
      if (!prevWasBlank) sections[current].push('');
      prevWasBlank = true;
      continue;
    }
    prevWasBlank = false;
    const detected = detectSection(line);
    if (detected) {
      current = detected;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    sections[current].push(line);
  }

  const headerText = (sections.header || []).join('\n');
  const personalInfo = extractContact(rawText);

  // Search ALL lines (not just header) for a big all-caps name and role title.
  const allLines = lines.map((l) => l.trim()).filter(Boolean);
  const sectionWordSet = new Set([
    'profile','about','about me','summary','objective','skills','tech skills','technical skills',
    'experience','work experience','employment','professional experience','work history',
    'military service','projects','education','languages','language','achievements','awards',
    'honors','certifications','contact','contact information','core expertise','expertise',
  ]);
  const isSectionLike = (s) => sectionWordSet.has(normalizeHeader(s).toLowerCase().trim());

  // Name detection: try several patterns in order
  // 1. "Name | Title" with pipe separator (common in single-column CVs)
  // 2. All-caps name like "FIRST LAST" (Canva-style)
  // 3. Title-case name like "Jane Doe" (capitalized words)
  const isAllCapsName = (l) => {
    if (!l || l.length < 4 || l.length > 40) return false;
    if (/@|http|\d/.test(l)) return false;
    const norm = normalizeHeader(l);
    if (isSectionLike(norm)) return false;
    return /^[A-ZÀ-Ý][A-ZÀ-Ý\s'.-]+$/.test(norm) && norm.includes(' ');
  };
  const isTitleCaseName = (l) => {
    if (!l || l.length < 4 || l.length > 40) return false;
    if (/@|http|\d/.test(l)) return false;
    if (isSectionLike(l)) return false;
    // 2+ capitalized words, possibly with hyphens/apostrophes
    return /^([A-ZÀ-Ý][a-zà-ÿ.'-]+\s+){1,3}[A-ZÀ-Ý][a-zà-ÿ.'-]+$/.test(l);
  };
  const isPipedHeader = (l) => l && l.includes('|') && l.length < 120 && !/@|http|\d{3}/.test(l);

  let nameIdx = -1;
  let nameCandidate = null;
  let pipedTitleCandidate = null;

  // First pass: pipe-separated "Name | Title"
  for (let i = 0; i < Math.min(8, allLines.length); i++) {
    const l = allLines[i];
    if (!isPipedHeader(l)) continue;
    const parts = l.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0];
      if (isAllCapsName(first) || isTitleCaseName(first)) {
        nameIdx = i;
        nameCandidate = first;
        // Use remaining piped chunks (joined) as title
        pipedTitleCandidate = parts.slice(1).join(' | ');
        break;
      }
    }
  }

  // Second pass: all-caps, then title case
  if (nameIdx < 0) {
    nameIdx = allLines.findIndex(isAllCapsName);
    if (nameIdx >= 0) nameCandidate = allLines[nameIdx];
  }
  if (nameIdx < 0) {
    nameIdx = allLines.findIndex(isTitleCaseName);
    if (nameIdx >= 0) nameCandidate = allLines[nameIdx];
  }

  if (nameCandidate) personalInfo.name = normalizeHeader(nameCandidate);

  // Title: prefer (a) the piped title from the name line, (b) the next clean line.
  let titleCandidate = pipedTitleCandidate || null;
  if (!titleCandidate && nameIdx >= 0) {
    for (let k = nameIdx + 1; k < Math.min(nameIdx + 4, allLines.length); k += 1) {
      const l = allLines[k];
      if (!l || l.length > 60) continue;
      if (/@|http/.test(l)) continue;
      const norm = normalizeHeader(l);
      if (isSectionLike(norm)) continue;
      titleCandidate = norm;
      break;
    }
  }
  if (!titleCandidate) {
    titleCandidate = allLines.find(
      (l) =>
        l !== nameCandidate &&
        l.length < 60 &&
        !/@|http|\d{3}/.test(l) &&
        !isSectionLike(l) &&
        /engineer|developer|manager|director|analyst|designer|student|lead|architect|consultant|specialist|officer|head of|chief|pricing|monetization|product/i.test(l)
    );
  }
  if (titleCandidate) personalInfo.title = titleCandidate;

  let summary = (sections.summary || []).join(' ').trim();
  // Fallback: when no explicit Summary section was detected, treat the
  // paragraph(s) sitting in 'header' after name/contact lines as the summary.
  if (!summary && Array.isArray(sections.header) && sections.header.length) {
    const headerCopy = [...sections.header];
    const isContactLike = (l) =>
      /@/.test(l) ||
      /https?:\/\//i.test(l) ||
      /linkedin\.com|github\.com/i.test(l) ||
      /^[+\d][\d\s().+-]{6,}$/.test(l) ||
      // Anything piped + containing phone-like or @ or url is contact, not summary
      (l.includes('|') && /(@|http|linkedin|github|^\s*\+?\d{2,3}[\s.-])/i.test(l));
    const nameLower = (nameCandidate || '').toLowerCase();
    const titleLower = (titleCandidate || '').toLowerCase();
    const candidate = headerCopy
      .filter((l) => {
        if (!l) return false;
        if (l === nameCandidate || l === titleCandidate) return false;
        const lower = l.toLowerCase();
        // Filter out the name-line (which may be "Name | Title" combined)
        if (nameLower && lower.includes(nameLower) && l.length < 100) return false;
        if (titleLower && lower.includes(titleLower) && l.length < 100) return false;
        if (isContactLike(l)) return false;
        if (isSectionLike(l)) return false;
        return true;
      })
      .join(' ')
      .trim();
    if (candidate.length > 40) summary = candidate;
  }

  const skillsLines = (sections.skills || []).map((l) => l.trim()).filter(Boolean);
  const skills = [];
  for (const line of skillsLines) {
    const colonMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (colonMatch) {
      skills.push({
        category: colonMatch[1].trim().replace(/\s+/g, ' '),
        items: colonMatch[2].split(/[,;]/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean),
      });
      continue;
    }
    // Continuation of previous category, OR a soft-skill bullet.
    const items = line.split(/[,;]/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const lastGroup = skills.length ? skills[skills.length - 1] : null;
    const lastIsCategory = lastGroup && lastGroup.category !== 'Skills';

    if (lastIsCategory) {
      // Treat as a wrapped continuation of the last categorized group.
      lastGroup.items.push(...items);
      continue;
    }
    if (items.length > 1) {
      skills.push({ category: 'Skills', items });
    } else if (line) {
      // Single token — soft skill bullet under "Skills"
      const lastSoft = skills.find((s) => s.category === 'Skills');
      if (lastSoft) lastSoft.items.push(line);
      else skills.push({ category: 'Skills', items: [line] });
    }
  }

  const experienceText = (sections.experience || []).join('\n');
  // Split into blocks. Two triggers: (a) blank lines, (b) a new role header
  // like "2023 - Present | …" appearing mid-flow (single-column dated-pipe style).
  const expBlocks = splitOnRoleHeaders(experienceText);
  const experience = expBlocks.map(parseExperienceBlock).filter(Boolean);

  const projectsText = (sections.projects || []).join('\n');
  const projectBlocks = projectsText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const projects = projectBlocks.map((b) => {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    return {
      name: lines[0] || 'Project',
      description: lines[1] || '',
      bullets: lines.slice(2).flatMap(splitBullets),
    };
  });

  const educationText = (sections.education || []).join('\n');
  const eduBlocks = educationText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const education = eduBlocks.map((b) => {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    return {
      degree: lines[0] || '',
      institution: lines[1] || '',
      dates: lines.find((l) => /\d{4}/.test(l)) || '',
    };
  });

  const languagesText = (sections.languages || []).join('\n');
  const languages = languagesText
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^([^-–—:]+)\s*[-–—:]\s*(.+)$/);
      if (m) return { name: m[1].trim(), level: m[2].trim() };
      return { name: s, level: '' };
    });

  // Achievements: lines inside the Awards/Honors/Certifications section accumulator,
  // collapsed into one-line items.
  const achievementsLines = (sections.achievements || []).map((l) => l.trim()).filter(Boolean);
  const achievements = [];
  for (const line of achievementsLines) {
    const stripped = line.replace(/^[-•*]\s*/, '').trim();
    if (stripped) achievements.push(stripped);
  }

  void headerText;
  void require;

  return {
    personalInfo,
    summary,
    skills,
    experience,
    projects,
    education,
    languages,
    achievements,
  };
}

function emptyCv() {
  return {
    personalInfo: { name: '', title: '', email: '', phone: '', linkedin: '', github: '', location: '' },
    summary: '',
    skills: [],
    experience: [],
    projects: [],
    education: [],
    languages: [],
    achievements: [],
  };
}

function normalizeAiCv(raw) {
  const base = emptyCv();
  if (!raw || typeof raw !== 'object') return base;
  const pi = raw.personalInfo || {};
  base.personalInfo = {
    name: pi.name || '',
    title: pi.title || '',
    email: pi.email || '',
    phone: pi.phone || '',
    linkedin: pi.linkedin || '',
    github: pi.github || '',
    location: pi.location || '',
  };
  base.summary = typeof raw.summary === 'string' ? raw.summary : '';
  base.skills = Array.isArray(raw.skills)
    ? raw.skills
        .map((s) => ({ category: s?.category || 'Skills', items: Array.isArray(s?.items) ? s.items.filter(Boolean) : [] }))
        .filter((s) => s.items.length)
    : [];
  base.experience = Array.isArray(raw.experience)
    ? raw.experience
        .map((e) => ({
          role: e?.role || '',
          company: e?.company || '',
          dates: e?.dates ? normalizeDateRange(String(e.dates)).value : '',
          bullets: Array.isArray(e?.bullets) ? e.bullets.filter(Boolean) : [],
        }))
        .filter((e) => e.role || e.company || e.bullets.length)
    : [];
  base.projects = Array.isArray(raw.projects)
    ? raw.projects
        .map((p) => ({
          name: p?.name || '',
          description: p?.description || '',
          bullets: Array.isArray(p?.bullets) ? p.bullets.filter(Boolean) : [],
        }))
        .filter((p) => p.name || p.description || p.bullets.length)
    : [];
  base.education = Array.isArray(raw.education)
    ? raw.education
        .map((e) => ({
          degree: e?.degree || '',
          institution: e?.institution || '',
          dates: e?.dates ? normalizeDateRange(String(e.dates)).value : '',
        }))
        .filter((e) => e.degree || e.institution)
    : [];
  base.languages = Array.isArray(raw.languages)
    ? raw.languages.map((l) => ({ name: l?.name || '', level: l?.level || '' })).filter((l) => l.name)
    : [];
  base.achievements = Array.isArray(raw.achievements)
    ? raw.achievements
        .map((a) => (typeof a === 'string' ? a.trim() : a?.text?.trim?.() || ''))
        .filter(Boolean)
    : [];
  return base;
}

// Heuristic Hebrew + English match for high-school-level entries we want to
// drop in Israeli market mode (research §200).
const HIGH_SCHOOL_RE = /\b(high\s*school|secondary\s*school|gymnasium|yeshiva|seminary|ulpan|תיכון|ישיבה|אולפן)\b/i;

function isHighSchoolEntry(e) {
  if (!e) return false;
  const blob = `${e.degree || ''} ${e.institution || ''}`.trim();
  return HIGH_SCHOOL_RE.test(blob);
}

export async function extractCvFromFile(filePath, mimeType, { targetMarket } = {}) {
  const ext = path.extname(filePath).toLowerCase();
  let text;
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    text = await extractPdfText(filePath);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    text = await extractDocxText(filePath);
  } else {
    throw Object.assign(new Error('Unsupported file type. Upload PDF or DOCX.'), { status: 400 });
  }

  // Prefer LLM extraction when OpenAI provider is configured; fall back gracefully.
  let cv;
  let usedAi = false;
  if (currentProvider() === 'openai') {
    try {
      const aiResult = await extractCvWithAI(text, { targetMarket });
      if (aiResult) {
        cv = normalizeAiCv(aiResult);
        usedAi = true;
      }
    } catch (err) {
      console.warn('[extraction] OpenAI extraction failed, falling back to heuristic:', err.message);
    }
  }
  if (!cv) cv = structureCv(text);

  // Belt-and-braces Israeli-market filter: drop high-school entries even if the
  // LLM included one anyway (or the heuristic path was used).
  if (targetMarket === 'israel' && Array.isArray(cv.education)) {
    cv.education = cv.education.filter((e) => !isHighSchoolEntry(e));
  }

  return { cv, rawText: text, usedAi };
}
