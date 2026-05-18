import { useEffect, useRef, useState } from 'react';
import { useAppStore, SECTION_ORDER } from '../../store/useAppStore.js';
import { api } from '../../api/client.js';

export default function ReviewSummary({ onExport }) {
  const tailoredCv = useAppStore((s) => s.tailoredCv);
  const approvals = useAppStore((s) => s.approvals);
  const result = useAppStore((s) => s.result);
  const setMode = useAppStore((s) => s.setMode);
  const resetApprovals = useAppStore((s) => s.resetApprovals);
  const [copied, setCopied] = useState(false);
  const autoSuggested = useRef(false);

  const cv = tailoredCv();

  // The moment all sections are resolved, suggest export once.
  useEffect(() => {
    if (autoSuggested.current) return;
    autoSuggested.current = true;
    const t = setTimeout(() => onExport?.(), 600);
    return () => clearTimeout(t);
  }, [onExport]);

  const approvedCount = SECTION_ORDER.filter((n) => ['approved', 'edited'].includes(approvals[n]?.status)).length;
  const rejectedCount = SECTION_ORDER.filter((n) => approvals[n]?.status === 'rejected').length;

  async function copyMarkdown() {
    try {
      const md = await api.exportMarkdown(cv);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  }

  async function downloadMarkdown() {
    const md = await api.exportMarkdown(cv);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cv.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadChangesReport() {
    if (!result) return;
    const lines = [`# Tailoring Changes Report`, ''];
    for (const name of SECTION_ORDER) {
      const sec = result.sections?.[name];
      const dec = approvals[name];
      if (!sec) continue;
      lines.push(`## ${name} — ${dec?.status || 'pending'}`, '');
      lines.push('**Before:**', sec.before || '_(empty)_', '');
      lines.push('**After (AI suggestion):**', sec.after || '_(empty)_', '');
      if (dec?.status === 'edited') {
        lines.push('**Your edit (used in final CV):**', dec.finalText, '');
      }
      if (sec.changes?.length) {
        lines.push('**Changes:**');
        sec.changes.forEach((c) => lines.push(`- ${c}`));
        lines.push('');
      }
      if (sec.reason) lines.push('**Reason:**', sec.reason, '');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'changes-report.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="card p-7">
        <div className="flex items-start justify-between flex-wrap gap-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1">Complete</div>
            <h2 className="font-display text-3xl font-bold tracking-tight">All sections reviewed</h2>
            <div className="text-sm text-ink-500 mt-2">
              {approvedCount} accepted · {rejectedCount} original kept ·
              <span className="ml-2">ATS overall</span>{' '}
              <span className="font-display text-ink-950 font-bold">{result?.ats?.overallScore ?? '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn-primary" onClick={onExport}>Export PDF</button>
            <button className="btn-ghost" onClick={copyMarkdown}>{copied ? 'Copied' : 'Copy markdown'}</button>
            <button className="btn-ghost" onClick={downloadMarkdown}>Download .md</button>
            <button className="btn-ghost" onClick={downloadChangesReport}>Changes report</button>
          </div>
        </div>
      </div>

      <div className="card-light p-8">
        <PreviewCv cv={cv} />
      </div>

      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={() => setMode('mirror')}>← Back to Mirror</button>
        <button className="btn-ghost" onClick={resetApprovals}>Reset decisions</button>
      </div>
    </div>
  );
}

function PreviewCv({ cv }) {
  if (!cv) return null;
  return (
    <div className="space-y-6 text-ink-950">
      <div>
        <h2 className="font-display text-4xl font-bold tracking-tight">{cv.personalInfo?.name}</h2>
        {cv.personalInfo?.title && <div className="text-sm text-ink-700 mt-1">{cv.personalInfo.title}</div>}
        <div className="text-xs text-ink-500 flex flex-wrap gap-x-3 mt-2">
          {cv.personalInfo?.email && <span>{cv.personalInfo.email}</span>}
          {cv.personalInfo?.phone && <span>{cv.personalInfo.phone}</span>}
          {cv.personalInfo?.linkedin && <span>{cv.personalInfo.linkedin}</span>}
          {cv.personalInfo?.github && <span>{cv.personalInfo.github}</span>}
        </div>
      </div>
      {cv.summary && <Block title="Summary"><p className="text-sm leading-relaxed text-ink-700">{cv.summary}</p></Block>}
      {Array.isArray(cv.skills) && cv.skills.length > 0 && (
        <Block title="Skills">
          <div className="space-y-1 text-sm">
            {cv.skills.map((s, i) =>
              typeof s === 'object' ? (
                <div key={i}><span className="font-semibold">{s.category}: </span><span className="text-ink-700">{(s.items || []).join(', ')}</span></div>
              ) : (
                <div key={i} className="text-ink-700">{s}</div>
              )
            )}
          </div>
        </Block>
      )}
      {Array.isArray(cv.experience) && cv.experience.length > 0 && (
        <Block title="Experience">
          <div className="space-y-4">
            {cv.experience.map((e, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <div className="font-semibold text-sm">{e.role}{e.company ? <span className="text-ink-500 font-normal"> — {e.company}</span> : null}</div>
                  <div className="text-xs text-ink-400">{e.dates}</div>
                </div>
                <ul className="mt-1.5 space-y-1 text-sm text-ink-700">
                  {(e.bullets || []).map((b, j) => <li key={j} className="pl-3.5 relative"><span className="absolute left-0 top-[7px] h-1 w-1 rounded-full bg-ink-400" />{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Block>
      )}
      {Array.isArray(cv.projects) && cv.projects.length > 0 && (
        <Block title="Projects">
          <div className="space-y-3">
            {cv.projects.map((p, i) => (
              <div key={i}>
                <div className="font-semibold text-sm">{p.name}</div>
                {p.description && <div className="text-xs text-ink-500 mt-0.5">{p.description}</div>}
                <ul className="mt-1.5 space-y-1 text-sm text-ink-700">
                  {(p.bullets || []).map((b, j) => <li key={j} className="pl-3.5 relative"><span className="absolute left-0 top-[7px] h-1 w-1 rounded-full bg-ink-400" />{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Block>
      )}
      {Array.isArray(cv.education) && cv.education.length > 0 && (
        <Block title="Education">
          <ul className="text-sm space-y-1 text-ink-700">
            {cv.education.map((e, i) => (
              <li key={i}><span className="font-semibold text-ink-950">{e.degree}</span> — {e.institution} {e.dates && <span className="text-ink-400">({e.dates})</span>}</li>
            ))}
          </ul>
        </Block>
      )}
      {Array.isArray(cv.achievements) && cv.achievements.length > 0 && (
        <Block title="Achievements">
          <ul className="text-sm space-y-1 text-ink-700">
            {cv.achievements.map((a, i) => (
              <li key={i} className="pl-3.5 relative">
                <span className="absolute left-0 top-[7px] h-1 w-1 rounded-full bg-ink-400" />
                {a}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {Array.isArray(cv.languages) && cv.languages.length > 0 && (
        <Block title="Languages">
          <ul className="text-sm space-y-0.5 text-ink-700">
            {cv.languages.map((l, i) => (<li key={i}><span className="font-medium text-ink-950">{l.name}</span>{l.level && <span className="text-ink-500"> — {l.level}</span>}</li>))}
          </ul>
        </Block>
      )}
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div className="pt-5 border-t border-cream-200">
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-2.5 font-semibold">{title}</div>
      {children}
    </div>
  );
}
