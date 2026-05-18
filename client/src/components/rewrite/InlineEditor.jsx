import { useEffect, useRef, useState } from 'react';

export default function InlineEditor({ initial = '', onSave, onCancel }) {
  const [text, setText] = useState(initial);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(text.length, text.length);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.min(560, ref.current.scrollHeight)}px`;
  }, [text]);

  return (
    <div className="space-y-3">
      <textarea
        ref={ref}
        className="input-light resize-none min-h-[200px] font-mono text-[12px] leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={() => onSave(text)}>Save edit</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
