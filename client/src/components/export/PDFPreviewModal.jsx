import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import { api } from '../../api/client.js';
import { TEMPLATES } from './TemplatePicker.jsx';
import PlainTextPreview from './PlainTextPreview.jsx';
import SectionOrderControl from '../editor/SectionOrderControl.jsx';

export default function PDFPreviewModal({ onClose }) {
  const cv = useAppStore((s) => s.cv);
  const setCv = useAppStore((s) => s.setCv);
  const saveCv = useAppStore((s) => s.saveCv);
  const tailoredCvFn = useAppStore((s) => s.tailoredCv);
  const result = useAppStore((s) => s.result);
  const chosenTemplate = useAppStore((s) => s.template);
  const setChosenTemplate = useAppStore((s) => s.setTemplate);
  const resetForNewJob = useAppStore((s) => s.resetForNewJob);
  const [template, setTemplate] = useState(chosenTemplate || TEMPLATES[0].id);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const targetMarket = useAppStore((s) => s.targetMarket);
  const [useTailored, setUseTailored] = useState(Boolean(result));
  // Israeli market default: strict 1-page for mid-level. User can override.
  const [onePage, setOnePage] = useState(targetMarket === 'israel');
  const [atsView, setAtsView] = useState(false);
  const [error, setError] = useState(null);
  // Goes true after a successful download, so we can prompt the user to fit
  // the CV to a new job rather than leaving them stranded on the old one.
  const [downloaded, setDownloaded] = useState(false);

  // Compute the target CV from a stable signature (JSON), so the effect below
  // doesn't fire on every render due to a new object reference.
  const targetCv = useMemo(
    () => (useTailored ? tailoredCvFn() : cv),
    // Deliberately depend on the JSON shape, not the object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useTailored, cv && JSON.stringify(cv), result && JSON.stringify(result)]
  );

  // Section order. Persists back to the saved CV so it sticks across sessions.
  const updateSectionOrder = (nextOrder) => {
    if (!cv) return;
    const updated = { ...cv, sectionOrder: nextOrder };
    setCv(updated);
    saveCv().catch(() => {});
  };

  useEffect(() => {
    let revoke = null;
    let cancelled = false;
    async function load() {
      if (!targetCv) return;
      setLoading(true);
      setError(null);
      try {
        const blob = await api.exportPdf(targetCv, template, { onePage });
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPreviewUrl(url);
        revoke = url;
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [template, targetCv, onePage]);

  async function download() {
    if (!targetCv) return;
    try {
      const blob = await api.exportPdf(targetCv, template, { onePage });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Match server: LastName_FirstName_Resume.pdf (research §50, §232).
      const raw = (targetCv.personalInfo?.name || '').trim();
      let filename = 'cv.pdf';
      if (raw) {
        const parts = raw.replace(/[^A-Za-zÀ-ÿ\s'-]+/g, '').split(/\s+/).filter(Boolean);
        if (parts.length >= 2) filename = `${parts[parts.length - 1]}_${parts[0]}_Resume.pdf`;
        else if (parts.length === 1) filename = `${parts[0]}_Resume.pdf`;
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      // Only prompt "fit to another job" when there's actually a tailored result
      // — pure base-CV exports don't have a JD to reset.
      if (result) setDownloaded(true);
    } catch (e) {
      setError(e.message);
    }
  }

  function startNewJob() {
    resetForNewJob();
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-sm grid place-items-center p-6">
      <div className="card w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="p-6 border-b border-cream-200 flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1">Export</div>
            <h2 className="font-display text-2xl font-bold tracking-tight">PDF preview</h2>
            <div className="text-sm text-ink-500 mt-1">Pick a template and preview before downloading.</div>
          </div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div className="p-5 border-b border-cream-200 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTemplate(t.id); setChosenTemplate(t.id); }}
                className={`text-left rounded-xl border px-3 py-2 transition ${
                  template === t.id
                    ? 'border-ink-950 bg-cream-50 ring-1 ring-ink-950'
                    : 'border-cream-200 bg-white hover:border-ink-300'
                }`}
              >
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="text-[11px] text-ink-500 max-w-[220px]">{t.description}</div>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer" title={targetMarket === 'israel' ? 'Israeli norm: 1 page for mid-level. 2 max for senior.' : ''}>
              <input
                type="checkbox"
                checked={onePage}
                onChange={(e) => setOnePage(e.target.checked)}
                disabled={atsView}
              />
              Fit to one page
              {targetMarket === 'israel' && (
                <span className="italic text-[10px] text-ink-400">(IL default)</span>
              )}
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={atsView}
                onChange={(e) => setAtsView(e.target.checked)}
              />
              Show as ATS sees it
            </label>
            {result && (
              <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useTailored}
                  onChange={(e) => setUseTailored(e.target.checked)}
                />
                Use tailored CV
              </label>
            )}
            <button className="btn-primary" onClick={download} disabled={loading || !targetCv}>
              Download PDF
            </button>
          </div>
        </div>

        {cv && (
          <details className="border-b border-cream-200 bg-cream-50/40">
            <summary className="px-5 py-3 cursor-pointer text-xs text-ink-700 hover:text-ink-950 flex items-center justify-between select-none">
              <span className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-[0.18em] text-[10px] text-ink-400">Section order</span>
                <span className="text-ink-500">— last chance to reorder before download</span>
              </span>
              <span className="text-ink-400">▾</span>
            </summary>
            <div className="px-5 pb-4">
              <SectionOrderControl
                cv={cv}
                value={cv.sectionOrder}
                suggestion={result?.suggestedSectionOrder}
                onChange={updateSectionOrder}
                compact
              />
            </div>
          </details>
        )}

        {downloaded && (
          <div className="px-5 py-3 border-b border-cream-200 bg-emerald-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-emerald-800">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-semibold">PDF downloaded.</span>
              <span className="text-emerald-700">Want to tailor this CV to a different role?</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost text-xs" onClick={() => setDownloaded(false)}>
                Stay on this one
              </button>
              <button className="btn-accent text-xs" onClick={startNewJob}>
                Fit to another job →
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 p-5 overflow-hidden bg-cream-100/40">
          {error && <div className="text-xs text-rose-600 mb-2">Error: {error}</div>}
          {atsView ? (
            targetCv ? (
              <PlainTextPreview cv={targetCv} />
            ) : (
              <div className="h-full grid place-items-center text-sm text-ink-500">
                No CV to render yet. Save your CV first.
              </div>
            )
          ) : (
            <>
              {loading && !previewUrl && (
                <div className="h-full grid place-items-center text-sm text-ink-500">Rendering PDF…</div>
              )}
              {!loading && !previewUrl && !error && !targetCv && (
                <div className="h-full grid place-items-center text-sm text-ink-500">
                  No CV to render yet. Save your CV first.
                </div>
              )}
              {previewUrl && (
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title="PDF preview"
                  className="w-full h-full rounded-xl bg-white border border-cream-200"
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
