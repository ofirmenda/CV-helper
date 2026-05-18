import { mockTailor } from './mockAI.js';
import { normalizeDateRange } from './extractionService.js';

function getProvider() {
  return (process.env.AI_PROVIDER || 'mock').toLowerCase();
}

// All approved users share the admin's OpenAI key, set once in server/.env.
// This keeps individual users from needing to obtain or paste a key.
function resolveOpenAiKey({ allowMissing = false } = {}) {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (allowMissing) return null;
  const err = new Error(
    'OPENAI_API_KEY is not set on the server. Ask the admin to configure it in server/.env.'
  );
  err.status = 503;
  err.code = 'NO_OPENAI_KEY';
  throw err;
}

const SYSTEM_TAILOR = `You are a CV tailoring assistant.

RULES (non-negotiable):
- NEVER invent experience, dates, employers, companies, schools, skills, or projects.
- Only rewrite, reorder, or emphasize content that already exists in the user's CV.
- A keyword from the job description may be added ONLY if it is already implicitly demonstrated by an existing bullet (e.g. "shipped REST endpoints" implies "REST API").
- Education and Languages MUST NOT be modified — they are factual.
- Achievements: keep the literal claim intact (awards, certifications, honors are factual). You MAY tighten phrasing to one-line bullets, but never invent recognitions and never inflate scope.
- Each section must include before/after/changes/reason.

PRESERVE EXISTING SIGNAL (non-negotiable):
- If a keyword from 'matched_keywords' or 'partial_keywords' appears in the original section text, it MUST appear in the rewritten version. Compression removes filler, NOT signal.
- Dropping a matched keyword during a rewrite is a hard failure — re-do the rewrite if you notice it.
- This applies especially to the Summary: when tightening to 3–4 sentences, retain every matched JD keyword that the original summary already contained.

FORMATTING (critical — output validation depends on it):
- 'before' and 'after' MUST BE STRINGS, never arrays or objects.
- For Skills: format as multi-line "Category: item, item, item" — one category per line.
- For Experience: one role per block, separated by blank lines. First line: "Role — Company (Dates)". Following lines: bullets prefixed with "- ".
- For Projects: one project per block. First line: project name. Optional second line: short description. Following lines: bullets prefixed with "- ".
- For Education: one entry per line: "Degree — Institution (Dates)".
- For Languages: one per line: "Language — Level".
- For Achievements: one per line, plain text (no leading "- ").
- For Summary: plain text paragraph.

DATE FORMATS (ATS parsers reject ambiguous dates):
- Use either "Month YYYY – Month YYYY" (e.g. "January 2021 – March 2023") or "MM/YYYY – MM/YYYY" (e.g. "01/2021 – 03/2023").
- Never abbreviated apostrophe years ("Jan '21") or year-only ranges ("2021 – 2023").
- Always normalize "current" / "now" to "Present".

STAR & BULLET QUALITY (research §88–141):
Every Experience and Projects bullet MUST follow the STAR framework (Situation → Task → Action → Result), condensed into one tight line. Hard rules:
1. Length: ≤ 25 words (target 20). Strip filler ("in order to", "with the goal of", "I was able to").
2. Lead with a strong active verb (NOT "I", "we", "responsible for", "tasked with", "helped with", "duties included", "worked on", "assisted with", "involved in", "experience with", "served as"). Acceptable openers include:
   spearheaded, accelerated, slashed, owned, led, designed, shipped, scaled, automated, migrated, launched, optimized, reduced, increased, integrated, architected, mentored, drove, delivered, partnered, refactored, built, eliminated, consolidated, modernized, instrumented, streamlined, secured, championed, taught, established, generated, negotiated, transformed, unlocked, productionized.
3. End with a QUANTIFIED outcome whenever the source supports it (%, $, x-multiplier, time saved, scale). If the original CV has no number, do NOT invent one — keep the original facts and skip the metric. State this in 'changes' as "Note: no quantitative outcome available in source."
4. Omit personal pronouns ("I", "we"). Voice is active, third-person-implied.

SUMMARY (research §110): exactly 3–4 sentences, structured as a "movie trailer":
  S1: who you are + years of relevant experience + role pitch.
  S2–3: 1–2 of your strongest, quantified accomplishments (only if present in source).
  S4 (optional): a closing value proposition referencing 2–3 top JD keywords.
Never invent metrics or claims that aren't in the source CV.

KEYWORD INTEGRATION:
You will receive three lists drawn from the job description:
  matched_keywords — already present in the CV; surface them more prominently.
  partial_keywords — partially matched (e.g. CV has "REST" but JD asks "REST API"); upgrade the phrasing where literally accurate.
  missing_keywords — absent from the CV. For EACH missing keyword:
    1. Scan the CV for evidence that this skill / tool is implicitly demonstrated.
    2. If yes → weave the exact JD term into the relevant section (Summary / Skills / Experience / Projects) and explain in 'changes' WHICH evidence justified it.
    3. If no evidence → DO NOT add it. List it under the section's 'reason' field as "Could not safely add: <keyword> — no implicit evidence in CV."

USER-PROVIDED CONTEXT:
You may also receive 'user_provided_context_for_missing_keywords' — an array of {keyword, explanation} pairs where the user described their actual relation to a missing keyword (e.g. "I built REST APIs at NovaWave in 2019"). For these:
  - Treat the explanation as TRUE additional context — you may use it to justify weaving the keyword into the CV, even though it wasn't in the original CV text.
  - Add or expand a bullet in the most fitting Experience/Project section to reflect what the user described, in their own words (paraphrase minimally).
  - In 'changes', cite the user explanation as the source: "Added per user context: '<short quote from explanation>'".
  - Do NOT add details beyond what the user explained.

USER-CONFIRMED ABSENT (overrides everything else):
You may also receive 'user_confirmed_absent_keywords' — an array of strings, keywords the user EXPLICITLY said they do NOT have experience with. For each:
  - NEVER weave the keyword into any section. NEVER imply experience the user has denied.
  - In the relevant section's 'reason', note: "User confirmed no experience with: <keyword>."
  - This rule overrides every other signal, including GitHub evidence below — a "no" from the user is final.

GITHUB EVIDENCE:
You may also receive 'github_evidence' — an array of {keyword, repo, source, evidence, url} from the user's public GitHub repos for missing keywords. For each:
  - Treat as LEGITIMATE evidence — it is the user's own shipped code.
  - You MAY weave the keyword into the most fitting section (Skills / Projects / Experience), UNLESS the keyword also appears in 'user_confirmed_absent_keywords' (their explicit "no" wins).
  - In 'changes', cite the GitHub source: "Added per GitHub repo '<repo>' (<source>): <short evidence excerpt>".
  - Do NOT fabricate details beyond what the GitHub evidence shows.

Each section's 'changes' array must concretely state which JD keywords you weaved in and where. Each section's 'reason' must connect the changes back to the JD's priorities.

Respond with ONLY valid JSON matching the requested schema. No prose, no markdown fences.`;

async function tailorWithOpenAI(cv, jd, analysis) {
  const apiKey = resolveOpenAiKey();
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  // analysis.userContext: optional array of { keyword, explanation } provided by
  // the user about missing keywords (e.g. "I worked on REST APIs at NovaWave in 2019").
  const userContext = (analysis.userContext || []).filter((c) => c && c.keyword && c.explanation && c.explanation.trim().length > 5);
  // analysis.confirmedAbsent: keywords the user explicitly said they don't have.
  // analysis.githubEvidence: [{ keyword, repo, source, evidence, url }] from the
  // GitHub scan in the Missing-Keywords Q&A step.
  const confirmedAbsent = (analysis.confirmedAbsent || []).filter((k) => typeof k === 'string' && k.trim().length);
  const githubEvidence = (analysis.githubEvidence || []).filter(
    (g) => g && g.keyword && (g.repo || g.evidence || g.source)
  );

  const userPayload = {
    cv,
    job_description: jd,
    matched_keywords: analysis.matched.map((k) => k.term),
    partial_keywords: analysis.partial.map((k) => k.term),
    missing_keywords: analysis.missing.map((k) => k.term),
    user_provided_context_for_missing_keywords: userContext,
    user_confirmed_absent_keywords: confirmedAbsent,
    github_evidence: githubEvidence,
    response_schema: {
      sections: {
        summary: { before: 'string', after: 'string', changes: ['string'], reason: 'string' },
        skills: { before: 'string', after: 'string', changes: ['string'], reason: 'string' },
        experience: { before: 'string', after: 'string', changes: ['string'], reason: 'string' },
        projects: { before: 'string', after: 'string', changes: ['string'], reason: 'string' },
        education: { before: 'string', after: 'string', changes: ['string'], reason: 'string' },
        languages: { before: 'string', after: 'string', changes: ['string'], reason: 'string' },
        achievements: { before: 'string', after: 'string', changes: ['string'], reason: 'string' },
      },
    },
  };

  const response = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 2400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_TAILOR },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI.');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, '');
    parsed = JSON.parse(cleaned);
  }
  if (!parsed.sections) throw new Error('OpenAI response missing "sections" key.');

  // Safety net: AI sometimes returns arrays/objects for before/after on structured sections.
  // Coerce to human-readable strings so the diff/wizard works regardless.
  for (const [name, sec] of Object.entries(parsed.sections || {})) {
    if (!sec || typeof sec !== 'object') continue;
    sec.before = coerceToString(sec.before, name);
    sec.after = coerceToString(sec.after, name);
    if (!Array.isArray(sec.changes)) sec.changes = sec.changes ? [String(sec.changes)] : [];
    if (typeof sec.reason !== 'string') sec.reason = sec.reason ? String(sec.reason) : '';
  }
  return parsed;
}

function coerceToString(val, sectionName) {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    // Render structured arrays into the human formats we expect.
    if (sectionName === 'skills') {
      return val
        .map((g) =>
          g && typeof g === 'object'
            ? `${g.category || 'Skills'}: ${Array.isArray(g.items) ? g.items.join(', ') : ''}`
            : String(g)
        )
        .join('\n');
    }
    if (sectionName === 'experience') {
      return val
        .map((e) => {
          if (!e || typeof e !== 'object') return String(e);
          const dates = e.dates ? normalizeDateRange(e.dates).value : '';
          const header = `${e.role || ''} — ${e.company || ''} (${dates})`;
          const bullets = Array.isArray(e.bullets) ? e.bullets.map((b) => `- ${b}`).join('\n') : '';
          return `${header}\n${bullets}`;
        })
        .join('\n\n');
    }
    if (sectionName === 'projects') {
      return val
        .map((p) => {
          if (!p || typeof p !== 'object') return String(p);
          const header = p.name || '';
          const desc = p.description || '';
          const bullets = Array.isArray(p.bullets) ? p.bullets.map((b) => `- ${b}`).join('\n') : '';
          return [header, desc, bullets].filter(Boolean).join('\n');
        })
        .join('\n\n');
    }
    if (sectionName === 'education') {
      return val
        .map((e) =>
          e && typeof e === 'object'
            ? `${e.degree || ''} — ${e.institution || ''}${e.dates ? ` (${e.dates})` : ''}`
            : String(e)
        )
        .join('\n');
    }
    if (sectionName === 'languages') {
      return val
        .map((l) =>
          l && typeof l === 'object' ? `${l.name || ''}${l.level ? ` — ${l.level}` : ''}` : String(l)
        )
        .join('\n');
    }
    if (sectionName === 'achievements') {
      return val.map((a) => (typeof a === 'string' ? a : a?.text || JSON.stringify(a))).join('\n');
    }
    return val.map(String).join('\n');
  }
  return JSON.stringify(val);
}

export async function tailor(cv, jd, analysis) {
  const provider = getProvider();
  if (provider === 'openai') {
    return await tailorWithOpenAI(cv, jd, analysis);
  }
  return mockTailor(cv, jd, analysis);
}

const SYSTEM_RECRUITER_CRITIQUE = `You are an experienced technical recruiter and hiring manager.

You will receive:
1. A user's CV (structured JSON).
2. (Optional) a target job description.
3. (Optional) ATS analysis: matched / partial / missing keywords against the JD.

Your job is NOT to rewrite everything. Instead, deliver a focused, candid critique in five steps.

STEP 1 — Critique (top 5 weaknesses, with a concrete fix for each)
- Identify the FIVE most impactful weaknesses.
- For each weakness, provide THREE fields:
    'point'    — 1-sentence diagnosis.
    'evidence' — a short quote from the CV that demonstrates the weakness.
    'fix'      — a concrete, actionable proposal (≤25 words) the user could apply themselves.
- Be specific and honest; avoid generic advice. "Add metrics" alone is NOT a fix; "Rewrite the Acme bullet 'Worked on dashboards' as a quantified outcome (e.g. cut QBR prep 4h → 30min)" IS.
- Focus on impact, clarity, and competitiveness against the JD (or against industry norms when no JD).
- The 'fix' may propose a replacement line, suggest adding a specific item, or call out a section to reorder — but must always be concrete enough that the user can act on it without further clarification.
- NEVER invent metrics or claims. If a number isn't in the source, suggest the user supply one, don't fabricate.

STEP 2 — Positioning
- "Current" — what kind of candidate the CV makes the user look like (1 sentence).
- "Target" — what kind of candidate the JD wants (1 sentence). If no JD, infer from title/skills.
- "Gap" — 1–2 sentence diagnosis bridging the two.

STEP 3 — Targeted improvements
- Rewrite ONLY the parts that matter most: the summary, plus AT MOST 2–3 individual experience bullets.
- Each rewritten bullet must follow STAR (Situation → Task → Action → Result), ≤ 25 words, active verb opener, quantified outcome WHERE SUPPORTED BY THE SOURCE. Never invent metrics.
- Reference each bullet by its entryIndex (which experience role) and bulletIndex (which bullet inside).

STEP 4 — ATS / missing keywords
- For each truly important missing JD term, propose a single natural sentence the user could weave in.
- Do NOT suggest adding keywords with no plausible basis in the CV.

STEP 5 — Change log
- For every change you propose, one line "what" + one line "why".

CONSTRAINTS (non-negotiable):
- NEVER fabricate experience, dates, employers, schools, skills, or projects.
- Concise. Non-generic. Prefer concrete claims over buzzwords.
- All before/after strings must be plain strings, never arrays.

Respond with ONLY valid JSON matching the requested schema. No prose, no markdown fences.`;

const CRITIQUE_SCHEMA = {
  weaknesses: [{
    point: 'string (1 sentence diagnosis)',
    evidence: 'string (short quote from CV)',
    fix: 'string (concrete, actionable proposal the user can apply, ≤25 words)',
  }],
  positioning: {
    current: 'string (1 sentence)',
    target: 'string (1 sentence)',
    gap: 'string (1-2 sentences)',
  },
  improvedSections: {
    summary: { before: 'string', after: 'string' },
    experienceBullets: [
      { entryIndex: 0, bulletIndex: 0, before: 'string', after: 'string' },
    ],
  },
  missingKeywords: [{ term: 'string', suggestionToInclude: 'string' }],
  changeLog: [{ change: 'string', why: 'string' }],
};

export async function critique(cv, jd, analysis = {}) {
  const provider = getProvider();
  if (provider === 'openai') return critiqueWithOpenAI(cv, jd, analysis);
  // Mock fallback returns a deterministic shape so the UI is exercisable.
  const { mockCritique } = await import('./mockAI.js');
  return mockCritique(cv, jd, analysis);
}

async function critiqueWithOpenAI(cv, jd, analysis) {
  const apiKey = resolveOpenAiKey();
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const payload = {
    cv,
    job_description: jd || null,
    ats_analysis: {
      matched: (analysis.matched || []).map((k) => (typeof k === 'string' ? k : k.term)),
      partial: (analysis.partial || []).map((k) => (typeof k === 'string' ? k : k.term)),
      missing: (analysis.missing || []).map((k) => (typeof k === 'string' ? k : k.term)),
    },
    response_schema: CRITIQUE_SCHEMA,
  };

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 2500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_RECRUITER_CRITIQUE },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI during critique.');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
  }
  return normalizeCritique(parsed);
}

// Safety net for the critique response — coerce strings, clamp counts.
function normalizeCritique(raw) {
  const out = {
    weaknesses: [],
    positioning: { current: '', target: '', gap: '' },
    improvedSections: { summary: null, experienceBullets: [] },
    missingKeywords: [],
    changeLog: [],
  };
  if (!raw || typeof raw !== 'object') return out;

  if (Array.isArray(raw.weaknesses)) {
    out.weaknesses = raw.weaknesses
      .slice(0, 5)
      .map((w) => ({
        point: String(w?.point || '').trim(),
        evidence: String(w?.evidence || '').trim(),
        fix: String(w?.fix || '').trim(),
      }))
      .filter((w) => w.point);
  }
  if (raw.positioning && typeof raw.positioning === 'object') {
    out.positioning = {
      current: String(raw.positioning.current || '').trim(),
      target: String(raw.positioning.target || '').trim(),
      gap: String(raw.positioning.gap || '').trim(),
    };
  }
  if (raw.improvedSections && typeof raw.improvedSections === 'object') {
    const sum = raw.improvedSections.summary;
    if (sum && (sum.before || sum.after)) {
      out.improvedSections.summary = {
        before: String(sum.before || '').trim(),
        after: String(sum.after || '').trim(),
      };
    }
    if (Array.isArray(raw.improvedSections.experienceBullets)) {
      out.improvedSections.experienceBullets = raw.improvedSections.experienceBullets
        .slice(0, 3)
        .map((b) => ({
          entryIndex: Number.isInteger(b?.entryIndex) ? b.entryIndex : 0,
          bulletIndex: Number.isInteger(b?.bulletIndex) ? b.bulletIndex : 0,
          before: String(b?.before || '').trim(),
          after: String(b?.after || '').trim(),
        }))
        .filter((b) => b.after);
    }
  }
  if (Array.isArray(raw.missingKeywords)) {
    out.missingKeywords = raw.missingKeywords
      .map((m) => ({
        term: String(m?.term || '').trim(),
        suggestionToInclude: String(m?.suggestionToInclude || '').trim(),
      }))
      .filter((m) => m.term);
  }
  if (Array.isArray(raw.changeLog)) {
    out.changeLog = raw.changeLog
      .map((c) => ({ change: String(c?.change || '').trim(), why: String(c?.why || '').trim() }))
      .filter((c) => c.change);
  }
  return out;
}

const SYSTEM_EXTRACT = `You extract structured CV data from raw text.

RULES (non-negotiable):
- ONLY include facts that are literally present in the text. Never invent, never fill gaps.
- If a field is missing, return an empty string or empty array — do NOT guess.
- Preserve original wording (don't paraphrase bullets).
- Group skills under their stated categories (e.g. "Frontend & Mobile", "Languages"). If the text has uncategorized soft skills as a flat list, group them under the category "Skills".
- For experience entries: capture role, company, date range, and the bullet points exactly as written.
- For projects: a project is something with a name and a description/details, often separate from work history. If the section header is "Projects" use that; otherwise infer only when obvious (e.g. a standalone item with "Plan", "App", "Game", "System" in its name that isn't tied to a company role).
- Education entries usually have a degree, an institution, and a date range.
- Languages have a name and a level (Native, Fluent, Advanced, Basic, etc.).
- Achievements: short standalone lines listing awards, certifications, recognitions, military honors, or notable accomplishments NOT tied to a specific job. Section headers commonly read "Achievements", "Awards", "Honors", "Certifications", "Recognition". Each item is ONE line — keep the original phrasing.

Respond with ONLY valid JSON matching the provided schema. No prose, no markdown fences.`;

const EXTRACT_SCHEMA = {
  personalInfo: {
    name: 'string',
    title: 'string',
    email: 'string',
    phone: 'string',
    linkedin: 'string',
    github: 'string',
    location: 'string',
  },
  summary: 'string',
  skills: [{ category: 'string', items: ['string'] }],
  experience: [{ role: 'string', company: 'string', dates: 'string', bullets: ['string'] }],
  projects: [{ name: 'string', description: 'string', bullets: ['string'] }],
  education: [{ degree: 'string', institution: 'string', dates: 'string' }],
  languages: [{ name: 'string', level: 'string' }],
  achievements: ['string'],
};

export async function extractCvWithAI(rawText, { targetMarket } = {}) {
  if (getProvider() !== 'openai') return null;
  if (!rawText || rawText.length < 30) return null;
  const apiKey = resolveOpenAiKey({ allowMissing: true });
  if (!apiKey) return null; // graceful fallback to heuristic extractor

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  // Israeli norm: omit high-school, yeshiva, or seminary education (research §200).
  const extraRules =
    targetMarket === 'israel'
      ? '\n\nISRAELI MARKET MODE: Do NOT include high school, yeshiva, ulpan, or seminary education in the education array. Only post-secondary degrees, professional certifications, and relevant training.'
      : '';

  const userPayload = {
    cv_text: rawText.slice(0, 16000),
    target_market: targetMarket || 'global',
    response_schema: EXTRACT_SCHEMA,
  };

  const systemPrompt = SYSTEM_EXTRACT + extraRules;

  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI during extraction.');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, '');
    parsed = JSON.parse(cleaned);
  }
  return parsed;
}

export function currentProvider() {
  return getProvider();
}
