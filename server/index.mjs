import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const app = express()
const port = Number(process.env.PORT || 8787)

const required = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'SESSION_SECRET']
const authReady = required.every((key) => process.env[key])

app.set('trust proxy', 1)
app.use(session({
  name: 'hw_gate',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}))

const stateStore = new Map()

function cleanStates() {
  const now = Date.now()
  for (const [state, created] of stateStore) {
    if (now - created > 10 * 60 * 1000) stateStore.delete(state)
  }
}

function accessFromRoles(roles = []) {
  const access = new Set(['stable'])
  const alphaRoles = (process.env.DISCORD_ALPHA_ROLE_IDS || '').split(',').map(v => v.trim()).filter(Boolean)
  const eaRoles = (process.env.DISCORD_EA_ROLE_IDS || '').split(',').map(v => v.trim()).filter(Boolean)
  const devRoles = (process.env.DISCORD_DEV_ROLE_IDS || '').split(',').map(v => v.trim()).filter(Boolean)
  if (roles.some(role => eaRoles.includes(role))) access.add('ea')
  if (roles.some(role => alphaRoles.includes(role))) access.add('alpha')
  if (roles.some(role => devRoles.includes(role))) access.add('all')
  return [...access]
}

app.get('/api/session', (req, res) => {
  res.json(req.session.user ? {
    authenticated: true,
    user: req.session.user,
    access: req.session.access || ['stable'],
  } : { authenticated: false })
})

app.get('/auth/discord', (req, res) => {
  if (!authReady) return res.status(503).send('Discord auth is not configured yet. Add the required environment variables.')
  cleanStates()
  const state = crypto.randomBytes(24).toString('hex')
  stateStore.set(state, Date.now())
  req.session.oauthState = state

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state,
    prompt: 'none',
  })
  res.redirect(`https://discord.com/oauth2/authorize?${params}`)
})

app.get('/auth/discord/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    if (!code || !state || state !== req.session.oauthState || !stateStore.has(state)) {
      return res.status(400).send('The gate rejected an invalid authentication state.')
    }
    stateStore.delete(state)
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
    const guildId = process.env.DISCORD_GUILD_ID
    if (guildId) {
      const memberRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
      if (memberRes.ok) {
        const member = await memberRes.json()
        roles = Array.isArray(member.roles) ? member.roles : []
      }
    }

    req.session.user = {
      id: user.id,
      username: user.global_name || user.username,
      avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
    }
    req.session.access = accessFromRoles(roles)
    res.redirect('/?worthy=1')
  } catch (error) {
    console.error(error)
    res.status(500).send('The gate could not verify your Discord identity.')
  }
})

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'))
})

const dist = path.join(root, 'dist')
app.use(express.static(dist))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) return next()
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(port, () => {
  console.log(`HW Landing gate listening on http://localhost:${port}`)
  if (!authReady) console.log('Discord auth is not configured. See .env.example.')
})
