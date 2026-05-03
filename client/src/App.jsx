// hello world
// test
import { startTransition, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL
const SESSION_KEY = 'cortis.session'
const APPEARANCE_KEY = 'cortis.appearance'
const DEMO_PASSWORD = 'demo123'
const DARK_THEME = {
  bg: '#0f1117',
  bgPanel: '#1a1f2b',
  bgSoft: '#202735',
  bgCode: '#131925',
  line: 'rgba(10, 14, 21, 0.1)',
  lineStrong: 'rgba(127, 178, 255, 0.36)',
  surfaceRail: '#1a1f2b',
  surfaceSidebar: '#1d2330',
  surfaceMain: '#202735',
  surfaceMember: '#1b2230',
  surfaceTop: '#181d29',
  separator: 'rgba(197, 214, 241, 0.08)',
  text: '#d6deef',
  muted: '#8d9ab4',
  heading: '#f2f6ff',
  accent: '#7fb2ff',
  accentSoft: 'rgba(127, 178, 255, 0.18)',
  danger: '#ff6b6b',
  dangerSoft: '#442326',
}

const LIGHT_THEME = {
  bg: '#f2f5fc',
  bgPanel: '#f8faff',
  bgSoft: '#eef2fa',
  bgCode: '#e7edf8',
  line: 'rgba(42, 66, 110, 0.18)',
  lineStrong: 'rgba(75, 114, 217, 0.48)',
  surfaceRail: '#f8faff',
  surfaceSidebar: '#f2f6ff',
  surfaceMain: '#eef3ff',
  surfaceMember: '#f4f7ff',
  surfaceTop: '#f8faff',
  separator: 'rgba(42, 66, 110, 0.12)',
  text: '#1f293f',
  muted: '#5f6e87',
  heading: '#111a2c',
  accent: '#4b72d9',
  accentSoft: 'rgba(75, 114, 217, 0.14)',
  danger: '#d94848',
  dangerSoft: '#f9dede',
}

const DEFAULT_APPEARANCE = {
  mode: 'dark',
  background: DARK_THEME.bg,
  accent: DARK_THEME.accent,
}

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

function Avatar({ avatarKey, label, size = 'md', imageUrl }) {
  const preset = avatarKey ? presetForAvatar(avatarKey) : AVATAR_PRESETS[label?.charCodeAt(0) % AVATAR_PRESETS.length || 0]
  const glyph = avatarKey ? preset.glyph : (label?.trim()?.slice(0, 1) || '?').toUpperCase()

  return (
    <div className={`avatar avatar-${size} tone-${preset.tone}`} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" className="avatar-image" /> : <span>{glyph}</span>}
    </div>
  )
}



async function apiRequest(path, options = {}) {
  const method = options.method ?? 'GET'
  let response

  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      ...options,
    })
  } catch (_error) {
    throw new Error(`${method} ${path} failed: Network error. Is API running at ${API_URL}?`)
  }

  const data = await response.json().catch(() => ({ message: 'Unexpected server response.' }))

  if (!response.ok) {
    const code = data.code ? ` ${data.code}` : ''
    const message = data.message ?? 'Request failed.'
    console.error('API request failed', {
      method,
      path,
      status: response.status,
      code: data.code ?? null,
      message,
      payload: data,
    })
    throw new Error(`${method} ${path} failed (${response.status}${code}): ${message}`)
  }

  return data
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
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

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
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
  onSettingsAvatarUpload,
}) {
  return (
    <section className="profile-card">
      <div className="profile-hero">
        <Avatar label={profile.displayName} imageUrl={profile.avatarImage} size="xl" />
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
            <label>
              Profile picture
              <input type="file" accept="image/*" onChange={onSettingsAvatarUpload} />
            </label>
            <Avatar label={settingsDraft.displayName || settingsDraft.username} imageUrl={settingsDraft.avatarImage} />
            <button type="submit">Save settings</button>
          </form>
        </>
      ) : null}
    </section>
  )
}

function AuthScreen({
  authError,
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
            Say hello to Cortis, a chat client built for developers, by developers. But what sets Cortis apart?
          </p>
          <ul className="hero-list">
            <li>Built in Github bot so that you can know the second someone pushes code.</li>
            <li>CD status notifications (your pipeline says thanks)</li>
            <li>Github style contributions tracking</li>
            <li>Communication structure designed to streamline developer collaboration</li>
          </ul>
          <span style={{
            display: 'block',
            textAlign: 'right',
            fontSize: '0.75rem',
            color: 'var(--muted, #8d9ab4)',
            opacity: 0.55,
            marginTop: '1.5rem',
            userSelect: 'none',
            pointerEvents: 'none',
          }}>
            Logo by Mr_Dragon0011
          </span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-tabs">
          <button
            type="button"
            className={authMode === 'signup' ? 'is-active' : ''}
            onClick={() => onAuthModeChange('signup')}
          >
            Sign Up
          </button>
          <button
            type="button"
            className={authMode === 'login' ? 'is-active' : ''}
            onClick={() => onAuthModeChange('login')}
          >
            Log In
          </button>
        </div>

        {authMode === 'signup' ? (
          <form className="auth-form" onSubmit={onCreateSubmit}>
            <label>
              Display name
              <input
                value={createForm.displayName}
                onChange={(event) => onCreateChange('displayName', event.target.value)}
                placeholder="Buy BTF"
                required
              />
            </label>
            <label>
              Username
              <input
                value={createForm.username}
                onChange={(event) => onCreateChange('username', event.target.value.toLowerCase())}
                placeholder="buy_btf"
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
            <button type="submit">Create account</button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={onLoginSubmit}>
            <label>
              Username
              <input
                value={loginUsername}
                onChange={(event) => onLoginChange(event.target.value.toLowerCase())}
                placeholder="buy_btf"
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

        {authError ? <p className="auth-error">{authError}</p> : null}

      </section>
    </div>
  )
}

function App() {
  const [authError, setAuthError] = useState('')
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
  })
  const [selection, setSelection] = useState(EMPTY_SELECTION)
  const [friendUsername, setFriendUsername] = useState('')
  const [serverForm, setServerForm] = useState({ name: '', avatarKey: AVATAR_PRESETS[1].key })
  const [isServerCreateOpen, setIsServerCreateOpen] = useState(false)
  const [isServerOptionsOpen, setIsServerOptionsOpen] = useState(false)
  const [isChannelCreateOpen, setIsChannelCreateOpen] = useState(false)
  const [isInviteFriendOpen, setIsInviteFriendOpen] = useState(false)
  const [isGroupCreateOpen, setIsGroupCreateOpen] = useState(false)
  const [isMessagesMenuOpen, setIsMessagesMenuOpen] = useState(false)
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('profile')
  const [channelName, setChannelName] = useState('')
  const [groupForm, setGroupForm] = useState({
    name: '',
    avatarKey: AVATAR_PRESETS[2].key,
    memberIds: [],
    avatarImage: '',
  })
  const [inviteFriendId, setInviteFriendId] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const [bioDraft, setBioDraft] = useState('')
  const [settingsDraft, setSettingsDraft] = useState({
    displayName: '',
    username: '',
    password: '',
    avatarImage: '',
  })
  const [appearanceSaved, setAppearanceSaved] = useState(() => {
    const saved = window.localStorage.getItem(APPEARANCE_KEY)
    if (!saved) {
      return DEFAULT_APPEARANCE
    }

    try {
      return { ...DEFAULT_APPEARANCE, ...JSON.parse(saved) }
    } catch (_error) {
      return DEFAULT_APPEARANCE
    }
  })
  const [appearanceDraft, setAppearanceDraft] = useState(() => {
    const saved = window.localStorage.getItem(APPEARANCE_KEY)
    if (!saved) {
      return DEFAULT_APPEARANCE
    }

    try {
      return { ...DEFAULT_APPEARANCE, ...JSON.parse(saved) }
    } catch (_error) {
      return DEFAULT_APPEARANCE
    }
  })
  const socketRef = useRef(null)
  const noticeTimeoutRef = useRef(null)
  const messagesMenuRef = useRef(null)
  const [prefersDarkTheme, setPrefersDarkTheme] = useState(() => systemPrefersDark())

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
      password: '',
      avatarImage: currentUser.avatarImage ?? '',
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

  useEffect(() => {
    function handlePointerDown(event) {
      if (!isMessagesMenuOpen) {
        return
      }

      if (!messagesMenuRef.current?.contains(event.target)) {
        setIsMessagesMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isMessagesMenuOpen])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = (event) => setPrefersDarkTheme(event.matches)

    media.addEventListener('change', updateTheme)

    return () => {
      media.removeEventListener('change', updateTheme)
    }
  }, [])

  useEffect(() => {
    const baseTheme =
      appearanceDraft.mode === 'light'
        ? LIGHT_THEME
        : appearanceDraft.mode === 'system'
          ? prefersDarkTheme
            ? DARK_THEME
            : LIGHT_THEME
          : DARK_THEME

    const resolvedTheme = {
      ...baseTheme,
      background: appearanceDraft.mode === 'system' ? baseTheme.bg : appearanceDraft.background,
      accent: appearanceDraft.mode === 'system' ? baseTheme.accent : appearanceDraft.accent,
    }

    document.documentElement.style.setProperty('--bg', resolvedTheme.background)
    document.documentElement.style.setProperty('--bg-panel', resolvedTheme.bgPanel)
    document.documentElement.style.setProperty('--bg-soft', resolvedTheme.bgSoft)
    document.documentElement.style.setProperty('--bg-code', resolvedTheme.bgCode)
    document.documentElement.style.setProperty('--line', resolvedTheme.line)
    document.documentElement.style.setProperty('--line-strong', resolvedTheme.lineStrong)
    document.documentElement.style.setProperty('--surface-rail', resolvedTheme.surfaceRail)
    document.documentElement.style.setProperty('--surface-sidebar', resolvedTheme.surfaceSidebar)
    document.documentElement.style.setProperty('--surface-main', resolvedTheme.surfaceMain)
    document.documentElement.style.setProperty('--surface-member', resolvedTheme.surfaceMember)
    document.documentElement.style.setProperty('--surface-top', resolvedTheme.surfaceTop)
    document.documentElement.style.setProperty('--separator', resolvedTheme.separator)
    document.documentElement.style.setProperty('--text', resolvedTheme.text)
    document.documentElement.style.setProperty('--muted', resolvedTheme.muted)
    document.documentElement.style.setProperty('--heading', resolvedTheme.heading)
    document.documentElement.style.setProperty('--accent', resolvedTheme.accent)
    document.documentElement.style.setProperty('--accent-soft', resolvedTheme.accentSoft)
    document.documentElement.style.setProperty('--danger', resolvedTheme.danger)
    document.documentElement.style.setProperty('--danger-soft', resolvedTheme.dangerSoft)
  }, [appearanceDraft, prefersDarkTheme])

  const currentServer = snapshot?.servers.find((server) => server.id === selection.serverId) ?? null
  const currentChannel = currentServer?.channels.find((channel) => channel.id === selection.channelId) ?? null
  const currentDm = snapshot?.dms.find((dm) => dm.id === selection.dmId) ?? null
  const currentGroup = snapshot?.groups.find((group) => group.id === selection.groupId) ?? null
  const currentRoom =
    selection.section === 'servers'
      ? currentChannel
      : selection.section === 'messages' && selection.messageMode === 'dms'
        ? currentDm
        : selection.section === 'messages' && selection.messageMode === 'groups'
          ? currentGroup
          : null
  const isProfileDirty =
    bioDraft !== (snapshot?.user.bio ?? '') ||
    settingsDraft.displayName !== (snapshot?.user.displayName ?? '') ||
    settingsDraft.username !== (snapshot?.user.username ?? '') ||
    settingsDraft.avatarImage !== (snapshot?.user.avatarImage ?? '') ||
    settingsDraft.password.trim().length > 0
  const isAppearanceDirty =
    appearanceDraft.mode !== appearanceSaved.mode ||
    appearanceDraft.background !== appearanceSaved.background ||
    appearanceDraft.accent !== appearanceSaved.accent
  const isSettingsDirty = isProfileDirty || isAppearanceDirty

  useEffect(() => {
    if (!session?.userId || !currentRoom?.id) {
      return
    }

    apiRequest('/api/read', {
      method: 'POST',
      body: JSON.stringify({ userId: session.userId, roomId: currentRoom.id }),
    }).catch(() => {})
  }, [currentRoom?.id, currentRoom?.unread, currentRoom?.ping, session?.userId])

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
    setAuthError('')
    let data = null
    try {
      data = await submitAction('/api/auth/signup', 'POST', createForm, 'Account created.')
      if (data?.session) {
        setSelection(EMPTY_SELECTION)
        setAuthMode('login')
        setLoginUsername(createForm.username)
        setLoginPassword('')
        setCreateForm((current) => ({ ...current, password: '' }))
      } else {
        setAuthError('Create account failed. See the exact API error below the form.')
      }
    } catch (error) {
      // Look for duplicate username error
      if (error.message && error.message.includes('username is already taken')) {
        setAuthError('username already taken')
      } else {
        setAuthError('Create account failed. See the exact API error below the form.')
      }
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setAuthError('')
    const data = await submitAction(
      '/api/auth/login',
      'POST',
      { username: loginUsername, password: loginPassword },
      'Logged in.',
    )
    if (data?.session) {
      setSelection(EMPTY_SELECTION)
      setLoginPassword('')
    } else {
      setAuthError('Login failed. See the exact API error below the form.')
    }
  }

  async function handleQuickLogin(username) {
    setAuthError('')
    setAuthMode('login')
    setLoginUsername(username)
    setLoginPassword(DEMO_PASSWORD)
    setFlash(`Demo login ready for @${username}. Press log in to continue.`)
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
      setIsServerCreateOpen(false)
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
      setIsChannelCreateOpen(false)
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

    const data = await submitAction(
      `/api/servers/${selection.serverId}/invite`,
      'POST',
      { userId: session.userId, friendId: inviteFriendId },
      'Server invite sent.',
    )

    if (data) {
      setInviteFriendId('')
      setIsInviteFriendOpen(false)
    }
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
      setGroupForm({ name: '', avatarKey: AVATAR_PRESETS[2].key, memberIds: [], avatarImage: '' })
      setIsGroupCreateOpen(false)
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
        avatarImage: settingsDraft.avatarImage,
      },
      'Settings saved.',
    )

    if (data?.session) {
      setLoginUsername(data.session.username)
      setLoginPassword('')
      setSettingsDraft((current) => ({ ...current, password: '' }))
    }
  }

  async function handleSettingsAvatarUpload(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setFlash('Pick an image file.')
      return
    }

    if (file.size > 1024 * 1024) {
      setFlash('Image must be 1MB or smaller.')
      return
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(file)
      setSettingsDraft((current) => ({ ...current, avatarImage: imageDataUrl }))
      setFlash('Profile picture selected. Save settings to apply it.')
    } catch (error) {
      setFlash(error.message)
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

  function openSettings(tab = 'profile') {
    setSettingsTab(tab)
    setIsSettingsOpen(true)
  }

  function requestCloseSettings() {
    if (isSettingsDirty) {
      setFlash('Save your changes before closing settings.')
      return
    }

    setIsSettingsOpen(false)
  }

  function handleSaveAppearance(event) {
    event.preventDefault()
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearanceDraft))
    setAppearanceSaved(appearanceDraft)
    setFlash('Appearance saved.')
  }

  function applyAppearancePreset(mode) {
    if (mode === 'system') {
      const baseTheme = prefersDarkTheme ? DARK_THEME : LIGHT_THEME
      setAppearanceDraft((current) => ({ ...current, mode: 'system', background: baseTheme.bg, accent: baseTheme.accent }))
      return
    }

    const baseTheme = mode === 'light' ? LIGHT_THEME : DARK_THEME
    setAppearanceDraft((current) => ({ ...current, mode, background: baseTheme.bg, accent: baseTheme.accent }))
  }

  function openProfile(_profile) {
    openSettings('profile')
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

  function renderServerCreateForm(className = 'rail-create') {
    return (
      <div className={className}>
        <button
          type="button"
          className="rail-create-trigger"
          aria-expanded={isServerCreateOpen}
          aria-haspopup="dialog"
          onClick={() => setIsServerCreateOpen((current) => !current)}
        >
          +
        </button>

        {isServerCreateOpen ? (
          <div className="rail-create-overlay" onClick={() => setIsServerCreateOpen(false)}>
            <form className="rail-create-popover" onSubmit={handleCreateServer} onClick={(event) => event.stopPropagation()}>
              <div className="section-heading">
                <h3>New server</h3>
                <span>Choose a name and icon</span>
              </div>
              <input
                value={serverForm.name}
                onChange={(event) => setServerForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Dev Team 1"
                required
              />
              <label htmlFor="avatar">Choose an icon</label>
              <input
                type="file"
                name="avatar"
                id="avatar"
                accept="image/png, image/jpeg"
              />
              <div className="rail-create-actions">
                <button type="submit">Create</button>
                <button type="button" className="ghost" onClick={() => setIsServerCreateOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    )
  }

  function renderModal(children, onClose, panelClassName = 'modal-panel') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className={panelClassName} onClick={(event) => event.stopPropagation()}>
          {children}
        </div>
      </div>
    )
  }

  if (!session || !snapshot) {
    return (
      <AuthScreen
        authError={authError}
        authMode={authMode}
        createForm={createForm}
        demoUsers={demoUsers}
        loginPassword={loginPassword}
        loginUsername={loginUsername}
        onAuthModeChange={(mode) => {
          setAuthError('')
          setAuthMode(mode)
        }}
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
  const socialTabBadge = messageTabBadge + snapshot.pendingFriendRequests.length + snapshot.serverInvites.length
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
      <div className="workspace-grid">
        <aside className="server-rail">
          <button
            type="button"
            className={selection.section === 'messages' ? 'brand-title active' : 'brand-title'}
            onClick={() =>
              setSelection((current) => ({
                ...current,
                section: 'messages',
                messageMode: current.messageMode || 'dms',
              }))
            }
          > 
            <img src="cortis-logo.svg" alt="Cortis Logo" /> 
            {socialTabBadge ? <span className="ping-dot">{socialTabBadge}</span> : null}
          </button>
          {snapshot.servers.map((server) => {
            const badge = countServerPings(server)
            return (
              <button
                type="button"
                key={server.id}
                className={
                  selection.serverId === server.id && selection.section === 'servers' ? 'rail-item active' : 'rail-item'
                }
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
          <div className="rail-bottom">
            {renderServerCreateForm()}

           
          </div>
        </aside>

        <aside className="sidebar-pane">
          {selection.section === 'servers' ? (
            <>
              <div className="pane-header">
                <div className="server-title-wrap">
                  <div className="server-title-row">
                    <h2>{currentServer?.name ?? 'No servers yet'}</h2>
                    {currentServer ? (
                      <div className="server-dropdown">
                        <button
                          type="button"
                          className="server-options-trigger"
                          aria-expanded={isServerOptionsOpen}
                          aria-label="Open server options"
                          onClick={() => setIsServerOptionsOpen((current) => !current)}
                        >
                          ▾
                        </button>
                        {isServerOptionsOpen ? (
                          <div className="server-dropdown-menu">
                            {currentServer.ownerId === snapshot.user.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsChannelCreateOpen(true)
                                  setIsServerOptionsOpen(false)
                                }}
                              >
                                New channel
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                setIsInviteFriendOpen(true)
                                setIsServerOptionsOpen(false)
                              }}
                            >
                              Invite a friend
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <p>{currentServer ? `${currentServer.members.length} members` : 'Create a server to begin.'}</p>
                </div>
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
            </>
          ) : null}

          {selection.section === 'messages' ? (
            <>
              <div className="pane-header">
                <h2>Direct Messages</h2>
                <div className="server-dropdown" ref={messagesMenuRef}>
                  <button
                    type="button"
                    className="pane-header-action"
                    aria-expanded={isMessagesMenuOpen}
                    aria-label="Open message actions"
                    onClick={() => setIsMessagesMenuOpen((current) => !current)}
                  >
                    +
                  </button>
                  {isMessagesMenuOpen ? (
                    <div className="server-dropdown-menu open-left">
                      <button
                        type="button"
                        onClick={() => {
                          setIsGroupCreateOpen(true)
                          setIsMessagesMenuOpen(false)
                        }}
                      >
                        New group chat
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddFriendOpen((current) => !current)
                          setIsMessagesMenuOpen(false)
                        }}
                      >
                        {isAddFriendOpen ? 'Hide add friend' : 'Add friend'}
                      </button>
                    </div>
                  ) : null}
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
                      <Avatar label={dm.member.displayName} imageUrl={dm.member.avatarImage} />
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

              {isAddFriendOpen ? (
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
              ) : null}

              <div className="request-panel">
                <div className="section-heading">
                  <h3>Friend requests</h3>
                  <span>{snapshot.pendingFriendRequests.length}</span>
                </div>
                {snapshot.pendingFriendRequests.map((request) => (
                  <div key={request.id} className="request-row">
                    <button type="button" className="profile-link" onClick={() => openProfile(request)}>
                      <Avatar label={request.displayName} imageUrl={request.avatarImage} />
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
                {!snapshot.pendingFriendRequests.length ? <p className="empty-state">No pending friend requests.</p> : null}
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
                {!snapshot.serverInvites.length ? <p className="empty-state">No active server invites</p> : null}
              </div>
            </>
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
                        : null}
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
                        <Avatar label={message.author.displayName} imageUrl={message.author.avatarImage} size="sm" />
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
                {!currentRoom.messages.length ? <p className="empty-state">No messages yet. Start the conversation.</p> : null}
              </div>

              <form className="composer" onSubmit={handleSendMessage}>
                <textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      handleSendMessage(event)
                    }
                  }}
                  placeholder={
                    currentRoom.canSend === false
                      ? 'This channel is read-only for members.'
                      : `Message #${currentChannel?.name}`
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
                  <h2>Username-based networking</h2>`

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

        </main>

        <aside className="member-pane">
          <div className="pane-header">
            <h2>Members</h2>
          </div>
          <div className="member-list">
            {currentMembers.map((member) => (
              <button type="button" key={member.id} className="member-card" onClick={() => openProfile(member)}>
                <Avatar label={member.displayName} imageUrl={member.avatarImage} />
                <span>
                  {member.displayName}
                  <strong>@{member.username}</strong>
                </span>
              </button>
            ))}
            {!currentMembers.length ? <p className="empty-state">No members.</p> : null}
          </div>
        </aside>
        <button
          type="button"
          className="bottom-profile-panel"
          onClick={() => openSettings('profile')}
          aria-label="Open settings"
        >
          <Avatar label={snapshot.user.displayName} imageUrl={snapshot.user.avatarImage} />
          <span className="bottom-profile-content">
            <strong>{snapshot.user.displayName}</strong>
            <span>@{snapshot.user.username}</span>
          </span>
          <span
            className="settings-toggle-button"
            role="button"
            tabIndex={0}
            aria-label="Open settings"
            onClick={(event) => {
              event.stopPropagation()
              openSettings('profile')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                openSettings('profile')
              }
            }}
          >
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </button>
      </div>

      {isSettingsOpen
        ? renderModal(
            <section className="settings-modal-shell">
              <header className="settings-modal-header">
                <h2>Settings</h2>
                {isSettingsDirty ? <span className="settings-warning">Unsaved changes</span> : null}
              </header>

              <nav className="settings-subtabs" aria-label="Settings sections">
                <button
                  type="button"
                  className={settingsTab === 'profile' ? 'active' : ''}
                  onClick={() => setSettingsTab('profile')}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className={settingsTab === 'appearance' ? 'active' : ''}
                  onClick={() => setSettingsTab('appearance')}
                >
                  Appearance
                </button>
              </nav>

              {settingsTab === 'profile' ? (
                <ProfileCard
                  profile={snapshot.user}
                  isSelf={true}
                  bioDraft={bioDraft}
                  onBioDraftChange={setBioDraft}
                  onBioSave={handleSaveBio}
                  settingsDraft={settingsDraft}
                  onSettingsChange={(field, value) => setSettingsDraft((current) => ({ ...current, [field]: value }))}
                  onSettingsSave={handleSaveSettings}
                  onSettingsAvatarUpload={handleSettingsAvatarUpload}
                />
              ) : (
                <form className="stack-form settings-appearance-form" onSubmit={handleSaveAppearance}>
                  <div className="section-heading">
                    <h3>Appearance</h3>
                    <span>Customize your local visual theme</span>
                  </div>

                  <div className="appearance-preset-row" role="group" aria-label="Appearance presets">
                    <button
                      type="button"
                      className={appearanceDraft.mode === 'dark' ? 'active' : ''}
                      onClick={() => applyAppearancePreset('dark')}
                    >
                      Dark
                    </button>
                    <button
                      type="button"
                      className={appearanceDraft.mode === 'light' ? 'active' : ''}
                      onClick={() => applyAppearancePreset('light')}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      className={appearanceDraft.mode === 'system' ? 'active' : ''}
                      onClick={() => applyAppearancePreset('system')}
                    >
                      System
                    </button>
                  </div>

                  <label>
                    Background color
                    <input
                      type="color"
                      value={appearanceDraft.background}
                      disabled={appearanceDraft.mode === 'system'}
                      onChange={(event) =>
                        setAppearanceDraft((current) => ({ ...current, background: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Accent color
                    <input
                      type="color"
                      value={appearanceDraft.accent}
                      disabled={appearanceDraft.mode === 'system'}
                      onChange={(event) => setAppearanceDraft((current) => ({ ...current, accent: event.target.value }))}
                    />
                  </label>

                  <button type="submit">Save appearance</button>
                </form>
              )}

              <div className="modal-actions settings-modal-actions">
                <button type="button" className="ghost" onClick={requestCloseSettings}>
                  Close
                </button>
              </div>
            </section>,
            requestCloseSettings,
            'modal-panel settings-modal-panel',
          )
        : null}

      {isChannelCreateOpen
        ? renderModal(
            <form className="stack-form modal-form" onSubmit={handleCreateChannel}>
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
              <div className="modal-actions">
                <button type="submit">Add channel</button>
                <button type="button" className="ghost" onClick={() => setIsChannelCreateOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>,
            () => setIsChannelCreateOpen(false),
          )
        : null}

      {isInviteFriendOpen
        ? renderModal(
            <div className="stack-form modal-form">
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
              <div className="modal-actions">
                <button type="button" onClick={handleInviteFriend}>
                  Send invite
                </button>
                <button type="button" className="ghost" onClick={() => setIsInviteFriendOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>,
            () => setIsInviteFriendOpen(false),
          )
        : null}

      {isGroupCreateOpen
        ? renderModal(
            <form className="stack-form modal-form" onSubmit={handleCreateGroup}>
              <div className="section-heading">
                <h3>New group chat</h3>
                <span>Up to 10 members total</span>
              </div>
              <input
                value={groupForm.name}
                onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Science Project"
                required
              />
              <label htmlFor="group-avatar">Choose an icon</label>
              <input
                type="file"
                name="group-avatar"
                id="group-avatar"
                accept="image/png, image/jpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  if (!file.type.startsWith('image/')) {
                    setFlash('Pick an image file.')
                    return
                  }
                  if (file.size > 1024 * 1024) {
                    setFlash('Image must be 1MB or smaller.')
                    return
                  }
                  readFileAsDataUrl(file)
                    .then((imageDataUrl) => {
                      setGroupForm((current) => ({ ...current, avatarKey: '', avatarImage: imageDataUrl }))
                      setFlash('Group icon selected.')
                    })
                    .catch((error) => setFlash(error.message))
                }}
              />
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
              <div className="modal-actions">
                <button type="submit">Create group</button>
                <button type="button" className="ghost" onClick={() => setIsGroupCreateOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>,
            () => setIsGroupCreateOpen(false),
          )
        : null}
    </div>
  )
}

export default App