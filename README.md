# Cortis

Cortis is a full-stack messaging app made for students and developers. <br>
Logo design: [Nathaniel Shou]{https://github.com/MrDragon0011}

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express + Socket.IO + Render

## Project Structure

```text
cortis/
	client/   # React app 
	server/   # Express + Socket.IO + Render API
	README.md
```

## Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

## Quick Start

1. Install client dependencies:

```bash
cd client
npm install
```

2. Install server dependencies:

```bash
cd ../server
npm install
```

3. Start the server:

```bash
npm run dev
```

4. In a new terminal, start the client:

```bash
cd ../client
npm run dev
```

5. Open the URL printed by Vite (usually http://localhost:5173).

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

## Security and Production Notes

- This project currently has no real auth/password system
- Input validation and authorization are basic and demo-oriented
- Add proper auth, rate-limiting, persistent storage, and hardened validation before production use

## License

MIT License
