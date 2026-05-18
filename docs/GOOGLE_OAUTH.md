# Setting up Google OAuth for CV Mirror AI

This swaps the email-only dev sign-in for **real Google authentication**.
After this, users sign in with their Google account; only emails you've
explicitly approved (in the app's admin panel) can access the app.

**Time to set up: ~15 minutes.** Most of it is clicking through Google's
console. No code changes needed — the server already supports both providers
via the `AUTH_PROVIDER` env var.

---

## What you'll get when you finish

- `AUTH_PROVIDER=google` set in your env (locally + on Fly).
- A Google OAuth Client ID + Secret stored as secrets.
- The login screen shows a "Sign in with Google" button instead of an email
  form.
- The dev-signin endpoint is automatically disabled (no more email-spam vector).

---

## Prerequisites

- A Google account (any Gmail / Google Workspace account works).
- Decided on your Fly subdomain (e.g. `cv-mirror-yourname.fly.dev`).
  If you haven't deployed yet, pick the name you'll use in `fly.toml`.

---

## Step 1 — Create a Google Cloud project

1. Open https://console.cloud.google.com
2. Top bar → click the project dropdown → **New Project**
3. Name it something like **CV Mirror AI** → **Create**
4. Wait for the notification "Project created", then switch to it (top-bar dropdown).

> No billing required — OAuth login is free and within Google's free quota.

---

## Step 2 — Configure the OAuth consent screen

This is the screen users see ("CV Mirror AI wants to access your email and
profile"). You have to fill it in before Google will issue you credentials.

1. Left sidebar → **APIs & Services** → **OAuth consent screen**.
2. **User Type**: choose **External** → **Create**.
    - "External" lets any Google account sign in (you'll restrict via the
      app's admin approval anyway).
    - "Internal" is only available on Google Workspace and restricts to
      your workspace domain.
3. **App information**:
    - **App name**: `CV Mirror AI` (whatever you want users to see).
    - **User support email**: your email.
    - **App logo**: optional, skip for now.
4. **App domain** (all optional, skip):
    - Application home page
    - Application privacy policy
    - Application terms of service
5. **Authorized domains**: add `<your-app-name>.fly.dev` (e.g.
   `cv-mirror-yourname.fly.dev` — whatever your Fly app name is). Press
   Enter after typing.
    - ⚠️ Do NOT enter just `fly.dev` — Google rejects it with
      *"Invalid domain: must be a top private domain"* because `fly.dev`
      is on the Public Suffix List (treated like `.com`). You must use
      the specific subdomain you'll own.
    - Pick your Fly app name **before** this step — it has to match what
      you'll put in `fly.toml`'s `app =` field and the redirect URI in
      step 3.6.
    - Don't add `localhost` — Google treats it as special and accepts it
      on the redirect URI side without an authorized-domain entry.
6. **Developer contact information**: your email → **Save and Continue**.
7. **Scopes** screen → click **Add or Remove Scopes** → check these two
   non-sensitive scopes:
    - `.../auth/userinfo.email`
    - `.../auth/userinfo.profile`
   Click **Update** → **Save and Continue**.
8. **Test users** screen → click **Add Users**, paste each email of every
   person who'll be allowed to sign in during testing (including your own).
   Up to 100 emails total.
    - ⚠️ While the app is in "Testing" mode, ONLY these emails can sign in.
      That's actually a useful extra access gate.
9. **Save and Continue** → **Back to Dashboard**.

> Going to "Production" mode requires a Google review (~weeks for scoped
> apps). With just the email + profile scopes you can usually self-publish.
> For now, **leave it in Testing**. Add new users as you approve them.

---

## Step 3 — Create the OAuth Client ID

1. Left sidebar → **APIs & Services** → **Credentials**.
2. Top → **+ Create Credentials** → **OAuth client ID**.
3. **Application type**: **Web application**.
4. **Name**: `CV Mirror AI — web` (or anything).
5. **Authorized JavaScript origins** — add both:
    ```
    http://localhost:5173
    https://<your-app-name>.fly.dev
    ```
    (`5173` is Vite's dev port. Replace `<your-app-name>` with your Fly app name.)
6. **Authorized redirect URIs** — add both:
    ```
    http://localhost:4000/api/auth/google/callback
    https://<your-app-name>.fly.dev/api/auth/google/callback
    ```
    (`4000` is the server port. Same `<your-app-name>` substitution.)
7. **Create**.

A modal pops up with:
- **Your Client ID**: looks like `1234567890-abc...apps.googleusercontent.com`
- **Your Client Secret**: looks like `GOCSPX-abcdef...`

**Copy both immediately.** You can re-retrieve the Client ID later but the
Secret is hidden after this modal closes — you'd have to regenerate it if you
lose it.

---

## Step 4 — Configure locally first (so you can test before deploying)

Open `server/.env` and add:

```bash
AUTH_PROVIDER=google
GOOGLE_CLIENT_ID=<paste the Client ID>
GOOGLE_CLIENT_SECRET=<paste the Client Secret>
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

Restart your local dev server (Ctrl+C, `npm run dev`).

### Verify

1. Open http://localhost:5173 in the browser.
2. The login screen should now show a **Sign in with Google** button
   (instead of the email form).
3. Click it → Google's account chooser → pick the email you added as a
   test user.
4. You should land back on the app, signed in. If your email matches
   `ADMIN_EMAIL` in `server/.env`, you're auto-approved.

If it works → ship it to Fly (next step). If you see an error, jump to
the **Troubleshooting** section below.

---

## Step 5 — Push to Fly

```bash
fly secrets set \
  AUTH_PROVIDER=google \
  GOOGLE_CLIENT_ID="<paste>" \
  GOOGLE_CLIENT_SECRET="<paste>" \
  GOOGLE_CALLBACK_URL="https://<your-app-name>.fly.dev/api/auth/google/callback"
```

Fly auto-restarts the app when secrets change.

If you previously had `ALLOW_DEV_SIGNIN_IN_PROD=true` set for testing,
**remove it now** — Google OAuth is your sole auth path:

```bash
fly secrets unset ALLOW_DEV_SIGNIN_IN_PROD
```

Verify by opening `https://<your-app-name>.fly.dev/api/health` in the browser.
You should see something like:

```json
{ "ok": true, "provider": "openai", "model": "gpt-4o", "authProvider": "google", "user": null }
```

Then sign in via the app. ✓

---

## Approving new users

Once Google OAuth is live:

1. A new user clicks **Sign in with Google** and authenticates.
2. They land on the **"Waiting for approval"** screen — their email row is
   created in your DB with `is_approved = 0`.
3. You (the admin) open Settings → **Manage user access** → click
   **Approve** next to their email.
4. They refresh → they're in.

Also remember to add them as **test users** in the Google OAuth consent screen
(Step 2.8 above), or they'll be blocked by Google before they ever reach
your "Waiting for approval" screen.

---

## Troubleshooting

### "redirect_uri_mismatch" after clicking Sign in with Google

The redirect URI sent in the request didn't match anything whitelisted in
Step 3.6. Check:

- Spelling — `auth` vs `Auth`, `callback` vs `callbacks`. Exact match.
- Protocol — `http://` for localhost, `https://` for fly.dev. Don't mix.
- Port — `4000` for the server, NOT `5173` (that's the client).
- Trailing slash — neither URL should have one.

Edit the Authorized redirect URIs in Google Cloud Console and **save**.
The change takes effect immediately.

### "Access blocked: this app's request is invalid"

Usually means the OAuth consent screen isn't fully filled in. Re-check
Step 2 — every required field must have a value.

### "Error 403: access_denied"

The signing-in account isn't on the test-users list (Step 2.8). Add it.

### Sign-in works but `/api/auth/me` returns 401

The session cookie isn't being set. Check:
- `SESSION_SECRET` is set (`fly secrets list`).
- The Fly app is being accessed over HTTPS (cookies are `secure: true` in
  production — they're dropped on plain HTTP).
- The Authorized JavaScript origin in Google Cloud Console matches the
  exact domain you're loading the app from.

### Locally, "Sign in with Google" doesn't appear — still showing email form

`AUTH_PROVIDER` isn't being read. Check:
- `server/.env` has `AUTH_PROVIDER=google` (no quotes, no spaces).
- You restarted `npm run dev` for the server after editing `.env`.
- `curl http://localhost:4000/api/health` returns `"authProvider": "google"`.

### "This app isn't verified" warning on Google's screen

Expected while in Testing mode with External user type. Click
**Advanced** → **Go to CV Mirror AI (unsafe)**. This is normal; the
warning goes away when you publish + verify the app (only needed if you
want >100 users).

---

## Rotating the Client Secret

If you ever leak the Client Secret:

1. Google Cloud Console → Credentials → click your OAuth client → top
   right **Reset Secret** → confirm.
2. Update `GOOGLE_CLIENT_SECRET` in both `server/.env` and Fly secrets.
3. Restart server / `fly deploy`.

Existing user sessions are not invalidated (those use your `SESSION_SECRET`).
