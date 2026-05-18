# CV Mirror AI — production image.
# Single Node process serves the built React SPA + the API on the same origin.
# Uses Debian's chromium (much smaller than letting puppeteer redownload) so the
# image stays around ~500MB instead of 1.2GB.

FROM node:20-bookworm-slim AS base

# System dependencies:
#   chromium                — for puppeteer (PDF rendering).
#   fonts-*                 — make the rendered PDFs match what we see locally.
#   python3 / build-essential — required by better-sqlite3's native compile.
#   tini                    — proper PID-1 to reap zombie Chromium processes.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      fonts-noto-color-emoji \
      python3 \
      build-essential \
      tini \
    && rm -rf /var/lib/apt/lists/*

# Tell puppeteer to skip its own Chromium download and use the system one.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install deps — copy package.jsons first so the layer caches across code edits.
COPY server/package.json server/package-lock.json* ./server/
COPY client/package.json client/package-lock.json* ./client/
RUN cd server && npm ci --omit=dev \
 && cd ../client && npm ci

# Copy sources and build the client.
COPY server/ ./server/
COPY client/ ./client/
RUN cd client && npm run build

# Clean up build-time-only deps to slim the runtime image.
RUN cd client && rm -rf node_modules \
 && apt-get purge -y --auto-remove python3 build-essential \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    UPLOAD_DIR=/tmp/cv-uploads

EXPOSE 4000
WORKDIR /app/server

# tini → handles signals + zombie processes cleanly (important for puppeteer).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
