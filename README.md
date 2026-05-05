# Quiz Buzzer Hub

Real-time multiplayer quiz buzzer web app with mini-games, built with React, Node.js, Express, and Socket.IO.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React 19 + Vite + Tailwind CSS (`artifacts/quiz-buzzer`)
- **Backend**: Express 5 + Socket.IO (`artifacts/api-server`)
- **Real-time**: Socket.IO via `/api/socket.io`
- **State**: In-memory (no database)
- **Node.js**: 20+

## Local development

Requires Node 20+ and pnpm 9+.

```bash
# Enable pnpm via corepack (one-time)
corepack enable
corepack prepare pnpm@9.15.4 --activate

# Install
pnpm install

# Build everything
pnpm run build

# Start the production server (serves built frontend + Socket.IO)
PORT=8080 pnpm run start
# Open http://localhost:8080

# OR run frontend and backend separately in dev mode
pnpm run dev:backend   # backend on PORT (default 8080)
pnpm run dev:frontend  # frontend dev server with HMR
```

## Deployment to Railway

1. Push this folder to a GitHub repo.
2. Sign in at https://railway.com/, click **New Project → Deploy from GitHub repo**, pick the repo.
3. Railway auto-detects Node + pnpm via `nixpacks.toml` and `railway.json`.
4. **No env vars needed** — Railway injects `PORT` automatically.
5. After the first successful deploy, go to the service **Settings → Networking → Generate Domain** to get a public URL.
6. Open the URL — admin lobby loads at `/`. Players join via the QR code or `/join/:sessionId/:teamId`.

The healthcheck endpoint is `/api/healthz`.

## Routes

| Path | Description |
|------|-------------|
| `/` | Admin lobby — create session, configure teams, view QR codes |
| `/admin/game/:sessionId` | Admin game control — questions, buzzer, scoring, mini-games |
| `/admin/questions` | Question manager — full CRUD, persisted to localStorage |
| `/join/:sessionId/:teamId` | Player join (mobile-friendly) |
| `/watch/:sessionId` | Spectator view (read-only scoreboard) |
| `/api/healthz` | Health check |
| `/api/socket.io` | Socket.IO endpoint |

## Mini-games

1. **Pac-Man Battle** — two teams compete to eat dots in a maze
2. **Number Survival** — pick 1–10, duplicates eliminated, last team standing wins
3. **Face Merge** — guess the celebrity from blended photos
4. **Mystery Puzzle** — solve clues to unlock a vault code
