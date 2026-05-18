import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

const TEMPLATES = {
  'template-modern': { html: 'template-modern.html', css: 'template-modern.css' },
  'template-classic': { html: 'template-classic.html', css: 'template-classic.css' },
  'template-ats-safe': { html: 'template-ats-safe.html', css: 'template-ats-safe.css' },
};

Handlebars.registerHelper('join', (arr, sep) => (Array.isArray(arr) ? arr.join(sep) : ''));
Handlebars.registerHelper('hasItems', (arr) => Array.isArray(arr) && arr.length > 0);
Handlebars.registerHelper('isObject', (v) => typeof v === 'object' && v !== null && !Array.isArray(v));
Handlebars.registerHelper('eq', (a, b) => a === b);

// Build a clickable href for a contact value. Returns SafeString so Handlebars
// doesn't escape the URL.
Handlebars.registerHelper('contactHref', function (kind, value) {
  if (!value) return new Handlebars.SafeString('');
  const v = String(value).trim();
  if (kind === 'email') {
    return new Handlebars.SafeString(`mailto:${v}`);
  }
  if (v.match(/^https?:\/\//i)) return new Handlebars.SafeString(v);
  if (v.match(/^[\w.-]+\.[a-z]{2,}/i)) return new Handlebars.SafeString(`https://${v}`);
  return new Handlebars.SafeString('');
});

let _browser = null;

async function launchBrowser() {
  // In production containers (Fly, Docker) we use the system-installed
  // Chromium via PUPPETEER_EXECUTABLE_PATH, skipping puppeteer's bundled
  // download to keep the image small. In dev, puppeteer auto-discovers
  // its bundled binary.
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  return puppeteer.launch({
    headless: 'new',
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--font-render-hinting=none',
      // Keep memory bounded inside small containers.
      '--disable-dev-shm-usage',
    ],
  });
}

// Returns a live browser. If the cached one has died (e.g. someone killed
// Chromium externally), discard and relaunch. Puppeteer surfaces this as
// "Protocol error: Connection closed" on the next newPage() call.
async function getBrowser() {
  if (_browser) {
    const stillAlive = typeof _browser.connected === 'function' ? _browser.connected() : !!_browser.process();
    if (!stillAlive) {
      try { await _browser.close(); } catch { /* ignore */ }
      _browser = null;
    }
  }
  if (!_browser) _browser = await launchBrowser();
  return _browser;
}

function computeAdaptiveFontSize(cv) {
  const text = JSON.stringify(cv);
  const len = text.length;
  if (len < 2000) return '11pt';
  if (len < 3500) return '10.5pt';
  if (len < 5000) return '10pt';
  return '9.5pt';
}

// A4 at 96dpi for screen measurement: 794 × 1123 px.
const A4_HEIGHT_PX = 1123;

const templateCache = new Map();
async function loadTemplate(name) {
  if (templateCache.has(name)) return templateCache.get(name);
  const spec = TEMPLATES[name];
  if (!spec) {
    throw Object.assign(new Error(`Unknown template: ${name}`), { status: 400 });
  }
  const [htmlSrc, cssSrc] = await Promise.all([
    fs.readFile(path.join(TEMPLATE_DIR, spec.html), 'utf8'),
    fs.readFile(path.join(TEMPLATE_DIR, spec.css), 'utf8'),
  ]);
  const compiled = Handlebars.compile(htmlSrc);
  const entry = { compiled, css: cssSrc };
  templateCache.set(name, entry);
  return entry;
}

// In each template, only the MAIN column is reorderable; the sidebar reflects
// the template's visual identity. These are the sections that participate in
// reordering for each template.
const REORDERABLE = {
  'template-modern': ['summary', 'experience', 'projects', 'achievements'],
  'template-classic': ['summary', 'experience', 'projects', 'achievements'],
};

function resolveMainOrder(cv, template) {
  const allowed = REORDERABLE[template] || ['summary', 'experience', 'projects'];
  const allowedSet = new Set(allowed);
  const userOrder = Array.isArray(cv?.sectionOrder) ? cv.sectionOrder : [];
  const filtered = userOrder.filter((k) => allowedSet.has(k));
  // Append any allowed sections not mentioned in the user's order, in default order.
  for (const k of allowed) {
    if (!filtered.includes(k)) filtered.push(k);
  }
  return filtered;
}

function isClosedConnectionError(err) {
  const msg = String(err?.message || '');
  return /Protocol error|Connection closed|Target closed|Browser closed|disconnect/i.test(msg);
}

async function renderPdfOnce({ cv, template, onePage }) {
  const { compiled, css } = await loadTemplate(template);
  const bodyFontSize = computeAdaptiveFontSize(cv);
  const mainOrder = resolveMainOrder(cv, template);
  const html = compiled({ cv, css, bodyFontSize, mainOrder });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 794, height: A4_HEIGHT_PX });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    if (onePage) {
      // The old approach (shrinking --body-size only) had two problems:
      //   (1) Template spacing is hardcoded in `pt` (section margins, header
      //       padding, h1 size). Shrinking the body font alone barely
      //       compressed anything — the visual result was crowded text inside
      //       still-huge gaps.
      //   (2) `.section { break-inside: avoid }` bumped any oversize section
      //       wholesale to page 2, leaving page 1 with a big white gap.
      //
      // New approach: Chromium's CSS `zoom` uniformly rescales fonts +
      // padding + headings AND re-runs layout, so a single zoom value
      // compresses everything coherently. Override break-inside while
      // measuring so sections don't artificially push past the fold.
      await page.evaluate(() => {
        const s = document.createElement('style');
        s.id = '__one-page-overrides';
        s.textContent = `
          .section, .item, .entry, .role, .project, .experience-item, .project-item {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }
        `;
        document.head.appendChild(s);
      });

      // Binary search the largest zoom (≤ 1.0) that still fits in one A4
      // height. Floor at 0.55 so the result stays readable — below that
      // we'd rather let it crop than ship a microscopic resume.
      const measureAt = (zoom) => page.evaluate((z, limit) => {
        document.documentElement.style.zoom = z;
        void document.body.offsetHeight;
        const root = document.documentElement;
        return {
          fits: root.scrollHeight <= limit + 6,
          height: root.scrollHeight,
        };
      }, zoom, A4_HEIGHT_PX);

      const initial = await measureAt(1);
      if (!initial.fits) {
        let lo = 0.55;
        let hi = 1.0;
        let best = lo;
        for (let i = 0; i < 8; i += 1) {
          const mid = +(((lo + hi) / 2)).toFixed(3);
          const r = await measureAt(mid);
          if (r.fits) { best = mid; lo = mid; }
          else { hi = mid; }
        }
        await page.evaluate((z) => { document.documentElement.style.zoom = z; }, best);
      } else {
        // Reset to 1 since measureAt mutated the zoom during the probe.
        await page.evaluate(() => { document.documentElement.style.zoom = 1; });
      }
    }

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      preferCSSPageSize: true,
      // Hard-clamp to exactly one page in one-page mode. Any tiny residual
      // overflow is cropped, but the user never sees a near-empty page 2.
      ...(onePage ? { pageRanges: '1' } : {}),
    });
    return Buffer.from(pdf);
  } finally {
    try { await page.close(); } catch { /* ignore */ }
  }
}

export async function renderPdf(opts) {
  try {
    return await renderPdfOnce(opts);
  } catch (err) {
    if (!isClosedConnectionError(err)) throw err;
    // Browser process died — drop the singleton, relaunch, and retry once.
    console.warn('[pdf] Browser connection lost; relaunching and retrying once.');
    try { if (_browser) await _browser.close(); } catch { /* ignore */ }
    _browser = null;
    return renderPdfOnce(opts);
  }
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
