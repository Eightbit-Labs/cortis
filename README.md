# Cortis Chat Application

Welcome to **Cortis**, a real‑time chat app built with Node.js, Socket.io, and React. This repository contains the server and client code, setup instructions, and usage examples.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Features
- Real‑time messaging with Socket.io
- Username and password authentication (session tracked by user ID)
- In‑memory data store — state is seeded on startup and resets when the server restarts
- Direct messages, group chats, and servers with named channels
- Unread message indicators and friend‑request system
- Light and dark theme support

## Prerequisites
- **Node.js** >= 18.x
- **npm** or **yarn**
- **Git**

## Installation
```bash
# Clone the repository
git clone https://github.com/eightbitlabs/cortis.git
cd cortis

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

## Running the App
### Development Mode
```bash
# In one terminal, start the server
cd server
npm run dev

# In another terminal, start the React client
cd client
npm run dev
```
The client will be available at `http://localhost:5173` and connects to the server at `http://localhost:3001`.

### Production Build
```bash
# Build the client
cd client
npm run build

# Start the API and Socket.io server
cd ../server
npm start
```
The server handles API and Socket.io connections. Serve `client/dist` separately (e.g. via a static file host or CDN).

## Project Structure
```
├── server/                 # Express + Socket.io backend
│   ├── index.js            # Server entrypoint (all routes and socket handlers)
│   └── package.json
├── client/                 # React front‑end (Vite)
│   ├── src/
│   │   ├── App.jsx         # Root component and routing
│   │   ├── App.css         # Component styles
│   │   ├── main.jsx        # Vite entry
│   │   ├── index.css       # Global styles
│   │   └── assets/         # Static assets
│   └── package.json
├── .gitignore
└── README.md               # Documentation (this file)
```

## API Overview
- **POST** `/api/auth/signup` – Register a new user
- **POST** `/api/auth/login` – Authenticate and receive a session object
- **GET** `/api/public/users` – List public user profiles

Socket.io handles all real‑time events (messages, friend requests, server invites). HTTP routes identify the acting user via `userId` in the request body or query string.

## Testing
There are no automated test suites configured at this time. Manual testing can be done by running both the server and client in development mode and exercising the UI.

## Contributing
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes with clear messages
4. Open a Pull Request against the `prod` branch

Please ensure linting passes and write unit tests for new functionality.

## License
Distributed under the ISC License. See `server/package.json` for details.
