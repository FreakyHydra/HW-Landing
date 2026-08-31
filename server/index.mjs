import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import sessionFileStore from 'session-file-store'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { accessFromRoles } from './access.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const app = express()
const port = Number(process.env.PORT || 8787)
const isProduction = process.env.NODE_ENV === 'production'
const requireGuildMembership = String(process.env.REQUIRE_GUILD_MEMBERSHIP || 'false').toLowerCase() === 'true'
const discordRequired = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI']
const authReady = discordRequired.every((key) => Boolean(process.env[key]))
const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : crypto.randomBytes(32).toString('hex'))

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required when NODE_ENV=production.')
}

const FileStore = sessionFileStore(session)

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' https://cdn.discordapp.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    )
  }
  next()
})

app.use(session({
  name: 'hw_gate',
  store: new FileStore({
    path: path.join(root, '.sessions'),
    retries: 0,
    logFn: () => {},
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}))

app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ ok: true, authReady })
})

app.get('/api/session', (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json(req.session.user ? {
    authenticated: true,
    user: req.session.user,
    access: req.session.access || ['stable'],
  } : { authenticated: false })
})

app.get('/auth/discord', (req, res) => {
  if (!authReady) {
    return res.status(503).send('Discord auth is not configured yet. Add the required environment variables.')
  }

  const state = crypto.randomBytes(24).toString('hex')
  req.session.oauthState = state

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state,
  })
  res.redirect(`https://discord.com/oauth2/authorize?${params}`)
})

app.get('/auth/discord/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    if (!code || !state || state !== req.session.oauthState) {
      return res.redirect('/?denied=auth')
    }
    delete req.session.oauthState

    const tokenBody = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    })

    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    })
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`)
    const token = await tokenRes.json()

    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    if (!userRes.ok) throw new Error(`User lookup failed: ${userRes.status}`)
    const user = await userRes.json()

    let roles = []
    let guildMember = false
    const guildId = process.env.DISCORD_GUILD_ID
    if (guildId) {
      const memberRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
      guildMember = memberRes.ok
      if (memberRes.ok) {
        const member = await memberRes.json()
        roles = Array.isArray(member.roles) ? member.roles : []
      }
    }

    if (requireGuildMembership && guildId && !guildMember) {
      req.session.destroy(() => res.redirect('/?denied=not-member'))
      return
    }

    req.session.user = {
      id: user.id,
      username: user.global_name || user.username,
      avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
    }
    req.session.access = accessFromRoles(roles)
    res.redirect('/?worthy=1')
  } catch (error) {
    console.error('Discord gate error:', error)
    res.redirect('/?denied=auth')
  }
})

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'))
})

const dist = path.join(root, 'dist')
app.use(express.static(dist, {
  maxAge: isProduction ? '1h' : 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
  },
}))
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next()
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(port, () => {
  console.log(`HW Landing gate listening on http://localhost:${port}`)
  if (!authReady) console.log('Discord auth is not configured. See .env.example.')
})
