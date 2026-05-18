# CV Mirror AI

A polished, futuristic-feeling local tool where a job description "analyzes" your CV through a split-screen Mirror UI with animated keyword-to-section connections, an animated match-score ring, and a section-by-section approval wizard for tailoring.

Three modes:

- **Mirror** — split-screen JD vs CV with curved SVG connections, hover-to-highlight, click-to-scroll, animated overall match score.
- **Rewrite** — section-by-section approval wizard. For each section: Before / After diff, change list, reason, and four actions (Approve · Edit · Keep original · Skip). Final CV is assembled client-side from your decisions.
- **Improve** — ATS-style report with keyword/skills/experience/formatting sub-scores, matched / partial / missing keywords, and formatting warnings.

Plus: **PDF export** via two HTML/CSS templates recreated from real Canva-style designs (single-page, soft cap with adaptive font sizing), **Markdown** export of both the tailored CV and the changes report, and **CV upload** (PDF/DOCX → extracted JSON).

---

## Architecture

```
cv-helper/
├── client/        # React + Vite + Tailwind, Zustand store
└── server/        # Node + Express, Puppeteer PDF, pdfjs/mammoth extraction,
                   # provider-abstracted AI (mock or OpenAI / ChatGPT)
```

- The server proposes per-section changes; the client decides what to accept.
- No database. Data lives in `server/data/cv_base.json` and `server/data/latest_result.json`.
- AI provider is pluggable via `AI_PROVIDER` (`mock` default, `openai` for ChatGPT).

---

## Setup

Requires Node 18+ (Node 20+ recommended).

```bash
# from repo root
npm install
npm install --prefix server
npm install --prefix client
```

> Note: the server install pulls Puppeteer's bundled Chromium (~170MB).
> On Windows the first install can take a few minutes.

### Configure AI provider (optional)

The app works fully in **mock mode** without any API key — the mock produces deterministic, sensible tailoring so the whole UI is exercisable.

To use ChatGPT for real tailoring, copy `.env.example` to `.env` inside `server/`:

```bash
# server/.env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

Where to get the key: log in at [platform.openai.com](https://platform.openai.com) with your existing OpenAI account, add a payment method (API billing is separate from any ChatGPT Plus subscription), and create an API key. Default model is **gpt-4o** — best quality, ~$0.014 per analyze call (~70 analyses per $1). Set `OPENAI_MODEL=gpt-4o-mini` if you want ~10× cheaper for heavy testing.

### Run

```bash
# from repo root — starts server (:4000) and client (:5173) together
npm run dev
```

Then open http://localhost:5173.

---

## Usage walkthrough

1. The app loads with a seed CV (`Alex Rivera — Senior Frontend Engineer`).
2. In **Mirror** mode, paste a job description (there's a "Try sample" button if you want a ready-made one), then click **✨ Analyze & Tailor**.
3. Curved lines connect each detected JD keyword to the CV section that matches. Hover a keyword to spotlight its connections. Click a keyword to scroll the CV to the linked section. The center ring fills with your overall ATS-style score.
4. Switch to **Rewrite** mode. The section-by-section wizard opens. For each section you'll see Before / After / word-level diff / change list / reason. Pick one:
   - ✅ Approve — keep the AI version
   - ✏️ Edit — open inline editor pre-filled with the suggestion
   - ↩️ Keep original — reject the AI version
   - ⏭ Skip — decide later
5. After all sections are resolved, you'll see the consolidated tailored CV with Copy / Download / Export buttons.
6. Switch to **Improve** mode for the ATS breakdown.
7. Click **Export** in the top bar to open the PDF preview. Choose between two templates:
   - **Tech / Student** — left-sidebar layout with icons (modern style)
   - **Executive** — right-sidebar, monochrome, multi-page friendly (classic style)

---

## Backend API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | — | `{ok, provider}` |
| GET | `/api/cv` | — | `{cv}` |
| PUT | `/api/cv` | `{cv}` | `{ok}` |
| POST | `/api/cv/upload` | multipart `file` | `{cv}` |
| POST | `/api/analyze` | `{cv, jd}` | `{sections, ats, connections, keywords, provider}` |
| GET | `/api/analyze/latest` | — | `{result}` |
| POST | `/api/export/pdf` | `{cv, template}` | PDF binary |
| POST | `/api/export/markdown` | `{cv}` | Markdown text |

---

## Project structure

```
server/
├── server.js                       # Express bootstrap
├── routes/
│   ├── cvRoutes.js                 # GET/PUT CV, POST upload
│   ├── analysisRoutes.js           # POST /analyze
│   └── exportRoutes.js             # POST /pdf, /markdown
├── services/
│   ├── aiService.js                # provider abstraction (mock | openai)
│   ├── mockAI.js                   # deterministic tailoring
│   ├── atsService.js               # ATS scoring
│   ├── keywordService.js           # JD keyword extraction + matching
│   ├── extractionService.js        # PDF + DOCX → CV JSON
│   ├── pdfService.js               # Puppeteer + handlebars render
│   └── fileStorageService.js       # atomic JSON read/write
├── templates/
│   ├── template-modern.{html,css}  # left-sidebar
│   └── template-classic.{html,css} # right-sidebar
└── data/
    └── (runtime only — see services/seed.js for the starter CV)
    ├── cv_base.json                # generated on first run
    └── latest_result.json          # cached last analysis

client/
└── src/
    ├── App.jsx
    ├── store/useAppStore.js        # Zustand store with section approvals
    ├── api/client.js               # fetch wrappers
    └── components/
        ├── layout/                 # TopBar, ModeSwitcher
        ├── mirror/                 # MirrorView, JD input, CV panel,
        │                           # ScoreCircle, ConnectionsLayer, KeywordChip
        ├── rewrite/                # SectionReviewWizard, Card, DiffView,
        │                           # InlineEditor, ReviewSummary
        ├── improve/                # ATSReportView
        ├── editor/                 # BaseCVEditor, CVUpload
        └── export/                 # PDFPreviewModal
```

---

## How tailoring stays honest

- The mock and the OpenAI prompt both forbid inventing experience, dates, employers, schools, skills, or projects.
- Tailoring only **rewrites, reorders, or emphasizes** content that already exists.
- A JD keyword may be added **only** if implicitly demonstrated by an existing bullet.
- Education and Languages are **never modified** — they're factual.
- Every change is opt-in via the approval wizard; nothing is applied automatically.

---

## Troubleshooting

- **Puppeteer install fails on Windows** — corporate AV / proxy may block the Chromium download. Either whitelist it or switch to `puppeteer-core` and point at your installed Chrome.
- **OPENAI_API_KEY not set** — either set it in `server/.env` or set `AI_PROVIDER=mock`.
- **PDF preview is blank** — the iframe blob URL got revoked; close and reopen the export modal.
- **Section appears empty in the wizard** — that section has no content in your base CV. Add it via the editor.
