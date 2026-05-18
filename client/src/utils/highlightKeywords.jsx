// Shared keyword-highlighting renderer. Wraps any occurrence of a known keyword
// in a colored <mark>. Used by both the JD pane (JobDescriptionInput) and the
// CV pane (CVPanel) so the same word lights up on both sides at the same time.
//
// `keywords` shape: [{ term: string, status?: 'match'|'partial'|'miss' }, …].
// When the user hovers a keyword chip, `hoveredTerm` is set; all matching
// marks on every side gain a `kw-hover` class for a brief pulse.

const TONE_CLASS = {
  match: 'kw-match',
  partial: 'kw-partial',
  miss: 'kw-miss',
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Sort longer terms first so "React Native" wins over "React".
function buildPattern(keywords) {
  const terms = keywords
    .map((k) => (typeof k === 'string' ? k : k && k.term))
    .filter((t) => t && t.length >= 2)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  if (!terms.length) return null;
  // Capture group splits the text on matches; `i` for case-insensitive,
  // `g` is implicit because String.prototype.split with a global regex behaves
  // identically to a non-global one here — `i` is enough.
  return new RegExp(`(${terms.join('|')})`, 'gi');
}

export function highlightKeywords(text, keywords, opts = {}) {
  if (!text) return null;
  if (!Array.isArray(keywords) || !keywords.length) return text;
  const pattern = buildPattern(keywords);
  if (!pattern) return text;

  const { hoveredTerm = null, onHover = null, onLeave = null, onClick = null } = opts;

  // Build a lookup of term-lower → keyword object so we can read status/dispatch hover.
  const byTerm = new Map();
  for (const k of keywords) {
    const term = typeof k === 'string' ? k : k && k.term;
    if (!term) continue;
    byTerm.set(term.toLowerCase(), typeof k === 'string' ? { term, status: 'match' } : k);
  }

  const parts = String(text).split(pattern);
  const hoveredLower = hoveredTerm ? hoveredTerm.toLowerCase() : null;

  return parts.map((part, i) => {
    const partLower = part.toLowerCase();
    const kw = byTerm.get(partLower);
    if (!kw) return part;
    const tone = TONE_CLASS[kw.status] || TONE_CLASS.match;
    const isHovered = hoveredLower && hoveredLower === partLower;
    return (
      <mark
        key={i}
        className={`kw-mark ${tone}${isHovered ? ' kw-hover' : ''}`}
        onMouseEnter={onHover ? () => onHover(kw.term) : undefined}
        onMouseLeave={onLeave || undefined}
        onClick={onClick ? () => onClick(kw) : undefined}
      >
        {part}
      </mark>
    );
  });
}
