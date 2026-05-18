import { useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';

function hasCvContent(cv) {
  if (!cv) return false;
  if (cv.personalInfo?.name) return true;
  if (cv.summary && cv.summary.length > 30) return true;
  if (Array.isArray(cv.experience) && cv.experience.length) return true;
  if (Array.isArray(cv.skills) && cv.skills.length) return true;
  return false;
}

export default function CVUpload() {
  const uploadCv = useAppStore((s) => s.uploadCv);
  const cv = useAppStore((s) => s.cv);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef(null);

  const populated = hasCvContent(cv);
  const showFull = expanded || !populated;

  async function handleFile(file) {
    if (!file) return;
    const ok =
      /\.(pdf|docx)$/i.test(file.name) ||
      [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ].includes(file.type);
    if (!ok) {
      setMsg({ type: 'error', text: 'Only PDF or DOCX files.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const next = await uploadCv(file);
      const sections = ['summary', 'skills', 'experience', 'projects', 'education', 'languages']
        .filter((k) => {
          const v = next[k];
          return Array.isArray(v) ? v.length : Boolean(v);
        });
      setMsg({ type: 'ok', text: `Imported ${sections.length} sections. Review and edit as needed.` });
      setExpanded(false);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (!showFull) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-cream-200 bg-cream-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-5 rounded-full bg-emerald-500 text-white grid place-items-center text-[10px] font-bold">✓</span>
          <span className="text-sm text-ink-950 font-medium">CV loaded</span>
          <span className="text-xs text-ink-500">— edit below, or replace the file</span>
        </div>
        <button
          className="text-xs font-medium text-ink-500 hover:text-ink-950 underline-offset-2 hover:underline"
          onClick={() => setExpanded(true)}
        >
          Replace CV
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
        drag ? 'border-spark-500 bg-spark-500/5' : 'border-cream-300 bg-cream-50/60'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {busy ? (
        <div className="text-sm text-ink-700">Extracting CV data…</div>
      ) : (
        <>
          <div className="font-display text-base font-bold text-ink-950 mb-1">
            {populated ? 'Replace your CV' : 'Upload your CV'}
          </div>
          <div className="text-xs text-ink-500 mb-3">PDF or DOCX · we extract the text, you keep the design</div>
          <div className="flex items-center justify-center gap-2">
            <button className="btn-primary" onClick={() => inputRef.current?.click()}>
              Choose file
            </button>
            {populated && (
              <button className="btn-ghost" onClick={() => setExpanded(false)}>
                Cancel
              </button>
            )}
          </div>
          <div className="mt-2 text-xs text-ink-400">or drop a file here</div>
        </>
      )}
      {msg && (
        <div className={`mt-3 text-xs ${msg.type === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
