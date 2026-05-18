import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import CVUpload from './CVUpload.jsx';
import SectionedCVEditor from './SectionedCVEditor.jsx';

export default function BaseCVEditor({ onClose }) {
  const cv = useAppStore((s) => s.cv);
  const setCv = useAppStore((s) => s.setCv);
  const saveCv = useAppStore((s) => s.saveCv);
  const [draft, setDraft] = useState(cv || null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const lastSeenCv = useRef(cv);

  // When the store's cv changes externally (e.g. after upload), re-seed our draft.
  useEffect(() => {
    if (cv && cv !== lastSeenCv.current) {
      setDraft(cv);
      setJsonText(JSON.stringify(cv, null, 2));
      lastSeenCv.current = cv;
    }
  }, [cv]);

  useEffect(() => {
    if (advanced && draft) setJsonText(JSON.stringify(draft, null, 2));
  }, [advanced]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    let next = draft;
    if (advanced) {
      try {
        next = JSON.parse(jsonText);
        setError(null);
      } catch (e) {
        setError(`Invalid JSON: ${e.message}`);
        return;
      }
    }
    setCv(next);
    saveCv()
      .then(() => {
        setSaved(true);
        setError(null);
        // Close shortly after to give a beat for the "Saved ✓" feedback.
        setTimeout(() => onClose?.(), 350);
      })
      .catch((e) => setError(e.message));
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-sm grid place-items-center p-6">
      <div className="card w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-cream-200">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-1">Step 02</div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Your CV</h2>
            <div className="text-sm text-ink-500 mt-1 max-w-md">
              Upload a PDF/DOCX — we'll extract what we can. Then review each section and fix anything that's off.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="text-xs text-ink-500 hover:text-ink-950 underline-offset-2 hover:underline"
              onClick={() => setAdvanced((v) => !v)}
            >
              {advanced ? 'Form view' : 'Advanced JSON'}
            </button>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="p-6 border-b border-cream-200">
          <CVUpload />
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {advanced ? (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 font-semibold">Structured JSON</div>
              <textarea
                className="input-light w-full font-mono text-[12px] leading-relaxed resize-none min-h-[420px]"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                spellCheck={false}
              />
            </div>
          ) : (
            <SectionedCVEditor cv={draft || cv} onChange={setDraft} />
          )}
          {error && <div className="mt-3 text-xs text-rose-600">{error}</div>}
        </div>

        <div className="p-6 border-t border-cream-200 flex items-center justify-end gap-2">
          {saved && <span className="text-xs text-emerald-600 mr-auto">Saved ✓</span>}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save CV</button>
        </div>
      </div>
    </div>
  );
}
