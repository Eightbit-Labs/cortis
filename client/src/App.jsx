import { startTransition, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL
const SESSION_KEY = 'cortis.session'

const AVATAR_PRESETS = [
  { key: 'amber-fox', glyph: '', tone: 'amber' },
  { key: 'teal-crane', glyph: '鶴', tone: 'teal' },
  { key: 'rose-koi', glyph: '鯉', tone: 'rose' },
  { key: 'ink-wolf', glyph: '狼', tone: 'ink' },
  { key: 'lime-gecko', glyph: '守', tone: 'lime' },
  { key: 'sunset-moth', glyph: '蝶', tone: 'sunset' },
]

const EMPTY_SELECTION = {
  section: 'servers',
  messageMode: 'dms',
  serverId: '',
  channelId: '',
  dmId: '',
  groupId: '',
  profileUsername: '',
}

function presetForAvatar(avatarKey) {
  return AVATAR_PRESETS.find((preset) => preset.key === avatarKey) ?? AVATAR_PRESETS[0]
}

function Avatar({ avatarKey, label, size = 'md' }) {
  const preset = presetForAvatar(avatarKey)

  return (
    <div className={`avatar avatar-${size} tone-${preset.tone}`} aria-hidden="true">
      <span>{preset.glyph}</span>
      <span className="avatar-ring">{label?.slice(0, 1) ?? ''}</span>
    </div>
  )
}

function VimFiller({ lines = 10 }) {
  return (
    <div className="vim-filler" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index}>~</span>
      ))}
    </div>
  )
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  const data = await response.json().catch(() => ({ message: 'Unexpected server response.' }))

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed.')
  }

  return data
}

function sumUnread(items) {
  return items.reduce((total, item) => total + (item.unread ?? 0), 0)
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function countServerPings(server) {
  return server.channels.filter((channel) => channel.ping).length
}

function normalizeSelection(current, bootstrap) {
  const next = { ...current }

  if (!bootstrap.servers.some((server) => server.id === current.serverId)) {
    next.serverId = bootstrap.servers[0]?.id ?? ''
  }

  const activeServer = bootstrap.servers.find((server) => server.id === next.serverId)
  if (!activeServer?.channels.some((channel) => channel.id === current.channelId)) {
    next.channelId = activeServer?.channels[0]?.id ?? ''
  }

  if (!bootstrap.dms.some((dm) => dm.id === current.dmId)) {
    next.dmId = bootstrap.dms[0]?.id ?? ''
  }

  if (!bootstrap.groups.some((group) => group.id === current.groupId)) {
    next.groupId = bootstrap.groups[0]?.id ?? ''
  }

  if (!next.profileUsername) {
    next.profileUsername = bootstrap.user.username
  }

  return next
}

function ProfileCard({
  profile,
  isSelf,
  bioDraft,
  onBioDraftChange,
  onBioSave,
  settingsDraft,
  onSettingsChange,
  onSettingsSave,
}) {
  return (
    <section className="profile-card">
      <div className="profile-hero">
        <Avatar avatarKey={profile.avatarKey} label={profile.displayName} size="xl" />
        <div>
          <h2>{profile.displayName}</h2>
          <p className="profile-username">@{profile.username}</p>
        </div>
      </div>

      <div className="profile-bio-block">
        <h3>Bio</h3>
        <div className="markdown-shell">
          {profile.bio ? <ReactMarkdown>{profile.bio}</ReactMarkdown> : <p>No bio written.</p>}
        </div>
      </div>

      {isSelf ? (
        <>
          <form className="bio-editor" onSubmit={onBioSave}>
            <div className="section-heading">
              <h3>Edit Bio</h3>
              <span>{bioDraft.length}/200</span>
            </div>
            <textarea
              value={bioDraft}
              maxLength={200}
              onChange={(event) => onBioDraftChange(event.target.value)}
              placeholder="Write Markdown here. Example: **building** a calmer chat client."
            />
            <button type="submit">Save bio</button>
          </form>

          <form className="bio-editor" onSubmit={onSettingsSave}>
            <div className="section-heading">
              <h3>Account settings</h3>
              <span>Update your profile and login credentials</span>
            </div>
            <label>
              Display name
              <input
                value={settingsDraft.displayName}
                onChange={(event) => onSettingsChange('displayName', event.target.value)}
                placeholder="Pixel Lavender"
                required
              />
            </label>
            <label>
              Username
              <input
                value={settingsDraft.username}
                onChange={(event) => onSettingsChange('username', event.target.value.toLowerCase())}
                placeholder="pixel_lavender"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={settingsDraft.password}
                onChange={(event) => onSettingsChange('password', event.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </label>
            <fieldset className="avatar-picker">
              <legend>Profile picture</legend>
              <div className="avatar-grid">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.key}
                    className={settingsDraft.avatarKey === preset.key ? 'avatar-choice active' : 'avatar-choice'}
                    onClick={() => onSettingsChange('avatarKey', preset.key)}
                  >
                    <Avatar avatarKey={preset.key} label={preset.key} />
                    <span>{preset.key}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="submit">Save settings</button>
          </form>
        </>
      ) : null}
    </section>
  )
}

function AuthScreen({
  authMode,
  createForm,
  demoUsers,
  loginPassword,
  loginUsername,
  onAuthModeChange,
  onCreateChange,
  onCreateSubmit,
  onLoginPasswordChange,
  onLoginChange,
  onLoginSubmit,
  onQuickLogin,
}) {
  return (
    <div className="auth-screen">
      <section className="auth-hero">
        <div className="hero-panel">
          <p className="hero-kicker">cortis</p>
          <h1 className="hero-code">
            <span className="code-ident">console</span>
            <span className="code-punct">.</span>
            <span className="code-call">log</span>
            <span className="code-punct">(</span>
            <span className="code-string">"finally, a chat app that gets it"</span>
            <span className="code-punct">)</span>
          </h1>
          <p className="hero-copy">
            Standard buttons, standard forms, normal scrolling. The visual language borrows from Vim splits,
            tabs, and status lines without hijacking the browser.
          </p>
          <ul className="hero-list">
            <li>Servers with channels, invites, unread ping badges, and owner-only posting permissions.</li>
            <li>Direct messages, friend requests by username, and capped group chats up to 10 members.</li>
            <li>Profile pages with Markdown bios and clickable member nameplates.</li>
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-tabs">
          <button
            type="button"
            className={authMode === 'signup' ? 'is-active' : ''}
            onClick={() => onAuthModeChange('signup')}
          >
            :signup
          </button>
          <button
            type="button"
            className={authMode === 'login' ? 'is-active' : ''}
            onClick={() => onAuthModeChange('login')}
          >
            :login
          </button>
        </div>

        {authMode === 'signup' ? (
          <form className="auth-form" onSubmit={onCreateSubmit}>
            <label>
              Display name
              <input
                value={createForm.displayName}
                onChange={(event) => onCreateChange('displayName', event.target.value)}
                placeholder="Pixel Lavender"
                required
              />
            </label>
            <label>
              Username
              <input
                value={createForm.username}
                onChange={(event) => onCreateChange('username', event.target.value.toLowerCase())}
                placeholder="pixel_lavender"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={createForm.password}
                onChange={(event) => onCreateChange('password', event.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </label>
            <fieldset className="avatar-picker">
              <legend>Profile picture</legend>
              <div className="avatar-grid">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.key}
                    className={createForm.avatarKey === preset.key ? 'avatar-choice active' : 'avatar-choice'}
                    onClick={() => onCreateChange('avatarKey', preset.key)}
                  >
                    <Avatar avatarKey={preset.key} label={preset.key} />
                    <span>{preset.key}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="submit">Create account</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={onLoginSubmit}>
            <label>
              Username
              <input
                value={loginUsername}
                onChange={(event) => onLoginChange(event.target.value.toLowerCase())}
                placeholder="neo"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => onLoginPasswordChange(event.target.value)}
                placeholder="Your password"
                required
              />
            </label>
            <button type="submit">Log in</button>
          </form>
        )}

        <div className="demo-users">
          <div className="section-heading">
            <h3>Demo users</h3>
            <span>Quick logins</span>
          </div>
          <div className="demo-user-list">
            {demoUsers.map((user) => (
              <button type="button" key={user.id} onClick={() => onQuickLogin(user.username)}>
                <Avatar avatarKey={user.avatarKey} label={user.displayName} />
                <span>
                  {user.displayName}
                  <strong>@{user.username}</strong>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(() => {
    const saved = window.localStorage.getItem(SESSION_KEY)
    return saved ? JSON.parse(saved) : null
  })
  const [snapshot, setSnapshot] = useState(null)
  const [demoUsers, setDemoUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [connectionLabel, setConnectionLabel] = useState('offline')
  const [notice, setNotice] = useState('Ready.')
  const [authMode, setAuthMode] = useState('signup')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [createForm, setCreateForm] = useState({
    displayName: '',
    username: '',
    password: '',
    avatarKey: AVATAR_PRESETS[0].key,
  })
  const [selection, setSelection] = useState(EMPTY_SELECTION)
  const [friendUsername, setFriendUsername] = useState('')
  const [serverForm, setServerForm] = useState({ name: '', avatarKey: AVATAR_PRESETS[1].key })
  const [channelName, setChannelName] = useState('')
  const [groupForm, setGroupForm] = useState({
    name: '',
    avatarKey: AVATAR_PRESETS[2].key,
    memberIds: [],
  })
  const [inviteFriendId, setInviteFriendId] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const [bioDraft, setBioDraft] = useState('')
  const [settingsDraft, setSettingsDraft] = useState({
    displayName: '',
    username: '',
    password: '',
    avatarKey: AVATAR_PRESETS[0].key,
  })
  const socketRef = useRef(null)
  const noticeTimeoutRef = useRef(null)

  function setFlash(message) {
    window.clearTimeout(noticeTimeoutRef.current)
    setNotice(message)
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice('Ready.')
    }, 2600)
  }

  function applyBootstrap(nextBootstrap) {
    if (!nextBootstrap) {
      setSnapshot(null)
      return
    }

    startTransition(() => {
      setSnapshot(nextBootstrap)
    })
    const currentUser = nextBootstrap.user ?? {}
    setBioDraft(currentUser.bio ?? '')
    setSettingsDraft((current) => ({
      ...current,
      displayName: currentUser.displayName ?? '',
      username: currentUser.username ?? '',
      avatarKey: currentUser.avatarKey ?? AVATAR_PRESETS[0].key,
      password: '',
    }))
    setSelection((current) => normalizeSelection(current, nextBootstrap))
  }

  function applySession(nextSession, nextBootstrap) {
    if (nextSession) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession))
    } else {
      window.localStorage.removeItem(SESSION_KEY)
      setConnectionLabel('offline')
    }

    setSession(nextSession)
    if (nextBootstrap) {
      applyBootstrap(nextBootstrap)
    } else if (!nextSession) {
      setSnapshot(null)
    }
  }

  async function refreshBootstrap(activeSession = session) {
    if (!activeSession?.userId) {
      return
    }

    try {
      const data = await apiRequest(`/api/bootstrap?userId=${activeSession.userId}`)
      applyBootstrap(data.bootstrap)
    } catch (error) {
      applySession(null, null)
      setFlash(error.message)
    }
  }

  useEffect(() => {
    let mounted = true

    async function loadPublicUsers() {
      try {
        const data = await apiRequest('/api/public/users')
        if (mounted) {
          setDemoUsers(data.users)
        }
      } catch (error) {
        if (mounted) {
          setFlash(error.message)
        }
      }
    }

    loadPublicUsers()

    return () => {
      mounted = false
      window.clearTimeout(noticeTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (session?.userId) {
      Promise.resolve().then(() => refreshBootstrap(session))
    }
  }, [session])

  useEffect(() => {
    if (!session?.userId) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnectionLabel('online')
      socket.emit('authenticate', { userId: session.userId })
    })

    socket.on('disconnect', () => {
      setConnectionLabel('offline')
    })

    socket.on('state_changed', () => {
      refreshBootstrap(session)
    })

    socket.on('action_error', (payload) => {
      setFlash(payload.message ?? 'Socket action failed.')
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [session])

  const currentServer = snapshot?.servers.find((server) => server.id === selection.serverId) ?? null
  const currentChannel = currentServer?.channels.find((channel) => channel.id === selection.channelId) ?? null
  const currentDm = snapshot?.dms.find((dm) => dm.id === selection.dmId) ?? null
  const currentGroup = snapshot?.groups.find((group) => group.id === selection.groupId) ?? null
  const knownProfiles = snapshot
    ? [
        snapshot.user,
        ...snapshot.friends,
        ...snapshot.servers.flatMap((server) => server.members),
        ...snapshot.groups.flatMap((group) => group.members),
      ]
    : []
  const viewedProfile = knownProfiles.find((person) => person.username === selection.profileUsername) ?? snapshot?.user
  const currentRoom =
    selection.section === 'servers'
      ? currentChannel
      : selection.section === 'messages' && selection.messageMode === 'dms'
        ? currentDm
        : selection.section === 'messages' && selection.messageMode === 'groups'
          ? currentGroup
          : null

  useEffect(() => {
    if (!session?.userId || !currentRoom?.id) {
      return
    }

    apiRequest('/api/read', {
      method: 'POST',
      body: JSON.stringify({ userId: session.userId, roomId: currentRoom.id }),
    }).catch(() => {})
  }, [currentRoom?.id, session?.userId])

  async function submitAction(path, method, body, successMessage) {
    setLoading(true)

    try {
      const data = await apiRequest(path, {
        method,
        body: JSON.stringify(body),
      })

      if (data.session) {
        applySession(data.session, data.bootstrap)
      } else if (data.bootstrap) {
        applyBootstrap(data.bootstrap)
      }

      setFlash(successMessage)
      return data
    } catch (error) {
      setFlash(error.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateAccount(event) {
    event.preventDefault()
    const data = await submitAction('/api/auth/signup', 'POST', createForm, 'Account created.')
    if (data?.session) {
      setSelection(EMPTY_SELECTION)
      setAuthMode('login')
      setLoginUsername(createForm.username)
      setLoginPassword('')
      setCreateForm((current) => ({ ...current, password: '' }))
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    const data = await submitAction(
      '/api/auth/login',
      'POST',
      { username: loginUsername, password: loginPassword },
      'Logged in.',
    )
    if (data?.session) {
      setSelection(EMPTY_SELECTION)
      setLoginPassword('')
    }
  }

  async function handleQuickLogin(username) {
    setAuthMode('login')
    setLoginUsername(username)
    setLoginPassword('')
    setFlash(`Username @${username} filled. Enter password to log in.`)
  }

  async function handleSendFriendRequest(event) {
    event.preventDefault()
    const data = await submitAction(
      '/api/friends/request',
      'POST',
      { userId: session.userId, username: friendUsername },
      `Friend request sent to @${friendUsername}.`,
    )

    if (data) {
      setFriendUsername('')
    }
  }

  async function handleFriendResponse(fromUserId, action) {
    const data = await submitAction(
      '/api/friends/respond',
      'POST',
      { userId: session.userId, fromUserId, action },
      action === 'accept' ? 'Friend request accepted.' : 'Friend request declined.',
    )

    if (data?.bootstrap?.dms[0] && selection.dmId === '') {
      setSelection((current) => ({
        ...current,
        section: 'messages',
        messageMode: 'dms',
        dmId: data.bootstrap.dms[0].id,
      }))
    }
  }

  async function handleInviteResponse(serverId, action) {
    await submitAction(
      '/api/invites/respond',
      'POST',
      { userId: session.userId, serverId, action },
      action === 'accept' ? 'Server invite accepted.' : 'Server invite declined.',
    )
  }

  async function handleCreateServer(event) {
    event.preventDefault()
    const data = await submitAction(
      '/api/servers',
      'POST',
      { userId: session.userId, ...serverForm },
      'Server created.',
    )

    if (data?.serverId) {
      setSelection((current) => ({ ...current, section: 'servers', serverId: data.serverId }))
      setServerForm({ name: '', avatarKey: AVATAR_PRESETS[1].key })
    }
  }

  async function handleCreateChannel(event) {
    event.preventDefault()
    const data = await submitAction(
      `/api/servers/${selection.serverId}/channels`,
      'POST',
      { userId: session.userId, name: channelName },
      'Channel created.',
    )

    if (data?.channelId) {
      setSelection((current) => ({ ...current, channelId: data.channelId }))
      setChannelName('')
    }
  }

  async function handleToggleOwnerOnly(channelId, ownerOnly) {
    await submitAction(
      `/api/servers/${selection.serverId}/channels/${channelId}`,
      'PATCH',
      { userId: session.userId, ownerOnly },
      ownerOnly ? 'Channel locked to owner.' : 'Channel opened to members.',
    )
  }

  async function handleInviteFriend() {
    if (!inviteFriendId) {
      setFlash('Pick a friend to invite first.')
      return
    }

    await submitAction(
      `/api/servers/${selection.serverId}/invite`,
      'POST',
      { userId: session.userId, friendId: inviteFriendId },
      'Server invite sent.',
    )
  }

  async function handleCreateGroup(event) {
    event.preventDefault()
    const data = await submitAction(
      '/api/groups',
      'POST',
      { userId: session.userId, ...groupForm },
      'Group chat created.',
    )

    if (data?.groupId) {
      setSelection((current) => ({
        ...current,
        section: 'messages',
        messageMode: 'groups',
        groupId: data.groupId,
      }))
      setGroupForm({ name: '', avatarKey: AVATAR_PRESETS[2].key, memberIds: [] })
    }
  }

  async function handleSaveBio(event) {
    event.preventDefault()
    await submitAction('/api/users/bio', 'POST', { userId: session.userId, bio: bioDraft }, 'Profile updated.')
  }

  async function handleSaveSettings(event) {
    event.preventDefault()
    const data = await submitAction(
      '/api/users/settings',
      'POST',
      {
        userId: session.userId,
        displayName: settingsDraft.displayName,
        username: settingsDraft.username,
        password: settingsDraft.password,
        avatarKey: settingsDraft.avatarKey,
      },
      'Settings saved.',
    )

    if (data?.session) {
      setLoginUsername(data.session.username)
      setLoginPassword('')
      setSettingsDraft((current) => ({ ...current, password: '' }))
    }
  }

  function handleSendMessage(event) {
    event.preventDefault()
    const content = draftMessage.trim()
    if (!content || !currentRoom) {
      return
    }

    socketRef.current?.emit('send_message', {
      userId: session.userId,
      roomId: currentRoom.id,
      content,
    })
    setDraftMessage('')
  }

  function handleLogout() {
    applySession(null, null)
    setSelection(EMPTY_SELECTION)
    setLoginUsername('')
    setLoginPassword('')
    setFlash('Logged out.')
  }

  function openProfile(profile) {
    setSelection((current) => ({
      ...current,
      section: 'profile',
      profileUsername: profile.username,
    }))
  }

  function openDm(dmId) {
    setSelection((current) => ({
      ...current,
      section: 'messages',
      messageMode: 'dms',
      dmId,
    }))
  }

  function openGroup(groupId) {
    setSelection((current) => ({
      ...current,
      section: 'messages',
      messageMode: 'groups',
      groupId,
    }))
  }

  if (!session || !snapshot) {
    return (
      <AuthScreen
        authMode={authMode}
        createForm={createForm}
        demoUsers={demoUsers}
        loginPassword={loginPassword}
        loginUsername={loginUsername}
        onAuthModeChange={setAuthMode}
        onCreateChange={(field, value) => setCreateForm((current) => ({ ...current, [field]: value }))}
        onCreateSubmit={handleCreateAccount}
        onLoginPasswordChange={setLoginPassword}
        onLoginChange={setLoginUsername}
        onLoginSubmit={handleLogin}
        onQuickLogin={handleQuickLogin}
      />
    )
  }

  const serverTabBadge = snapshot.servers.reduce((total, server) => total + countServerPings(server), 0)
  const messageTabBadge = sumUnread(snapshot.dms) + sumUnread(snapshot.groups)
  const friendTabBadge = snapshot.pendingFriendRequests.length + snapshot.serverInvites.length
  const currentMembers =
    selection.section === 'servers'
      ? currentServer?.members ?? []
      : selection.section === 'messages' && selection.messageMode === 'groups'
        ? currentGroup?.members ?? []
        : selection.section === 'messages' && selection.messageMode === 'dms' && currentDm
          ? [snapshot.user, currentDm.member]
          : []

  return (
    <div className="shell-root">
      <header className="tabline">
        {[
          { key: 'servers', label: 'SERVERS', badge: serverTabBadge },
          { key: 'messages', label: 'MESSAGES', badge: messageTabBadge },
          { key: 'friends', label: 'FRIENDS', badge: friendTabBadge },
          { key: 'profile', label: 'PROFILE', badge: 0 },
        ].map((item) => (
          <button
            type="button"
            key={item.key}
            className={selection.section === item.key ? 'tab active' : 'tab'}
            onClick={() =>
              setSelection((current) => ({
                ...current,
                section: item.key,
                profileUsername: item.key === 'profile' ? snapshot.user.username : current.profileUsername,
              }))
            }
          >
            <span>{item.label}</span>
            {item.badge ? <strong>{item.badge}</strong> : null}
          </button>
        ))}
        <div className="tabline-meta">mouse friendly | no Vim keybinds</div>
      </header>

      <div className="workspace-grid">
        <aside className="server-rail">
          <button
            type="button"
            className="brand-tile"
            onClick={() => setSelection((current) => ({ ...current, section: 'servers' }))}
          >
            cv
          </button>
          {snapshot.servers.map((server) => {
            const badge = countServerPings(server)
            return (
              <button
                type="button"
                key={server.id}
                className={selection.serverId === server.id && selection.section === 'servers' ? 'rail-item active' : 'rail-item'}
                onClick={() =>
                  setSelection((current) => ({
                    ...current,
                    section: 'servers',
                    serverId: server.id,
                    channelId: server.channels[0]?.id ?? '',
                  }))
                }
              >
                <Avatar avatarKey={server.avatarKey} label={server.name} />
                {badge ? <span className="ping-dot">{badge}</span> : null}
              </button>
            )
          })}
          <form className="rail-create" onSubmit={handleCreateServer}>
            <input
              value={serverForm.name}
              onChange={(event) => setServerForm((current) => ({ ...current, name: event.target.value }))}
              placeholder=":new-server"
              required
            />
            <div className="mini-avatar-grid">
              {AVATAR_PRESETS.slice(0, 4).map((preset) => (
                <button
                  type="button"
                  key={preset.key}
                  className={serverForm.avatarKey === preset.key ? 'mini-avatar active' : 'mini-avatar'}
                  onClick={() => setServerForm((current) => ({ ...current, avatarKey: preset.key }))}
                >
                  <Avatar avatarKey={preset.key} label={preset.key} size="sm" />
                </button>
              ))}
            </div>
            <button type="submit">Create</button>
          </form>
        </aside>

        <aside className="sidebar-pane">
          {selection.section === 'servers' ? (
            <>
              <div className="pane-header">
                <h2>{currentServer?.name ?? 'No servers yet'}</h2>
                <p>{currentServer ? `${currentServer.members.length} members` : 'Create a server to begin.'}</p>
              </div>

              <div className="channel-list">
                {currentServer?.channels.map((channel) => (
                  <div key={channel.id} className={selection.channelId === channel.id ? 'channel-row active' : 'channel-row'}>
                    <button
                      type="button"
                      className="channel-button"
                      onClick={() => setSelection((current) => ({ ...current, section: 'servers', channelId: channel.id }))}
                    >
                      <span>#{channel.name}</span>
                      {channel.ping ? <strong className="red-badge">!</strong> : null}
                    </button>
                    {currentServer?.ownerId === snapshot.user.id ? (
                      <label className="owner-toggle">
                        <input
                          type="checkbox"
                          checked={channel.ownerOnly}
                          onChange={(event) => handleToggleOwnerOnly(channel.id, event.target.checked)}
                        />
                        owner-only
                      </label>
                    ) : null}
                  </div>
                ))}
              </div>

              {currentServer?.ownerId === snapshot.user.id ? (
                <form className="stack-form" onSubmit={handleCreateChannel}>
                  <div className="section-heading">
                    <h3>New channel</h3>
                    <span>Owner controls permissions</span>
                  </div>
                  <input
                    value={channelName}
                    onChange={(event) => setChannelName(event.target.value)}
                    placeholder="patch-notes"
                    required
                  />
                  <button type="submit">Add channel</button>
                </form>
              ) : null}

              <div className="stack-form">
                <div className="section-heading">
                  <h3>Invite a friend</h3>
                  <span>Only friends can be invited</span>
                </div>
                <select value={inviteFriendId} onChange={(event) => setInviteFriendId(event.target.value)}>
                  <option value="">Select a friend</option>
                  {snapshot.friends
                    .filter((friend) => !currentServer?.members.some((member) => member.id === friend.id))
                    .map((friend) => (
                      <option key={friend.id} value={friend.id}>
                        @{friend.username}
                      </option>
                    ))}
                </select>
                <button type="button" onClick={handleInviteFriend}>
                  Send invite
                </button>
              </div>
            </>
          ) : null}

          {selection.section === 'messages' ? (
            <>
              <div className="pane-header">
                <h2>Message Buffers</h2>
                <div className="subtabs">
                  <button
                    type="button"
                    className={selection.messageMode === 'dms' ? 'is-active' : ''}
                    onClick={() => setSelection((current) => ({ ...current, messageMode: 'dms' }))}
                  >
                    DMs
                  </button>
                  <button
                    type="button"
                    className={selection.messageMode === 'groups' ? 'is-active' : ''}
                    onClick={() => setSelection((current) => ({ ...current, messageMode: 'groups' }))}
                  >
                    Groups
                  </button>
                </div>
              </div>

              {selection.messageMode === 'dms' ? (
                <div className="channel-list">
                  {snapshot.dms.map((dm) => (
                    <button
                      type="button"
                      key={dm.id}
                      className={selection.dmId === dm.id ? 'list-card active' : 'list-card'}
                      onClick={() => openDm(dm.id)}
                    >
                      <Avatar avatarKey={dm.member.avatarKey} label={dm.member.displayName} />
                      <span>
                        {dm.member.displayName}
                        <strong>@{dm.member.username}</strong>
                      </span>
                      {dm.unread ? <strong className="count-pill">{dm.unread}</strong> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="channel-list">
                  {snapshot.groups.map((group) => (
                    <button
                      type="button"
                      key={group.id}
                      className={selection.groupId === group.id ? 'list-card active' : 'list-card'}
                      onClick={() => openGroup(group.id)}
                    >
                      <Avatar avatarKey={group.avatarKey} label={group.name} />
                      <span>
                        {group.name}
                        <strong>{group.members.length}/10 members</strong>
                      </span>
                      {group.ping ? <strong className="red-badge">!</strong> : null}
                    </button>
                  ))}
                </div>
              )}

              <form className="stack-form" onSubmit={handleCreateGroup}>
                <div className="section-heading">
                  <h3>New group chat</h3>
                  <span>Up to 10 members total</span>
                </div>
                <input
                  value={groupForm.name}
                  onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Sprint room"
                  required
                />
                <div className="mini-avatar-grid">
                  {AVATAR_PRESETS.slice(2).map((preset) => (
                    <button
                      type="button"
                      key={preset.key}
                      className={groupForm.avatarKey === preset.key ? 'mini-avatar active' : 'mini-avatar'}
                      onClick={() => setGroupForm((current) => ({ ...current, avatarKey: preset.key }))}
                    >
                      <Avatar avatarKey={preset.key} label={preset.key} size="sm" />
                    </button>
                  ))}
                </div>
                <div className="friend-chip-grid">
                  {snapshot.friends.map((friend) => {
                    const checked = groupForm.memberIds.includes(friend.id)
                    return (
                      <label key={friend.id} className={checked ? 'friend-chip active' : 'friend-chip'}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextIds = event.target.checked
                              ? [...groupForm.memberIds, friend.id]
                              : groupForm.memberIds.filter((item) => item !== friend.id)
                            setGroupForm((current) => ({ ...current, memberIds: nextIds }))
                          }}
                        />
                        @{friend.username}
                      </label>
                    )
                  })}
                </div>
                <button type="submit">Create group</button>
              </form>
            </>
          ) : null}

          {selection.section === 'friends' ? (
            <>
              <div className="pane-header">
                <h2>Friend Requests</h2>
                <p>Search by username, not display name.</p>
              </div>

              <form className="stack-form" onSubmit={handleSendFriendRequest}>
                <div className="section-heading">
                  <h3>Add friend</h3>
                  <span>Use exact usernames</span>
                </div>
                <input
                  value={friendUsername}
                  onChange={(event) => setFriendUsername(event.target.value.toLowerCase())}
                  placeholder="gwen"
                  required
                />
                <button type="submit">Send request</button>
              </form>

              <div className="request-panel">
                <div className="section-heading">
                  <h3>Incoming</h3>
                  <span>{snapshot.pendingFriendRequests.length}</span>
                </div>
                {snapshot.pendingFriendRequests.map((request) => (
                  <div key={request.id} className="request-row">
                    <button type="button" className="profile-link" onClick={() => openProfile(request)}>
                      <Avatar avatarKey={request.avatarKey} label={request.displayName} />
                      <span>@{request.username}</span>
                    </button>
                    <div className="row-actions">
                      <button type="button" onClick={() => handleFriendResponse(request.id, 'accept')}>
                        Accept
                      </button>
                      <button type="button" className="ghost" onClick={() => handleFriendResponse(request.id, 'decline')}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
                {!snapshot.pendingFriendRequests.length ? <VimFiller lines={5} /> : null}
              </div>

              <div className="request-panel">
                <div className="section-heading">
                  <h3>Server invites</h3>
                  <span>{snapshot.serverInvites.length}</span>
                </div>
                {snapshot.serverInvites.map((invite) => (
                  <div key={`${invite.serverId}-${invite.invitedBy.id}`} className="request-row">
                    <div>
                      <strong>{invite.serverName}</strong>
                      <p>from @{invite.invitedBy.username}</p>
                    </div>
                    <div className="row-actions">
                      <button type="button" onClick={() => handleInviteResponse(invite.serverId, 'accept')}>
                        Join
                      </button>
                      <button type="button" className="ghost" onClick={() => handleInviteResponse(invite.serverId, 'decline')}>
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
                {!snapshot.serverInvites.length ? <VimFiller lines={4} /> : null}
              </div>

              <div className="request-panel compact-list">
                <div className="section-heading">
                  <h3>Friends</h3>
                  <span>{snapshot.friends.length}</span>
                </div>
                {snapshot.friends.map((friend) => {
                  const dm = snapshot.dms.find((item) => item.member.id === friend.id)
                  return (
                    <div key={friend.id} className="request-row">
                      <button type="button" className="profile-link" onClick={() => openProfile(friend)}>
                        <Avatar avatarKey={friend.avatarKey} label={friend.displayName} />
                        <span>@{friend.username}</span>
                      </button>
                      <div className="row-actions">{dm ? <button type="button" onClick={() => openDm(dm.id)}>DM</button> : null}</div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : null}

          {selection.section === 'profile' ? (
            <div className="sidebar-profile-list">
              <div className="pane-header">
                <h2>Profiles</h2>
                <p>Click a member nameplate to inspect Markdown bios.</p>
              </div>
              {[snapshot.user, ...snapshot.friends]
                .filter((person, index, list) => list.findIndex((item) => item.id === person.id) === index)
                .map((person) => (
                  <button
                    type="button"
                    key={person.id}
                    className={selection.profileUsername === person.username ? 'list-card active' : 'list-card'}
                    onClick={() => openProfile(person)}
                  >
                    <Avatar avatarKey={person.avatarKey} label={person.displayName} />
                    <span>
                      {person.displayName}
                      <strong>@{person.username}</strong>
                    </span>
                  </button>
                ))}
            </div>
          ) : null}
        </aside>

        <main className="main-pane">
          {(selection.section === 'servers' || selection.section === 'messages') && currentRoom ? (
            <>
              <div className="main-header">
                <div>
                  <h2>
                    {selection.section === 'servers' ? `#${currentChannel?.name}` : currentRoom.name ?? currentDm?.member.displayName}
                  </h2>
                  <p>
                    {selection.section === 'servers'
                      ? currentChannel?.ownerOnly
                        ? 'Only the server owner can send here.'
                        : 'Standard channel posting permissions.'
                      : selection.messageMode === 'groups'
                        ? `${currentGroup?.members.length ?? 0}/10 members`
                        : `Direct messages with @${currentDm?.member.username}`}
                  </p>
                </div>
                <div className="header-chips">
                  {selection.section === 'servers' ? <span>{currentServer?.name}</span> : null}
                  {currentRoom.ping ? <span className="alert-chip">@everyone</span> : null}
                </div>
              </div>

              <div className="message-log">
                {currentRoom.messages.map((message, index) => (
                  <article key={message.id} className="message-row">
                    <div className="message-index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="message-body">
                      <button type="button" className="message-author" onClick={() => openProfile(message.author)}>
                        <Avatar avatarKey={message.author.avatarKey} label={message.author.displayName} size="sm" />
                        <span>
                          {message.author.displayName}
                          <strong>@{message.author.username}</strong>
                        </span>
                      </button>
                      <p>{message.content}</p>
                    </div>
                    <time className="message-time">{formatTime(message.createdAt)}</time>
                  </article>
                ))}
                {!currentRoom.messages.length ? <VimFiller lines={12} /> : null}
              </div>

              <form className="composer" onSubmit={handleSendMessage}>
                <textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder={
                    currentRoom.canSend === false
                      ? 'This channel is read-only for members.'
                      : 'Type a message. Use @everyone to trigger a red ping badge.'
                  }
                  disabled={currentRoom.canSend === false}
                />
                <button type="submit" disabled={currentRoom.canSend === false}>
                  Send
                </button>
              </form>
            </>
          ) : null}

          {selection.section === 'friends' ? (
            <section className="friends-main">
              <div className="main-header">
                <div>
                  <h2>Username-based networking</h2>
                  <p>Friend requests only resolve against usernames, not display names.</p>
                </div>
              </div>
              <div className="insight-grid">
                <article>
                  <strong>Outgoing requests</strong>
                  <div className="tag-list">
                    {snapshot.outgoingFriendRequests.map((user) => (
                      <span key={user.id}>@{user.username}</span>
                    ))}
                    {!snapshot.outgoingFriendRequests.length ? <span>No pending requests.</span> : null}
                  </div>
                </article>
                <article>
                  <strong>DM ready friends</strong>
                  <div className="tag-list">
                    {snapshot.friends.map((user) => {
                      const dm = snapshot.dms.find((item) => item.member.id === user.id)
                      return dm ? (
                        <button type="button" key={user.id} onClick={() => openDm(dm.id)}>
                          @{user.username}
                        </button>
                      ) : null
                    })}
                    {!snapshot.friends.length ? <span>Add someone first.</span> : null}
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {selection.section === 'profile' ? (
            <ProfileCard
              profile={viewedProfile ?? snapshot.user}
              isSelf={(viewedProfile ?? snapshot.user).id === snapshot.user.id}
              bioDraft={bioDraft}
              onBioDraftChange={setBioDraft}
              onBioSave={handleSaveBio}
              settingsDraft={settingsDraft}
              onSettingsChange={(field, value) => setSettingsDraft((current) => ({ ...current, [field]: value }))}
              onSettingsSave={handleSaveSettings}
            />
          ) : null}
        </main>

        <aside className="member-pane">
          <div className="pane-header">
            <h2>Members</h2>
            <p>Nameplates open profile pages.</p>
          </div>
          <div className="member-list">
            {currentMembers.map((member) => (
              <button type="button" key={member.id} className="member-card" onClick={() => openProfile(member)}>
                <Avatar avatarKey={member.avatarKey} label={member.displayName} />
                <span>
                  {member.displayName}
                  <strong>@{member.username}</strong>
                </span>
              </button>
            ))}
            {!currentMembers.length ? <VimFiller lines={7} /> : null}
          </div>
        </aside>
      </div>

      <footer className="statusline">
        <span>{loading ? '-- BUSY --' : '-- NORMAL WEB NAV --'}</span>
        <span>{notice}</span>
        <span>{connectionLabel}</span>
        <button type="button" className="logout-button" onClick={handleLogout}>
          logout
        </button>
      </footer>
    </div>
  )
}

export default App