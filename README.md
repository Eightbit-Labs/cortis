# Cortis

Cortis is a full-stack messaging website with a Vim-inspired visual style and normal web navigation.

The app includes:

- account creation with display name, username, and profile picture presets
- friend requests by username (not display name)
- direct messages and small group chats (max 10 members)
- server creation, server invites, and multi-channel messaging
- owner-controlled channel permissions (including owner-only posting)
- profile pages with Markdown bios (200 character limit)
- realtime updates with Socket.IO
- red ping badges when messages include @everyone

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express + Socket.IO
- Current storage: in-memory server state
- Optional persistence: MongoDB (not yet wired)

## Project Structure

```text
cortis/
	client/           # React app (Vite)
	server/           # Express + Socket.IO API
	scripts/          # Dev tooling scripts
	  check-secrets.js  # Post-commit secret scanner
	.husky/           # Git hooks (managed by Husky)
	  post-commit     # Runs security checks after each commit
	README.md
```

## Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

## Quick Start

1. Install root dev tools (Husky git hooks):

```bash
npm install
```

2. Install client dependencies:

```bash
cd client
npm install
```

3. Install server dependencies:

```bash
cd ../server
npm install
```

4. Start the server:

```bash
npm run dev
```

5. In a new terminal, start the client:

```bash
cd ../client
npm run dev
```

6. Open the URL printed by Vite (usually http://localhost:5173).

## Environment Variables

### Server

Copy server/.env.example to server/.env and edit values as needed:

```env
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

### Client (optional)

If your API runs on a different host/port, create client/.env.local:

```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

## Scripts

### Client

- npm run dev: start Vite dev server
- npm run build: production build
- npm run lint: lint React code
- npm run preview: preview production build

### Server

- npm run dev: start API with nodemon
- npm start: start API with Node

## Current Storage Behavior

The server currently stores users, rooms, requests, and messages in memory.

- data resets whenever the server restarts
- great for local UI iteration and feature validation
- not suitable for production persistence

## MongoDB Integration Note

You do not need MongoDB to run this repo right now.

You will need MongoDB when you want persistent data across restarts or deployment.

Typical next steps:

1. Provision MongoDB (local or Atlas)
2. Add MONGODB_URI to server/.env
3. Replace the in-memory state module in server/index.js with a database adapter

## Security Checks

A `post-commit` git hook (managed by [Husky](https://typicode.github.io/husky/)) runs two automated security checks after every commit:

1. **Dependency audit** — `npm audit --audit-level=moderate` across both `client/` and `server/`
2. **Secret scan** — scans the committed diff for hardcoded credentials (private keys, API tokens, passwords, connection strings, etc.)

Hooks are installed automatically when you run `npm install` at the root (via the `prepare` script).

If a check fails, the commit is still recorded but a warning is printed so you can remediate before pushing.

### Checks that are detected

| Pattern | Examples |
|---|---|
| Private keys | `-----BEGIN RSA PRIVATE KEY-----` |
| Hardcoded credentials | `apiKey="abc123..."`, `password='hunter2'` |
| Connection strings | `mongodb://user:pass@host/db` |
| Platform tokens | GitHub PATs, Stripe keys, SendGrid keys, Twilio |

## Security and Production Notes

- This project currently has no real auth/password system
- Input validation and authorization are basic and demo-oriented
- Add proper auth, rate-limiting, persistent storage, and hardened validation before production use

## License

No license file is currently included. Add one if you plan to publish or distribute.