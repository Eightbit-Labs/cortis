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
- User authentication (JWT based)
- Persistent chat history stored in MongoDB
- Typing indicators and read receipts
- Responsive UI built with React and Tailwind CSS

## Prerequisites
- **Node.js** >= 18.x
- **npm** or **yarn**
- **MongoDB** instance (local or Atlas)
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
npm start
```
The client will be available at `http://localhost:3000` and will proxy API calls to the server at `http://localhost:5000`.

### Production Build
```bash
# Build the client
cd client
npm run build

# Serve the static files via the Express server
cd ../server
npm start
```
The production server will serve the built React app and handle Socket.io connections.

## Project Structure
```
├── server/                 # Express + Socket.io backend
│   ├── index.js            # Server entrypoint
│   └── package.json
├── client/                 # React front‑end
│   ├── src/                # Source code
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page views
│   │   └── ...
│   └── package.json
├── .gitignore
├── README.md               # Documentation (this file)
└── LICENSE
```

## API Overview
- **POST** `/api/auth/register` – Register a new user
- **POST** `/api/auth/login` – Authenticate and receive a JWT
- **GET** `/api/messages` – Retrieve recent chat messages (protected)
- **POST** `/api/messages` – Send a new message (protected)

All protected routes require an `Authorization: Bearer <token>` header.

## Testing
```bash
# Run backend tests
cd server
npm test

# Run frontend tests
cd ../client
npm test
```

## Contributing
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes with clear messages
4. Open a Pull Request against the `prod` branch

Please ensure linting passes and write unit tests for new functionality.

## License
Distributed under the MIT License. See `LICENSE` for more information.
