# Documentation

This folder contains detailed documentation for developers who want to understand the internal architecture of the Cortis chat application.

## Architecture Overview
- **Server**: Express.js for HTTP API, Socket.io for real‑time communication, MongoDB for data persistence.
- **Client**: React with functional components, React Router for navigation, Tailwind CSS for styling.

## Server Details
- **Authentication**: JWT strategy implemented in `src/middleware/auth.js`.
- **Socket Events**:
  - `joinRoom` – User joins a chat room.
  - `chatMessage` – Broadcasts a new message.
  - `typing` – Emits typing status.
  - `disconnect` – Handles cleanup.

## Client Details
- **State Management**: Context API + useReducer for global chat state.
- **WebSocket Layer**: Wrapper around Socket.io client located at `src/utils/socket.js`.
- **Styling**: Tailwind configuration is in `tailwind.config.js`.

## Environment Variables
Create a `.env` file in the `server` directory:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cortis
JWT_SECRET=your_secret_key
```
And a `.env` in the `client` directory for the API URL:
```
REACT_APP_API_URL=http://localhost:5000/api
```

## Development Workflow
1. Start MongoDB (`mongod`)
2. Run `npm run dev` in `server`
3. Run `npm start` in `client`
4. Open the app and test real‑time messaging.

For more detailed guides, refer to the individual markdown files in this directory.
