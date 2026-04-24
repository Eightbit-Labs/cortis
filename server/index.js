require('dotenv').config()

const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')

const PORT = Number(process.env.PORT || 3001)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*'
const AVATAR_KEYS = [
  'amber-fox',
  'teal-crane',
  'rose-koi',
  'ink-wolf',
  'lime-gecko',
  'sunset-moth',
]

const app = express()
const server = http.createServer(app)
const allowedOrigins = CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN.split(',').map((item) => item.trim())
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH'],
  },
})

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

const socketsByUser = new Map()
let state
state = createSeedState()

function createSeedState() {
  let data = {
    nextId: 10,
    users: [],
    servers: [],
    dms: [],
    groups: [],
  }
  // Assign early so helper functions (getUser, ensureDm, etc.) can reference state
  state = data

  const neo = makeUser(data, {
    username: 'neo',
    password: 'demo123',
    displayName: 'Neo Split',
    avatarKey: 'amber-fox',
    bio: 'Writes release notes in Markdown and pings **@everyone** when builds land.',
  })
  const gwen = makeUser(data, {
    username: 'gwen',
    password: 'demo123',
    displayName: 'Gwen Buffer',
    avatarKey: 'teal-crane',
    bio: 'Calm moderator. Loves channel hygiene and readable threads.',
  })
  const mori = makeUser(data, {
    username: 'mori',
    password: 'demo123',
    displayName: 'Mori Tabs',
    avatarKey: 'rose-koi',
    bio: 'Sketches UI ideas between commits. _Prefers structured chaos._',
  })

  befriend(neo.id, gwen.id)
  befriend(gwen.id, mori.id)

  const demoDm = ensureDm(neo.id, gwen.id)
  demoDm.messages.push(makeMessage(data, neo.id, 'Server shell is live. Polish the layout next.'))
  demoDm.messages.push(makeMessage(data, gwen.id, 'On it. The split panes should feel like :vsplit, not Discord.'))

  const serverRecord = {
    id: nextId(data, 'server'),
    name: 'vim-hall',
    avatarKey: 'ink-wolf',
    ownerId: neo.id,
    memberIds: [neo.id, gwen.id],
    channels: [
      {
        id: nextId(data, 'channel'),
        name: 'general',
        ownerOnly: false,
        messages: [
          makeMessage(data, neo.id, 'Welcome to vim-hall. Standard web navigation only.'),
          makeMessage(data, gwen.id, 'Understood. Clicks, tabs, and forms stay normal.'),
        ],
      },
      {
        id: nextId(data, 'channel'),
        name: 'announcements',
        ownerOnly: true,
        messages: [makeMessage(data, neo.id, '@everyone Build preview is ready in the staging pane.')],
      },
    ],
  }
  data.servers.push(serverRecord)

  const demoGroup = {
    id: nextId(data, 'group'),
    name: 'concept-room',
    avatarKey: 'sunset-moth',
    ownerId: gwen.id,
    memberIds: [neo.id, gwen.id, mori.id],
    messages: [
      makeMessage(data, gwen.id, 'Keep the status line sharp and the chat input obvious.'),
      makeMessage(data, mori.id, 'I want the tabs to read like buffers, not badges pasted on later.'),
    ],
  }
  data.groups.push(demoGroup)

  markUnread(gwen.id, serverRecord.channels[1].id, true)
  markUnread(mori.id, demoGroup.id, false)

  return data
}

function makeUser(data, { username, password, displayName, avatarKey, bio }) {
  const user = {
    id: nextId(data, 'user'),
    username,
    password,
    displayName,
    avatarKey,
    bio,
    friends: [],
    incomingFriendRequests: [],
    outgoingFriendRequests: [],
    serverInvites: [],
    roomState: {},
  }

  data.users.push(user)
  return user
}

function nextId(data, prefix) {
  data.nextId += 1
  return `${prefix}-${data.nextId}`
}

function makeMessage(data, userId, content) {
  return {
    id: nextId(data, 'msg'),
    userId,
    content,
    createdAt: new Date().toISOString(),
  }
}

function getUser(userId) {
  return state.users.find((user) => user.id === userId) || null
}

function getUserByUsername(username) {
  return state.users.find((user) => user.username === username.toLowerCase()) || null
}

function userProfile(userId) {
  const user = getUser(userId)
  if (!user) {
    return null
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarKey: user.avatarKey,
    bio: user.bio,
  }
}

function befriend(firstId, secondId) {
  const first = getUser(firstId)
  const second = getUser(secondId)
  if (!first || !second) {
    return
  }

  if (!first.friends.includes(secondId)) {
    first.friends.push(secondId)
  }

  if (!second.friends.includes(firstId)) {
    second.friends.push(firstId)
  }

  ensureDm(firstId, secondId)
}

function ensureDm(firstId, secondId) {
  const existing = state.dms.find((dm) => dm.memberIds.includes(firstId) && dm.memberIds.includes(secondId))
  if (existing) {
    return existing
  }

  const room = {
    id: nextId(state, 'dm'),
    memberIds: [firstId, secondId],
    messages: [],
  }
  state.dms.push(room)
  return room
}

function getRoomState(user, roomId) {
  if (!user.roomState[roomId]) {
    user.roomState[roomId] = { unread: 0, ping: false }
  }

  return user.roomState[roomId]
}

function markUnread(userId, roomId, ping) {
  const user = getUser(userId)
  if (!user) {
    return
  }

  const roomState = getRoomState(user, roomId)
  roomState.unread += 1
  roomState.ping = roomState.ping || ping
}

function clearUnread(userId, roomId) {
  const user = getUser(userId)
  if (!user) {
    return
  }

  const roomState = getRoomState(user, roomId)
  roomState.unread = 0
  roomState.ping = false
}

function getServer(serverId) {
  return state.servers.find((serverItem) => serverItem.id === serverId) || null
}

function findChannel(channelId) {
  for (const serverItem of state.servers) {
    const channel = serverItem.channels.find((channelItem) => channelItem.id === channelId)
    if (channel) {
      return { channel, server: serverItem }
    }
  }

  return null
}

function getGroup(groupId) {
  return state.groups.find((group) => group.id === groupId) || null
}

function getDm(dmId) {
  return state.dms.find((dm) => dm.id === dmId) || null
}

function roomContext(roomId) {
  const channelMatch = findChannel(roomId)
  if (channelMatch) {
    return { type: 'channel', room: channelMatch.channel, server: channelMatch.server }
  }

  const dm = getDm(roomId)
  if (dm) {
    return { type: 'dm', room: dm }
  }

  const group = getGroup(roomId)
  if (group) {
    return { type: 'group', room: group }
  }

  return null
}

function roomMembers(context) {
  if (!context) {
    return []
  }

  if (context.type === 'channel') {
    return context.server.memberIds
  }

  return context.room.memberIds
}

function canAccessRoom(userId, context) {
  return roomMembers(context).includes(userId)
}

function canSendToRoom(userId, context) {
  if (!canAccessRoom(userId, context)) {
    return false
  }

  if (context.type === 'channel' && context.room.ownerOnly) {
    return context.server.ownerId === userId
  }

  return true
}

function serializeMessage(message) {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt,
    author: userProfile(message.userId),
  }
}

function serializeRoomForUser(userId, roomItem, type, serverItem) {
  const user = getUser(userId)
  const stateForRoom = getRoomState(user, roomItem.id)

  if (type === 'channel') {
    return {
      id: roomItem.id,
      name: roomItem.name,
      ownerOnly: roomItem.ownerOnly,
      canSend: canSendToRoom(userId, { type, room: roomItem, server: serverItem }),
      unread: stateForRoom.unread,
      ping: stateForRoom.ping,
      messages: roomItem.messages.map(serializeMessage),
    }
  }

  if (type === 'dm') {
    const otherMemberId = roomItem.memberIds.find((memberId) => memberId !== userId)
    return {
      id: roomItem.id,
      member: userProfile(otherMemberId),
      unread: stateForRoom.unread,
      ping: stateForRoom.ping,
      canSend: true,
      messages: roomItem.messages.map(serializeMessage),
    }
  }

  return {
    id: roomItem.id,
    name: roomItem.name,
    avatarKey: roomItem.avatarKey,
    ownerId: roomItem.ownerId,
    unread: stateForRoom.unread,
    ping: stateForRoom.ping,
    canSend: true,
    members: roomItem.memberIds.map(userProfile),
    messages: roomItem.messages.map(serializeMessage),
  }
}

function buildBootstrap(userId) {
  const user = getUser(userId)
  if (!user) {
    return null
  }

  return {
    user: userProfile(userId),
    friends: user.friends.map(userProfile),
    pendingFriendRequests: user.incomingFriendRequests.map(userProfile),
    outgoingFriendRequests: user.outgoingFriendRequests.map(userProfile),
    serverInvites: user.serverInvites
      .map((invite) => {
        const serverItem = getServer(invite.serverId)
        const inviter = userProfile(invite.fromUserId)
        if (!serverItem || !inviter) {
          return null
        }

        return {
          serverId: invite.serverId,
          serverName: serverItem.name,
          serverAvatarKey: serverItem.avatarKey,
          invitedBy: inviter,
        }
      })
      .filter(Boolean),
    servers: state.servers
      .filter((serverItem) => serverItem.memberIds.includes(userId))
      .map((serverItem) => ({
        id: serverItem.id,
        name: serverItem.name,
        avatarKey: serverItem.avatarKey,
        ownerId: serverItem.ownerId,
        members: serverItem.memberIds.map(userProfile),
        channels: serverItem.channels.map((channel) => serializeRoomForUser(userId, channel, 'channel', serverItem)),
      })),
    dms: state.dms
      .filter((dm) => dm.memberIds.includes(userId))
      .map((dm) => serializeRoomForUser(userId, dm, 'dm')),
    groups: state.groups
      .filter((group) => group.memberIds.includes(userId))
      .map((group) => serializeRoomForUser(userId, group, 'group')),
  }
}

function emitStateChange(userIds) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))]
  for (const userId of uniqueIds) {
    const socketIds = socketsByUser.get(userId)
    if (!socketIds) {
      continue
    }

    for (const socketId of socketIds) {
      io.to(socketId).emit('state_changed')
    }
  }
}

function okWithBootstrap(res, userId, extra = {}) {
  res.json({ ...extra, bootstrap: buildBootstrap(userId) })
}

function ensureAvatarKey(avatarKey) {
  return AVATAR_KEYS.includes(avatarKey)
}

function ensureUsername(value) {
  return /^[a-z0-9_]{3,20}$/.test(value)
}

function reject(res, message, status = 400) {
  res.status(status).json({ message })
}

app.get('/api/public/users', (_req, res) => {
  res.json({ users: state.users.map((user) => userProfile(user.id)) })
})

app.post('/api/auth/signup', (req, res) => {
  const displayName = String(req.body.displayName || '').trim()
  const username = String(req.body.username || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const avatarKey = String(req.body.avatarKey || '').trim()

  if (!displayName || !username || !password || !avatarKey) {
    return reject(res, 'Display name, username, password, and profile picture are required.')
  }

  if (!ensureUsername(username)) {
    return reject(res, 'Username must be 3-20 characters using letters, numbers, or underscores.')
  }

  if (password.length < 6) {
    return reject(res, 'Password must be at least 6 characters.')
  }

  if (!ensureAvatarKey(avatarKey)) {
    return reject(res, 'Choose one of the built-in profile pictures.')
  }

  if (getUserByUsername(username)) {
    return reject(res, 'That username is already taken.')
  }

  const user = makeUser(state, {
    username,
    password,
    displayName,
    avatarKey,
    bio: '',
  })

  return res.json({
    session: { userId: user.id, username: user.username },
    bootstrap: buildBootstrap(user.id),
  })
})

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const user = getUserByUsername(username)

  if (!user) {
    return reject(res, 'Unknown username.')
  }

  if (!password) {
    return reject(res, 'Password is required.')
  }

  if (user.password !== password) {
    return reject(res, 'Incorrect password.')
  }

  return res.json({
    session: { userId: user.id, username: user.username },
    bootstrap: buildBootstrap(user.id),
  })
})

app.get('/api/bootstrap', (req, res) => {
  const userId = String(req.query.userId || '')
  const bootstrap = buildBootstrap(userId)

  if (!bootstrap) {
    return reject(res, 'Session expired. Log in again.', 404)
  }

  return res.json({ bootstrap })
})

app.post('/api/users/bio', (req, res) => {
  const user = getUser(req.body.userId)
  const bio = String(req.body.bio || '')

  if (!user) {
    return reject(res, 'User not found.', 404)
  }

  if (bio.length > 200) {
    return reject(res, 'Bio must be 200 characters or fewer.')
  }

  user.bio = bio
  emitStateChange([user.id])
  return okWithBootstrap(res, user.id)
})

app.post('/api/users/settings', (req, res) => {
  const user = getUser(req.body.userId)
  const displayName = String(req.body.displayName || '').trim()
  const username = String(req.body.username || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const avatarKey = String(req.body.avatarKey || '').trim()

  if (!user) {
    return reject(res, 'User not found.', 404)
  }

  if (!displayName || !username || !password || !avatarKey) {
    return reject(res, 'Display name, username, password, and profile picture are required.')
  }

  if (!ensureUsername(username)) {
    return reject(res, 'Username must be 3-20 characters using letters, numbers, or underscores.')
  }

  if (password.length < 6) {
    return reject(res, 'Password must be at least 6 characters.')
  }

  if (!ensureAvatarKey(avatarKey)) {
    return reject(res, 'Choose one of the built-in profile pictures.')
  }

  const existing = getUserByUsername(username)
  if (existing && existing.id !== user.id) {
    return reject(res, 'That username is already taken.')
  }

  user.displayName = displayName
  user.username = username
  user.password = password
  user.avatarKey = avatarKey

  emitStateChange([user.id, ...user.friends])
  return res.json({
    session: { userId: user.id, username: user.username },
    bootstrap: buildBootstrap(user.id),
  })
})

app.post('/api/friends/request', (req, res) => {
  const user = getUser(req.body.userId)
  const target = getUserByUsername(String(req.body.username || '').trim().toLowerCase())

  if (!user || !target) {
    return reject(res, 'That username does not exist.', 404)
  }

  if (user.id === target.id) {
    return reject(res, 'You cannot friend yourself.')
  }

  if (user.friends.includes(target.id)) {
    return reject(res, 'You are already friends.')
  }

  if (user.outgoingFriendRequests.includes(target.id)) {
    return reject(res, 'Friend request already pending.')
  }

  user.outgoingFriendRequests.push(target.id)
  target.incomingFriendRequests.push(user.id)
  emitStateChange([user.id, target.id])
  return okWithBootstrap(res, user.id)
})

app.post('/api/friends/respond', (req, res) => {
  const user = getUser(req.body.userId)
  const fromUser = getUser(req.body.fromUserId)
  const action = String(req.body.action || '')

  if (!user || !fromUser) {
    return reject(res, 'User not found.', 404)
  }

  user.incomingFriendRequests = user.incomingFriendRequests.filter((id) => id !== fromUser.id)
  fromUser.outgoingFriendRequests = fromUser.outgoingFriendRequests.filter((id) => id !== user.id)

  if (action === 'accept') {
    befriend(user.id, fromUser.id)
  }

  emitStateChange([user.id, fromUser.id])
  return okWithBootstrap(res, user.id)
})

app.post('/api/servers', (req, res) => {
  const owner = getUser(req.body.userId)
  const name = String(req.body.name || '').trim()
  const avatarKey = String(req.body.avatarKey || '').trim()

  if (!owner) {
    return reject(res, 'User not found.', 404)
  }

  if (!name || !ensureAvatarKey(avatarKey)) {
    return reject(res, 'Server name and profile picture are required.')
  }

  const serverItem = {
    id: nextId(state, 'server'),
    name,
    avatarKey,
    ownerId: owner.id,
    memberIds: [owner.id],
    channels: [
      {
        id: nextId(state, 'channel'),
        name: 'general',
        ownerOnly: false,
        messages: [makeMessage(state, owner.id, `Welcome to ${name}.`)],
      },
      {
        id: nextId(state, 'channel'),
        name: 'announcements',
        ownerOnly: true,
        messages: [],
      },
    ],
  }

  state.servers.push(serverItem)
  emitStateChange([owner.id])
  return okWithBootstrap(res, owner.id, { serverId: serverItem.id })
})

app.post('/api/servers/:serverId/channels', (req, res) => {
  const serverItem = getServer(req.params.serverId)
  const user = getUser(req.body.userId)
  const name = String(req.body.name || '').trim().toLowerCase().replace(/\s+/g, '-')

  if (!serverItem || !user) {
    return reject(res, 'Server not found.', 404)
  }

  if (serverItem.ownerId !== user.id) {
    return reject(res, 'Only the server owner can create channels.', 403)
  }

  if (!name) {
    return reject(res, 'Channel name is required.')
  }

  const channel = {
    id: nextId(state, 'channel'),
    name,
    ownerOnly: false,
    messages: [],
  }
  serverItem.channels.push(channel)
  emitStateChange(serverItem.memberIds)
  return okWithBootstrap(res, user.id, { channelId: channel.id })
})

app.patch('/api/servers/:serverId/channels/:channelId', (req, res) => {
  const serverItem = getServer(req.params.serverId)
  const user = getUser(req.body.userId)
  const ownerOnly = Boolean(req.body.ownerOnly)

  if (!serverItem || !user) {
    return reject(res, 'Server not found.', 404)
  }

  if (serverItem.ownerId !== user.id) {
    return reject(res, 'Only the owner can change channel permissions.', 403)
  }

  const channel = serverItem.channels.find((item) => item.id === req.params.channelId)
  if (!channel) {
    return reject(res, 'Channel not found.', 404)
  }

  channel.ownerOnly = ownerOnly
  emitStateChange(serverItem.memberIds)
  return okWithBootstrap(res, user.id)
})

app.post('/api/servers/:serverId/invite', (req, res) => {
  const serverItem = getServer(req.params.serverId)
  const user = getUser(req.body.userId)
  const friend = getUser(req.body.friendId)

  if (!serverItem || !user || !friend) {
    return reject(res, 'Invite target not found.', 404)
  }

  if (!serverItem.memberIds.includes(user.id)) {
    return reject(res, 'You are not a member of that server.', 403)
  }

  if (!user.friends.includes(friend.id)) {
    return reject(res, 'You can only invite friends.')
  }

  if (serverItem.memberIds.includes(friend.id)) {
    return reject(res, 'That friend is already in the server.')
  }

  const exists = friend.serverInvites.some((invite) => invite.serverId === serverItem.id)
  if (exists) {
    return reject(res, 'Invite already pending.')
  }

  friend.serverInvites.push({ serverId: serverItem.id, fromUserId: user.id })
  emitStateChange([user.id, friend.id])
  return okWithBootstrap(res, user.id)
})

app.post('/api/invites/respond', (req, res) => {
  const user = getUser(req.body.userId)
  const serverItem = getServer(req.body.serverId)
  const action = String(req.body.action || '')

  if (!user || !serverItem) {
    return reject(res, 'Invite not found.', 404)
  }

  const invite = user.serverInvites.find((item) => item.serverId === serverItem.id)
  if (!invite) {
    return reject(res, 'Invite not found.', 404)
  }

  user.serverInvites = user.serverInvites.filter((item) => item.serverId !== serverItem.id)
  if (action === 'accept' && !serverItem.memberIds.includes(user.id)) {
    serverItem.memberIds.push(user.id)
  }

  emitStateChange([user.id, ...serverItem.memberIds])
  return okWithBootstrap(res, user.id)
})

app.post('/api/groups', (req, res) => {
  const owner = getUser(req.body.userId)
  const name = String(req.body.name || '').trim()
  const avatarKey = String(req.body.avatarKey || '').trim()
  const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : []

  if (!owner) {
    return reject(res, 'User not found.', 404)
  }

  if (!name || !ensureAvatarKey(avatarKey)) {
    return reject(res, 'Group name and picture are required.')
  }

  const uniqueMembers = [...new Set([owner.id, ...memberIds])]
  if (uniqueMembers.length > 10) {
    return reject(res, 'Group chats are capped at 10 members total.')
  }

  const notFriends = uniqueMembers.filter((memberId) => memberId !== owner.id && !owner.friends.includes(memberId))
  if (notFriends.length) {
    return reject(res, 'You can only create group chats with friends.')
  }

  const group = {
    id: nextId(state, 'group'),
    name,
    avatarKey,
    ownerId: owner.id,
    memberIds: uniqueMembers,
    messages: [makeMessage(state, owner.id, `Opened group ${name}.`)],
  }
  state.groups.push(group)
  emitStateChange(uniqueMembers)
  return okWithBootstrap(res, owner.id, { groupId: group.id })
})

app.post('/api/read', (req, res) => {
  const user = getUser(req.body.userId)
  const context = roomContext(req.body.roomId)

  if (!user || !context || !canAccessRoom(user.id, context)) {
    return reject(res, 'Room not found.', 404)
  }

  clearUnread(user.id, context.room.id)
  emitStateChange([user.id])
  return okWithBootstrap(res, user.id)
})

io.on('connection', (socket) => {
  socket.on('authenticate', ({ userId }) => {
    const user = getUser(userId)
    if (!user) {
      socket.emit('action_error', { message: 'Authentication failed.' })
      return
    }

    socket.data.userId = user.id
    const current = socketsByUser.get(user.id) || new Set()
    current.add(socket.id)
    socketsByUser.set(user.id, current)
  })

  socket.on('send_message', ({ userId, roomId, content }) => {
    const author = getUser(userId)
    const context = roomContext(roomId)
    const trimmed = String(content || '').trim()

    if (!author || !context || !trimmed) {
      socket.emit('action_error', { message: 'Cannot send that message.' })
      return
    }

    if (!canSendToRoom(author.id, context)) {
      socket.emit('action_error', { message: 'You do not have permission to send in that room.' })
      return
    }

    const message = makeMessage(state, author.id, trimmed)
    context.room.messages.push(message)
    clearUnread(author.id, context.room.id)

    const pinged = /(^|\s)@everyone\b/i.test(trimmed) && context.type !== 'dm'
    const recipients = roomMembers(context)
    for (const memberId of recipients) {
      if (memberId !== author.id) {
        markUnread(memberId, context.room.id, pinged)
      }
    }

    emitStateChange(recipients)
  })

  socket.on('disconnect', () => {
    const userId = socket.data.userId
    if (!userId) {
      return
    }

    const current = socketsByUser.get(userId)
    if (!current) {
      return
    }

    current.delete(socket.id)
    if (current.size === 0) {
      socketsByUser.delete(userId)
    }
  })
})

server.listen(PORT, () => {
  console.log(`Cortis server listening on http://localhost:${PORT}`)
})