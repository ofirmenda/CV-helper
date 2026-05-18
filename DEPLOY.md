# Deploying CV Mirror AI to Fly.io

This is the lowest-cost realistic path for running CV Mirror AI as a public
multi-user app with persistent storage. Cost target: **~$3–5/month** (paid VM
+ free volume). Scale-to-zero is enabled, so if nobody is using it, you pay
almost nothing.

The repo is already configured — there's a `Dockerfile`, a `fly.toml`, and a
`.dockerignore`. You just need to install the CLI, sign in, and deploy.

---

## 0. Pre-flight security checklist (do this FIRST)

Before pushing to a public URL:

### a. No secrets in the repo

`server/.env` is gitignored, but verify before you commit:

```bash
git status                              # server/.env must NOT appear
git ls-files | grep -E "\.env$"         # must print nothing

# Scan only your code (skip node_modules / dist / .git) for OpenAI-key shapes.
# Matches sk-proj-…, sk-svcacct-…, and legacy sk-<30+ alphanumeric>.
grep -RnE "\bsk-(proj|svcacct|None|[A-Za-z0-9]{30,})" \
  --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" \
  --include="*.json" --include="*.md" --include="*.html" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git .
                                        # must print nothing
```

The earlier regex (`sk-[A-Za-z0-9_-]{16,}`) was loose enough to false-positive
on CSS property names like `mask-box-image-source` inside vendor dirs. Always
exclude `node_modules`.

If anything shows up, fix it before the first commit. Once a secret hits git
history, the only safe response is to rotate the secret (generate a new
OpenAI key, delete the old one in your OpenAI dashboard).

### b. Auth provider for production

`/api/auth/dev-signin` is now BLOCKED in `NODE_ENV=production` by default —
otherwise anyone on the internet could spam-create pending accounts.

Pick one of these before deploying:

- **Recommended: configure Google OAuth** (section 5 below). Set
  `AUTH_PROVIDER=google` and the three `GOOGLE_*` secrets. Only people with
  Google accounts you've explicitly approved can sign in.
- **Quick + dirty for first deploy testing only**: set
  `ALLOW_DEV_SIGNIN_IN_PROD=true`. This re-opens the dev sign-in. Use it
  only long enough to confirm the deploy works end-to-end, then disable.

### c. Strong session + crypto secrets

The app **refuses to start** in production if `SESSION_SECRET` or
`CRYPTO_SECRET` are missing or shorter than 32 chars. Generate them with:

```bash
openssl rand -hex 32   # POSIX shells
```

PowerShell equivalent (32 hex chars):
```powershell
-join ((1..32) | %{ '{0:x}' -f (Get-Random -Max 16) })
```

### d. Where do my secrets actually live?

**Short answer: in Fly.io's secret store** (`fly secrets set NAME=value`).

- They're encrypted at rest on Fly's infrastructure.
- They're injected as env vars at container startup.
- They never appear in the Docker image, in source, or in `git log`.
- `fly secrets list` shows the names but masks the values.

**You do NOT need GitLab/GitHub for this.** GitLab CI secrets are useful only
if you're using GitLab to *deploy on your behalf* (CI pushes to Fly). For a
manual `fly deploy` workflow, Fly's secret store is the canonical place.

**Never put real secrets in:**
- `server/.env` (only your local dev secrets go here, gitignored)
- `fly.toml`'s `[env]` block (that block is for non-sensitive config like
  `NODE_ENV` — its values DO end up in the public image)
- the Dockerfile
- README/docs

---

## 1. One-time setup (10 minutes)

### Install `flyctl`

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**macOS / Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

Then restart your terminal so `fly` is on PATH.

### Create an account + sign in

```bash
fly auth signup     # or: fly auth login
```

You'll need a credit card. Fly's hobby plan gives you a $5/month allowance
that covers small apps; you only get billed if you exceed it.

### Pick an app name

App names are globally unique on Fly. Open `fly.toml` and change
`app = "cv-mirror-ai"` to something only you'd pick, e.g.
`cv-mirror-yourname`. The free subdomain becomes `<name>.fly.dev`.

---

## 2. First deploy

From the repo root (the folder with `Dockerfile`):

```bash
fly launch --no-deploy --copy-config --name <your-app-name>
```

If it asks to override the existing `fly.toml`, say **no** (keep the one in
the repo). It will create the app on Fly's side and set up the volume.

If it doesn't auto-create the volume, do it manually:

```bash
fly volumes create cvmirror_data --region ams --size 1
```

(Match the region to whatever `primary_region` is in `fly.toml`.)

---

## 3. Set secrets

These are environment variables Fly will inject at runtime. You only need to
set them once; they persist across deploys.

```bash
# Required — long random strings (≥ 32 chars).
fly secrets set SESSION_SECRET="$(openssl rand -hex 32)"
fly secrets set CRYPTO_SECRET="$(openssl rand -hex 32)"

# The OpenAI key everyone shares.
fly secrets set OPENAI_API_KEY="sk-..."
fly secrets set AI_PROVIDER="openai"
fly secrets set OPENAI_MODEL="gpt-4o"   # or gpt-4o-mini if you want it cheaper

# Auto-promote your email to admin on first sign-in.
fly secrets set ADMIN_EMAIL="your-email@example.com"   # the email you'll sign in as

# Auth provider — start with "dev" to confirm everything works,
# then switch to "google" once you've set up OAuth (see section 5).
fly secrets set AUTH_PROVIDER="dev"
```

On Windows PowerShell, replace `$(openssl rand -hex 32)` with a hand-picked
random string (any 32+ char hex value works).

---

## 4. Deploy

```bash
fly deploy
```

First deploy takes ~5 minutes (Chromium install). Subsequent deploys are
~30s thanks to Docker layer caching. When it finishes, `fly open` opens your
app in the browser.

Sign in with your admin email (`ADMIN_EMAIL`). You'll be auto-approved.
Anyone else who signs in afterwards lands on the "Waiting for approval"
screen — open Settings → Manage user access → Approve.

---

## 5. (Optional) Switch to Google OAuth

Dev sign-in works but anyone with an email can request access. To require
Google sign-in:

### a. Create OAuth credentials in Google Cloud Console

1. Go to https://console.cloud.google.com → APIs & Services → Credentials.
2. Click **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Authorized redirect URIs: `https://<your-app-name>.fly.dev/api/auth/google/callback`
5. Copy the Client ID and Client Secret.

### b. Push them to Fly

```bash
fly secrets set \
  AUTH_PROVIDER=google \
  GOOGLE_CLIENT_ID="<id>" \
  GOOGLE_CLIENT_SECRET="<secret>" \
  GOOGLE_CALLBACK_URL="https://<your-app-name>.fly.dev/api/auth/google/callback"
```

Fly auto-restarts the app when secrets change.

---

## 6. Useful day-to-day commands

| Command                                | What it does                                      |
|----------------------------------------|---------------------------------------------------|
| `fly deploy`                           | Push the current code + redeploy                  |
| `fly logs`                             | Tail server logs (every `[server error]` shows up here) |
| `fly status`                           | Health + machine state                            |
| `fly ssh console`                      | Shell into the running container                  |
| `fly secrets list`                     | See what env vars are set (values are masked)     |
| `fly secrets unset <NAME>`             | Remove a secret                                   |
| `fly volumes list`                     | Show the persistent volume + its size             |
| `fly scale memory 2048`                | Bump VM RAM to 2GB (e.g. if PDF export OOMs)      |
| `fly scale count 0`                    | Stop all machines (pause billing while idle)      |
| `fly scale count 1`                    | Bring back the machine                            |

---

## 7. Custom domain (optional)

```bash
fly certs create cv-mirror.your-domain.com
```

It'll print DNS records you need to add at your domain registrar. Once
verified, the app auto-serves over HTTPS at your custom domain.

---

## Troubleshooting

**Deploy fails with `chromium: no such file or directory`.**
The image build was interrupted before `apt-get install chromium` finished.
Re-run `fly deploy`.

**`fly logs` shows OOM (out of memory) during PDF export.**
Chromium is heavy. Bump RAM: `fly scale memory 2048`. Cost goes up to ~$8/mo
but the export becomes reliable.

**Session cookie not persisting / users get logged out on each refresh.**
Confirm `SESSION_SECRET` is set (`fly secrets list`) and that
`primary_region` matches your volume's region — sessions live in
`/data/sessions.db` on the volume.

**OpenAI calls return 503 NO_OPENAI_KEY.**
`OPENAI_API_KEY` isn't set. Run `fly secrets set OPENAI_API_KEY="sk-..."`.

**`AUTH_PROVIDER=google` but sign-in redirects fail with `redirect_uri_mismatch`.**
The `GOOGLE_CALLBACK_URL` in your Fly secrets must match EXACTLY (including
`https://` and trailing path) what's whitelisted in Google Cloud Console.
