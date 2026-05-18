import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import { bulletIssues, bulletsFromAfter } from '../../utils/bulletQuality.js';
import { api } from '../../api/client.js';
import SectionOrderControl from './SectionOrderControl.jsx';

const SECTION_LABEL = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  achievements: 'Achievements',
  education: 'Education',
  languages: 'Languages',
};

const MOVE_TARGETS = ['summary', 'skills', 'experience', 'projects', 'achievements', 'education', 'languages'];

function emptyCv() {
  return {
    personalInfo: { name: '', title: '', email: '', phone: '', linkedin: '', github: '', location: '' },
    summary: '',
    skills: [],
    experience: [],
    projects: [],
    achievements: [],
    education: [],
    languages: [],
    extras: [],
  };
}

function skillsToText(skills) {
  if (!Array.isArray(skills)) return '';
  return skills
    .map((s) => (typeof s === 'object' && s ? `${s.category || 'Skills'}: ${(s.items || []).join(', ')}` : String(s)))
    .join('\n');
}
function textToSkills(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^([^:]+):\s*(.+)$/);
    if (m) return { category: m[1].trim(), items: m[2].split(/,\s*/).map((s) => s.trim()).filter(Boolean) };
    return { category: 'Skills', items: [line] };
  });
}
function experienceToText(experience) {
  if (!Array.isArray(experience)) return '';
  return experience
    .map((e) => `${e.role || ''} — ${e.company || ''} (${e.dates || ''})\n${(e.bullets || []).map((b) => `- ${b}`).join('\n')}`)
    .join('\n\n');
}
function textToExperience(text) {
  if (!text || !text.trim()) return [];
  return text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const header = lines[0] || '';
    const m = header.match(/^(.+?)\s*[—-]\s*(.+?)\s*\((.+?)\)\s*$/);
    const bullets = lines.slice(1).map((l) => l.replace(/^[-•*]\s*/, '')).filter(Boolean);
    if (m) return { role: m[1].trim(), company: m[2].trim(), dates: m[3].trim(), bullets };
    return { role: header, company: '', dates: '', bullets };
  });
}
function projectsToText(projects) {
  if (!Array.isArray(projects)) return '';
  return projects
    .map((p) => `${p.name || ''}\n${p.description || ''}\n${(p.bullets || []).map((b) => `- ${b}`).join('\n')}`)
    .join('\n\n');
}
function textToProjects(text) {
  if (!text || !text.trim()) return [];
  return text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const second = lines[1] || '';
    const hasDescription = second && !/^[-•*]/.test(second);
    return {
      name: lines[0] || '',
      description: hasDescription ? second : '',
      bullets: lines.slice(hasDescription ? 2 : 1).map((l) => l.replace(/^[-•*]\s*/, '')).filter(Boolean),
    };
  });
}
function educationToText(education) {
  if (!Array.isArray(education)) return '';
  return education.map((e) => `${e.degree || ''} — ${e.institution || ''}${e.dates ? ` (${e.dates})` : ''}`).join('\n');
}
function textToEducation(text) {
  if (!text || !text.trim()) return [];
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^(.+?)\s*[—-]\s*(.+?)(?:\s*\((.+?)\))?\s*$/);
    if (m) return { degree: m[1].trim(), institution: m[2].trim(), dates: m[3]?.trim() || '' };
    return { degree: line, institution: '', dates: '' };
  });
}
function languagesToText(languages) {
  if (!Array.isArray(languages)) return '';
  return languages.map((l) => `${l.name || ''}${l.level ? ` — ${l.level}` : ''}`).join('\n');
}
function textToLanguages(text) {
  if (!text || !text.trim()) return [];
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^(.+?)\s*[—-]\s*(.+)$/);
    if (m) return { name: m[1].trim(), level: m[2].trim() };
    return { name: line, level: '' };
  });
}
function achievementsToText(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.filter(Boolean).join('\n');
}
function textToAchievements(text) {
  if (!text || !text.trim()) return [];
  return text
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

// Israeli elite tech / leadership units, surfaced as a datalist for the unit field.
const IL_UNIT_HINTS = ['8200', '81', '9900', 'Mamram', 'Talpiot', 'Shaldag', 'Matzov', 'Lotem', 'Ofek', 'Sayeret Matkal'];

export default function SectionedCVEditor({ cv, onChange }) {
  const targetMarket = useAppStore((s) => s.targetMarket);
  const isIL = targetMarket === 'israel';
  const initialCv = cv || emptyCv();
  const [pi, setPi] = useState(initialCv.personalInfo || {});
  const [summary, setSummary] = useState(initialCv.summary || '');
  const [skillsText, setSkillsText] = useState(skillsToText(initialCv.skills));
  const [experienceText, setExperienceText] = useState(experienceToText(initialCv.experience));
  const [projectsText, setProjectsText] = useState(projectsToText(initialCv.projects));
  const [educationText, setEducationText] = useState(educationToText(initialCv.education));
  const [languagesText, setLanguagesText] = useState(languagesToText(initialCv.languages));
  const [achievementsText, setAchievementsText] = useState(achievementsToText(initialCv.achievements));
  const [extras, setExtras] = useState(Array.isArray(initialCv.extras) ? initialCv.extras : []);
  const [sectionOrder, setSectionOrder] = useState(Array.isArray(initialCv.sectionOrder) ? initialCv.sectionOrder : []);

  // Suggested order comes from the latest analysis, if any.
  const suggestedOrder = useAppStore((s) => s.result?.suggestedSectionOrder || null);

  // Track the CV we last emitted upward so we can ignore the echo when the
  // parent passes that exact value back as our prop. Without this, every
  // keystroke runs `experienceText -> objects -> experienceToText` again and
  // the textarea content snaps to the reformatted version mid-edit (the user's
  // "moves weirdly" report).
  const lastEmittedRef = useRef(null);

  // Re-sync from props ONLY when the incoming cv is not what we just emitted
  // (i.e. a real external update, e.g. after upload or initial load).
  useEffect(() => {
    if (!cv) return;
    const incomingKey = JSON.stringify(cv);
    if (incomingKey === lastEmittedRef.current) return;
    setPi(cv.personalInfo || {});
    setSummary(cv.summary || '');
    setSkillsText(skillsToText(cv.skills));
    setExperienceText(experienceToText(cv.experience));
    setProjectsText(projectsToText(cv.projects));
    setEducationText(educationToText(cv.education));
    setLanguagesText(languagesToText(cv.languages));
    setAchievementsText(achievementsToText(cv.achievements));
    setExtras(Array.isArray(cv.extras) ? cv.extras : []);
    setSectionOrder(Array.isArray(cv.sectionOrder) ? cv.sectionOrder : []);
  }, [cv]);

  // Push composed cv up on every change.
  useEffect(() => {
    const composed = {
      personalInfo: pi,
      summary,
      skills: textToSkills(skillsText),
      experience: textToExperience(experienceText),
      projects: textToProjects(projectsText),
      education: textToEducation(educationText),
      languages: textToLanguages(languagesText),
      achievements: textToAchievements(achievementsText),
      extras: extras.filter((x) => x && (x.title || x.content)),
      sectionOrder: sectionOrder && sectionOrder.length ? sectionOrder : undefined,
    };
    lastEmittedRef.current = JSON.stringify(composed);
    onChange(composed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pi, summary, skillsText, experienceText, projectsText, educationText, languagesText, achievementsText, extras, sectionOrder]);

  // Move selected (or entire) text between sections.
  const setters = {
    summary: setSummary,
    skills: setSkillsText,
    experience: setExperienceText,
    projects: setProjectsText,
    achievements: setAchievementsText,
    education: setEducationText,
    languages: setLanguagesText,
  };
  const values = {
    summary,
    skills: skillsText,
    experience: experienceText,
    projects: projectsText,
    achievements: achievementsText,
    education: educationText,
    languages: languagesText,
  };

  const moveSelection = (fromKey, toKey) => {
    if (fromKey === toKey) return;
    const fromVal = values[fromKey];
    if (!fromVal) return;
    const el = document.querySelector(`[data-section="${fromKey}"] textarea`);
    let selected = '';
    let remaining = fromVal;
    if (el && el.selectionStart !== el.selectionEnd) {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      selected = fromVal.slice(s, e).trim();
      remaining = (fromVal.slice(0, s) + fromVal.slice(e)).replace(/\n{3,}/g, '\n\n').trim();
    } else {
      selected = fromVal.trim();
      remaining = '';
    }
    if (!selected) return;
    const toCurrent = values[toKey] || '';
    setters[toKey]((toCurrent ? toCurrent.trim() + '\n\n' : '') + selected);
    setters[fromKey](remaining);
  };

  const addExtra = () => {
    setExtras([...extras, { title: '', content: '' }]);
  };
  const updateExtra = (idx, patch) => {
    setExtras(extras.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };
  const removeExtra = (idx) => {
    setExtras(extras.filter((_, i) => i !== idx));
  };

  // Military helpers — Israel mode only. Stored as an extras entry with kind:'military'.
  const militaryIdx = extras.findIndex((x) => x?.kind === 'military');
  const military = militaryIdx >= 0 ? extras[militaryIdx] : null;
  const updateMilitary = (patch) => {
    if (militaryIdx >= 0) {
      setExtras(extras.map((x, i) => (i === militaryIdx ? { ...x, ...patch } : x)));
    } else {
      setExtras([
        ...extras,
        { kind: 'military', title: 'Military Service', unit: '', dates: '', content: '', ...patch },
      ]);
    }
  };
  const removeMilitary = () => {
    if (militaryIdx >= 0) setExtras(extras.filter((_, i) => i !== militaryIdx));
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-cream-200 bg-cream-50/60 px-4 py-2.5 text-xs text-ink-700 leading-relaxed">
        <span className="font-semibold text-ink-950">Edit anything.</span> Extraction sometimes merges
        sections. Type directly in any box, highlight text and use <span className="font-semibold">→</span> to
        move it elsewhere, or scroll down to <span className="font-semibold">+ Add custom section</span>.
      </div>

      <PersonalInfoBlock pi={pi} setPi={setPi} />

      {isIL && (
        <MilitaryServiceBlock
          military={military}
          onUpdate={updateMilitary}
          onRemove={removeMilitary}
        />
      )}

      <SectionOrderControl
        cv={{
          summary,
          skills: textToSkills(skillsText),
          experience: textToExperience(experienceText),
          projects: textToProjects(projectsText),
          achievements: textToAchievements(achievementsText),
          education: textToEducation(educationText),
          languages: textToLanguages(languagesText),
        }}
        value={sectionOrder}
        suggestion={suggestedOrder}
        onChange={setSectionOrder}
      />

      <Section title="Summary" hint="A short paragraph at the top of your CV." current="summary" onMove={moveSelection}>
        <textarea
          rows={4}
          className="input-light min-h-[110px] resize-y leading-relaxed"
          placeholder="Senior frontend engineer with 7+ years building production React apps…"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </Section>

      <Section title="Skills" hint="One group per line. Format: Category: item, item, item" current="skills" onMove={moveSelection}>
        <textarea
          rows={6}
          className="input-light min-h-[140px] resize-y font-mono text-[12px] leading-relaxed"
          placeholder={`Languages: TypeScript, JavaScript, Python\nFrontend: React, Next.js, Tailwind`}
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
        />
      </Section>

      <Section title="Experience" hint="One role per block, separated by blank lines. Line 1: Role — Company (Dates)." current="experience" onMove={moveSelection}>
        <textarea
          rows={10}
          className="input-light min-h-[260px] resize-y font-mono text-[12px] leading-relaxed"
          placeholder={`Senior Frontend Engineer — Lumen Labs (2022 - Present)\n- Led migration from CRA to Next.js, cutting TTI by 43%.`}
          value={experienceText}
          onChange={(e) => setExperienceText(e.target.value)}
        />
        <BulletQualityHint text={experienceText} kind="experience" />
      </Section>

      <Section title="Projects" hint="One project per block. Line 1 = name. Line 2 = description (optional). Following = bullets." current="projects" onMove={moveSelection}>
        <textarea
          rows={8}
          className="input-light min-h-[200px] resize-y font-mono text-[12px] leading-relaxed"
          placeholder={`Pulse — open-source perf dashboard\nReact + Node.js tool that surfaces Core Web Vitals on every PR.\n- 1.2k GitHub stars`}
          value={projectsText}
          onChange={(e) => setProjectsText(e.target.value)}
        />
        <BulletQualityHint text={projectsText} kind="projects" />
        <GithubRepoMatcher
          projectsText={projectsText}
          githubUsername={pi.github}
          onApplyLinks={(text) => setProjectsText(text)}
        />
      </Section>

      <Section
        title="Achievements"
        hint="One per line — awards, certifications, recognitions, military honors."
        current="achievements"
        onMove={moveSelection}
      >
        <textarea
          rows={4}
          className="input-light min-h-[90px] resize-y font-mono text-[12px] leading-relaxed"
          placeholder={'Certificate of Excellence — Army service (2022)\nDean\'s List, 2019 & 2020'}
          value={achievementsText}
          onChange={(e) => setAchievementsText(e.target.value)}
        />
      </Section>

      <Section title="Education" hint="One per line. Format: Degree — Institution (Dates)" current="education" onMove={moveSelection}>
        <textarea
          rows={3}
          className="input-light min-h-[80px] resize-y font-mono text-[12px] leading-relaxed"
          placeholder={`B.Sc. in Computer Science — University of Washington (2013 - 2017)`}
          value={educationText}
          onChange={(e) => setEducationText(e.target.value)}
        />
      </Section>

      <Section title="Languages" hint="One per line. Format: Language — Level" current="languages" onMove={moveSelection}>
        <textarea
          rows={4}
          className="input-light min-h-[90px] resize-y font-mono text-[12px] leading-relaxed"
          placeholder={`English — Native\nSpanish — Fluent`}
          value={languagesText}
          onChange={(e) => setLanguagesText(e.target.value)}
        />
      </Section>

      {/* Custom user-added sections (excluding the dedicated Military Service block, if any). */}
      <div className="space-y-6">
        {extras.map((extra, i) =>
          extra?.kind === 'military' ? null : (
            <CustomSection
              key={i}
              title={extra.title}
              content={extra.content}
              onTitleChange={(v) => updateExtra(i, { title: v })}
              onContentChange={(v) => updateExtra(i, { content: v })}
              onRemove={() => removeExtra(i)}
            />
          )
        )}

        <button
          type="button"
          onClick={addExtra}
          className="w-full rounded-2xl border-2 border-dashed border-cream-300 bg-cream-50/40 hover:bg-cream-50/80 hover:border-ink-300 text-ink-700 hover:text-ink-950 py-4 text-sm font-medium transition flex items-center justify-center gap-2"
        >
          <span className="h-6 w-6 rounded-full bg-ink-950 text-cream-50 grid place-items-center text-base leading-none">+</span>
          Add custom section
          <span className="text-xs text-ink-400 ml-1">(Certifications, Awards, Publications…)</span>
        </button>
      </div>
    </div>
  );
}

function Section({ title, hint, current, onMove, children }) {
  return (
    <div data-section={current}>
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg font-bold tracking-tight text-ink-950">{title}</h3>
          <MoveMenu current={current} onMove={onMove} />
        </div>
        {hint && <span className="text-[11px] text-ink-400 text-right max-w-md">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function MoveMenu({ current, onMove }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const targets = MOVE_TARGETS.filter((k) => k !== current);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-ink-500 hover:text-ink-950 inline-flex items-center gap-0.5 rounded-full border border-cream-200 bg-white px-2 py-0.5 transition hover:border-ink-300"
        title="Move highlighted text (or entire section if nothing is selected) to another section"
      >
        Move <span>→</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 left-0 w-44 rounded-xl border border-cream-200 bg-white shadow-card py-1.5">
          <div className="px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-400 font-semibold">Move to</div>
          {targets.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { onMove(current, k); setOpen(false); }}
              className="block w-full text-left px-3 py-1.5 text-sm text-ink-950 hover:bg-cream-50"
            >
              {SECTION_LABEL[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomSection({ title, content, onTitleChange, onContentChange, onRemove }) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <input
          type="text"
          className="input-light flex-1 font-display text-lg font-bold tracking-tight"
          placeholder="Section title (e.g. Certifications, Awards)"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-ink-400 hover:text-rose-600 transition"
          title="Remove section"
        >
          Remove
        </button>
      </div>
      <textarea
        rows={5}
        className="input-light w-full min-h-[120px] resize-y leading-relaxed"
        placeholder="Section content — one item per line, or free-form text."
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
      />
    </div>
  );
}

function PersonalInfoBlock({ pi, setPi }) {
  const targetMarket = useAppStore((s) => s.targetMarket);
  const isIL = targetMarket === 'israel';
  const update = (key) => (e) => setPi({ ...pi, [key]: e.target.value });
  const [showVisa, setShowVisa] = useState(Boolean(pi.visa));
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-display text-lg font-bold tracking-tight text-ink-950">Personal info</h3>
        <span className="text-[11px] text-ink-400">
          Header of your CV.{isIL ? ' Israeli norms apply.' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Full name" value={pi.name || ''} onChange={update('name')} placeholder="Alex Rivera" />
        {isIL && (
          <Field
            label="Name (Hebrew)"
            value={pi.nameHebrew || ''}
            onChange={update('nameHebrew')}
            placeholder="אלכס ריברה"
          />
        )}
        <Field label="Title" value={pi.title || ''} onChange={update('title')} placeholder="Senior Frontend Engineer" />
        <Field label="Email" value={pi.email || ''} onChange={update('email')} placeholder="you@example.com" />
        <Field label="Phone" value={pi.phone || ''} onChange={update('phone')} placeholder={isIL ? '050-1234567' : '+1 555 0142'} />
        <Field label="LinkedIn" value={pi.linkedin || ''} onChange={update('linkedin')} placeholder="linkedin.com/in/you" />
        <Field label="GitHub" value={pi.github || ''} onChange={update('github')} placeholder="github.com/you" />
        <Field
          label={isIL ? 'City' : 'Location'}
          value={pi.location || ''}
          onChange={update('location')}
          placeholder={isIL ? 'Tel Aviv, Israel' : 'San Francisco, CA'}
          full
        />
        {isIL && (showVisa || pi.visa) && (
          <Field
            label="Work authorization"
            value={pi.visa || ''}
            onChange={update('visa')}
            placeholder="Israeli citizen · Oleh Hadash · B/1 Work Visa"
            full
          />
        )}
      </div>
      {isIL && !showVisa && !pi.visa && (
        <button
          type="button"
          onClick={() => setShowVisa(true)}
          className="mt-2 text-[11px] text-ink-500 hover:text-ink-950 underline-offset-2 hover:underline"
        >
          + Add work authorization (Israeli citizen, Oleh Hadash, B/1, etc.)
        </button>
      )}
    </div>
  );
}

function GithubRepoMatcher({ projectsText, githubUsername, onApplyLinks }) {
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState(null);
  const projects = useMemo(() => {
    // Parse the same way the editor's textToProjects does.
    if (!projectsText) return [];
    return projectsText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean)
      .map((block) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        return { name: lines[0] || '', description: lines[1] || '' };
      });
  }, [projectsText]);

  async function scan() {
    if (!githubUsername || !projects.length) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.matchProjectsToRepos(githubUsername, projects);
      if (result?.error) setError(result.error);
      setMatches(result?.matches || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function applyAll() {
    if (!matches || !matches.length) return;
    // Insert a "(github.com/user/repo)" suffix into the first line of each project block.
    const blocks = projectsText.split(/\n\s*\n/);
    let blockIdx = 0;
    const next = blocks
      .map((b) => {
        const trimmed = b.trim();
        if (!trimmed) return b;
        const match = matches.find((m) => m.projectIndex === blockIdx);
        blockIdx += 1;
        if (!match) return b;
        const lines = trimmed.split('\n');
        // Skip if there's already a URL on line 1.
        if (/https?:\/\//.test(lines[0])) return b;
        lines[0] = `${lines[0]} (${match.url.replace(/^https?:\/\//, '')})`;
        return lines.join('\n');
      })
      .join('\n\n');
    onApplyLinks(next);
  }

  if (!githubUsername) {
    return (
      <div className="mt-2 text-[11px] text-ink-400">
        Add a GitHub username in Personal Info to auto-link projects to your repos.
      </div>
    );
  }
  if (!projects.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={scan}
        disabled={busy}
        className="text-[11px] text-ink-700 hover:text-ink-950 inline-flex items-center gap-1 rounded-full border border-cream-200 bg-white px-2 py-0.5 transition hover:border-ink-300"
      >
        {busy ? 'Scanning…' : matches ? 'Re-scan GitHub' : 'Match GitHub repos'}
      </button>
      {matches && matches.length > 0 && (
        <>
          <span className="text-[11px] text-ink-500">
            Found {matches.length} match{matches.length === 1 ? '' : 'es'}:
            {' '}
            {matches.map((m) => m.projectName).filter(Boolean).join(', ')}
          </span>
          <button
            type="button"
            onClick={applyAll}
            className="text-[11px] text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-50 px-2 py-0.5"
          >
            Insert links
          </button>
        </>
      )}
      {matches && matches.length === 0 && (
        <span className="text-[11px] text-ink-500">No matching repos found.</span>
      )}
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  );
}

function MilitaryServiceBlock({ military, onUpdate, onRemove }) {
  const present = Boolean(military);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <h3 className="font-display text-lg font-bold tracking-tight text-ink-950">Military service</h3>
        <span className="text-[11px] text-ink-400 text-right max-w-md">
          Common in Israel — elite tech units (8200, 81, Mamram, Talpiot) carry significant weight.
        </span>
      </div>
      {present ? (
        <div className="rounded-2xl border border-cream-200 bg-white p-5 space-y-3">
          <datalist id="il-military-units">
            {IL_UNIT_HINTS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1.5 font-semibold">
                Unit
              </span>
              <input
                type="text"
                list="il-military-units"
                className="input-light"
                placeholder="8200, Mamram, 9900…"
                value={military.unit || ''}
                onChange={(e) => onUpdate({ unit: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1.5 font-semibold">
                Dates
              </span>
              <input
                type="text"
                className="input-light"
                placeholder="2018 – 2021"
                value={military.dates || ''}
                onChange={(e) => onUpdate({ dates: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1.5 font-semibold">
              Role &amp; bullets
            </span>
            <textarea
              rows={4}
              className="input-light min-h-[100px] resize-y font-mono text-[12px] leading-relaxed"
              placeholder={'Software engineer\n- Led a team of 3 engineers building real-time signal processing systems\n- Honored with team-of-the-year award'}
              value={military.content || ''}
              onChange={(e) => onUpdate({ content: e.target.value })}
            />
          </label>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-ink-400 hover:text-rose-600 transition"
            >
              Remove military section
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onUpdate({ kind: 'military', title: 'Military Service', unit: '', dates: '', content: '' })}
          className="w-full rounded-2xl border-2 border-dashed border-cream-300 bg-cream-50/40 hover:bg-cream-50/80 hover:border-ink-300 text-ink-700 hover:text-ink-950 py-4 text-sm font-medium transition flex items-center justify-center gap-2"
        >
          <span className="h-6 w-6 rounded-full bg-ink-950 text-cream-50 grid place-items-center text-base leading-none">+</span>
          Add Military Service
          <span className="text-xs text-ink-400 ml-1">(IDF unit, dates, role)</span>
        </button>
      )}
    </div>
  );
}

function BulletQualityHint({ text, kind }) {
  const stats = useMemo(() => {
    const bullets = bulletsFromAfter(kind, text || '');
    let passive = 0;
    let long = 0;
    let noMetric = 0;
    for (const b of bullets) {
      const issues = bulletIssues(b);
      for (const i of issues) {
        if (i.kind === 'passive') passive += 1;
        if (i.kind === 'long') long += 1;
        if (i.kind === 'no-metric') noMetric += 1;
      }
    }
    return { total: bullets.length, passive, long, noMetric };
  }, [text, kind]);

  if (stats.total === 0) return null;
  const issues = [];
  if (stats.passive) issues.push(`${stats.passive} passive`);
  if (stats.long) issues.push(`${stats.long} > 25 words`);
  if (stats.noMetric) issues.push(`${stats.noMetric} without a metric`);
  if (issues.length === 0) {
    return (
      <div className="mt-1.5 text-[11px] text-emerald-600 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        All {stats.total} bullets look strong — active verbs, ≤ 25 words, quantified.
      </div>
    );
  }
  return (
    <div className="mt-1.5 text-[11px] text-amber-700 flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {issues.join(' · ')} — see the wizard's Bullet quality panel after Analyze.
    </div>
  );
}

function Field({ label, value, onChange, placeholder, full }) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <span className="block text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1.5 font-semibold">{label}</span>
      <input type="text" className="input-light" value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}
