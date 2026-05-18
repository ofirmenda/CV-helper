import { useAppStore } from '../../store/useAppStore.js';
import { highlightKeywords } from '../../utils/highlightKeywords.jsx';

export default function CVPanel({ cv }) {
  const result = useAppStore((s) => s.result);
  const hoveredKeyword = useAppStore((s) => s.ui.hoveredKeyword);
  const setHovered = useAppStore((s) => s.setHoveredKeyword);

  // Keywords known so far — we highlight them inside the CV text.
  const keywords = result?.keywords || [];

  const HL = ({ text }) =>
    keywords.length
      ? highlightKeywords(text || '', keywords, {
          hoveredTerm: hoveredKeyword,
          onHover: setHovered,
          onLeave: () => setHovered(null),
        })
      : text;

  return (
    <div className="card-light p-7 min-h-[640px] relative overflow-hidden">
      <div className="absolute top-0 left-0 h-px w-32 bg-gradient-to-r from-peach-500/60 to-transparent" />

      <div className="flex items-baseline justify-between mb-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400">02 / Your CV</div>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-950">
            {cv.personalInfo?.name || 'Your Name'}
          </h1>
          {cv.personalInfo?.title && (
            <div className="mt-1 text-sm text-ink-700"><HL text={cv.personalInfo.title} /></div>
          )}
          <div className="mt-3 text-xs text-ink-500 flex flex-wrap gap-x-3 gap-y-1">
            {cv.personalInfo?.email && (
              <ContactLink href={`mailto:${cv.personalInfo.email}`}>{cv.personalInfo.email}</ContactLink>
            )}
            {cv.personalInfo?.phone && <span>{cv.personalInfo.phone}</span>}
            {cv.personalInfo?.linkedin && (
              <ContactLink href={normalizeUrl(cv.personalInfo.linkedin)}>{cv.personalInfo.linkedin}</ContactLink>
            )}
            {cv.personalInfo?.github && (
              <ContactLink href={normalizeUrl(cv.personalInfo.github)}>{cv.personalInfo.github}</ContactLink>
            )}
          </div>
        </div>

        {cv.summary && (
          <div className="pt-6 border-t border-cream-200">
            <SectionTitle>Summary</SectionTitle>
            <p className="text-[13px] text-ink-700 leading-relaxed"><HL text={cv.summary} /></p>
          </div>
        )}

        {Array.isArray(cv.skills) && cv.skills.length > 0 && (
          <div className="pt-6 border-t border-cream-200">
            <SectionTitle>Skills</SectionTitle>
            <div className="space-y-1.5 text-[13px]">
              {cv.skills.map((s, i) =>
                typeof s === 'object' ? (
                  <div key={i}>
                    <span className="font-semibold text-ink-950">{s.category}: </span>
                    <span className="text-ink-700"><HL text={(s.items || []).join(', ')} /></span>
                  </div>
                ) : (
                  <div key={i} className="text-ink-700"><HL text={s} /></div>
                )
              )}
            </div>
          </div>
        )}

        {Array.isArray(cv.experience) && cv.experience.length > 0 && (
          <div className="pt-6 border-t border-cream-200">
            <SectionTitle>Experience</SectionTitle>
            <div className="space-y-5">
              {cv.experience.map((exp, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-semibold text-ink-950 text-sm">
                      <HL text={exp.role || ''} />
                      {exp.company ? <span className="text-ink-500 font-normal"> — <HL text={exp.company} /></span> : null}
                    </div>
                    <div className="text-xs text-ink-400 whitespace-nowrap">{exp.dates}</div>
                  </div>
                  <ul className="mt-2 space-y-1 text-[13px] text-ink-700">
                    {(exp.bullets || []).map((b, j) => (
                      <li key={j} className="pl-3.5 relative">
                        <span className="absolute left-0 top-[7px] h-1 w-1 rounded-full bg-ink-400" />
                        <HL text={b} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(cv.projects) && cv.projects.length > 0 && (
          <div className="pt-6 border-t border-cream-200">
            <SectionTitle>Projects</SectionTitle>
            <div className="space-y-4">
              {cv.projects.map((p, i) => (
                <div key={i}>
                  <div className="font-semibold text-ink-950 text-sm"><HL text={p.name || ''} /></div>
                  {p.description && (
                    <div className="text-xs text-ink-500 mt-0.5"><HL text={p.description} /></div>
                  )}
                  <ul className="mt-1.5 space-y-1 text-[13px] text-ink-700">
                    {(p.bullets || []).map((b, j) => (
                      <li key={j} className="pl-3.5 relative">
                        <span className="absolute left-0 top-[7px] h-1 w-1 rounded-full bg-ink-400" />
                        <HL text={b} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(cv.education) && cv.education.length > 0 && (
          <div className="pt-6 border-t border-cream-200">
            <SectionTitle>Education</SectionTitle>
            <ul className="text-[13px] text-ink-700 space-y-1">
              {cv.education.map((e, i) => (
                <li key={i}>
                  <span className="font-semibold text-ink-950"><HL text={e.degree || ''} /></span> — <HL text={e.institution || ''} />{' '}
                  {e.dates && <span className="text-ink-400">({e.dates})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(cv.achievements) && cv.achievements.length > 0 && (
          <div className="pt-6 border-t border-cream-200">
            <SectionTitle>Achievements</SectionTitle>
            <ul className="text-[13px] text-ink-700 space-y-1">
              {cv.achievements.map((a, i) => (
                <li key={i} className="pl-3.5 relative">
                  <span className="absolute left-0 top-[7px] h-1 w-1 rounded-full bg-ink-400" />
                  <HL text={a} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(cv.languages) && cv.languages.length > 0 && (
          <div className="pt-6 border-t border-cream-200">
            <SectionTitle>Languages</SectionTitle>
            <ul className="text-[13px] text-ink-700 space-y-0.5">
              {cv.languages.map((l, i) => (
                <li key={i}>
                  <span className="font-medium text-ink-950">{l.name}</span>
                  {l.level && <span className="text-ink-500"> — {l.level}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(cv.extras) && cv.extras.filter((x) => x && (x.title || x.content)).map((extra, i) => (
          <div key={`extra-${i}`} className="pt-6 border-t border-cream-200">
            <SectionTitle>{extra.title || 'Section'}</SectionTitle>
            <div className="text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap"><HL text={extra.content || ''} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-2.5 font-semibold">
      {children}
    </div>
  );
}

function normalizeUrl(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) return `https://${s}`;
  return s;
}

function ContactLink({ href, children }) {
  if (!href) return <span>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-cream-300 underline-offset-2 hover:decoration-ink-700 hover:text-ink-950"
    >
      {children}
    </a>
  );
}
