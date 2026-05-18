import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export default function PlainTextPreview({ cv }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!cv) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .exportPlainText(cv)
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cv && JSON.stringify(cv)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="text-xs text-ink-500 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-ink-700">
          <span className="h-1.5 w-1.5 rounded-full bg-spark-500" /> ATS view
        </span>
        This is roughly what a parser like Workday or Greenhouse sees. If the reading order or wording looks scrambled here, an ATS will misread it too.
      </div>
      <div className="flex-1 overflow-auto rounded-xl border border-cream-200 bg-white p-5">
        {loading && <div className="text-sm text-ink-500">Rendering plain text…</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}
        {!loading && !error && (
          <pre className="font-mono text-[12px] leading-relaxed text-ink-950 whitespace-pre-wrap">{text}</pre>
        )}
      </div>
    </div>
  );
}
