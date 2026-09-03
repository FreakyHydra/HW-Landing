import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildCodaLoginUrl,
  clearSharedSessionCookie,
  landingSessionFromCoda,
  sharedSessionCookieHeader,
} from './coda-sso.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const app = express()
const port = Number(process.env.PORT || 8787)
const isProduction = process.env.NODE_ENV === 'production'
const codaAuthBaseUrl = process.env.CODA_AUTH_BASE_URL || (isProduction ? 'https://admin.thehowlingwhispers.com' : '')
const publicBaseUrl = process.env.PUBLIC_BASE_URL || (isProduction ? 'https://thehowlingwhispers.com' : '')
const sharedCookieDomain = process.env.CODA_COOKIE_DOMAIN || (isProduction ? '.thehowlingwhispers.com' : '')
const authReady = Boolean(codaAuthBaseUrl && publicBaseUrl)

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
      "default-src 'self'; img-src 'self' blob: https://cdn.discordapp.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    )
  }
  next()
})

app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ ok: true, authReady, authSource: 'coda-sso' })
})

app.post('/api/image/novelai', express.json({ limit: '2mb' }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const token = String(req.get('X-NovelAI-Token') || '').trim()
  if (!token) return res.status(401).json({ error: 'NovelAI Persistent API token is required.' })

  const payload = req.body
  const allowedModels = new Set(['nai-diffusion-5-full', 'nai-diffusion-5-curated'])
  if (!payload || typeof payload !== 'object' || !allowedModels.has(payload.model) || payload.action !== 'generate') {
    return res.status(400).json({ error: 'Invalid NovelAI ImageGen V5 request.' })
  }

  const parameters = payload.parameters
  if (!parameters || typeof parameters !== 'object' || parameters.n_samples !== 1) {
    return res.status(400).json({ error: 'Forge currently supports one generated image per request.' })
  }

  try {
    const response = await fetch('https://image.novelai.net/ai/generate-image', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/zip, application/octet-stream',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1200)
      console.error(`NovelAI ImageGen failed with HTTP ${response.status}`)
      return res.status(response.status).json({ error: detail || `NovelAI ImageGen returned HTTP ${response.status}.` })
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    res.status(200)
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/zip')
    res.setHeader('Content-Length', String(bytes.length))
    return res.send(bytes)
  } catch (error) {
    console.error('NovelAI ImageGen proxy failed:', error instanceof Error ? error.message : error)
    return res.status(502).json({ error: 'NovelAI ImageGen could not be reached.' })
  }
})

app.post('/api/roleplay/novelai', express.json({ limit: '1mb' }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const token = String(req.get('X-NovelAI-Token') || process.env.NOVELAI_API_TOKEN || '').trim()
  if (!token) return res.status(401).json({ error: 'NovelAI Persistent API token is required. In the world runtime use /nai token YOUR_TOKEN.' })

  const body = req.body
  const allowedModels = new Set(['xialong-v1', 'glm-4-6'])
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid roleplay request.' })
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const model = typeof body.model === 'string' ? body.model : 'xialong-v1'
  if (!prompt || prompt.length > 120000 || !allowedModels.has(model)) return res.status(400).json({ error: 'Invalid NovelAI roleplay prompt or model.' })
  const maxTokens = Math.max(64, Math.min(1600, Number(body.maxTokens) || 850))
  const temperature = Math.max(0.1, Math.min(1.5, Number(body.temperature) || 0.9))

  try {
    const response = await fetch('https://text.novelai.net/oa/v1/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        max_tokens: maxTokens,
        temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
    })
    const text = await response.text()
    if (!response.ok) return res.status(response.status).json({ error: text.slice(0, 1200) || `NovelAI returned HTTP ${response.status}.` })
    let payload
    try { payload = JSON.parse(text) } catch { return res.status(502).json({ error: 'NovelAI returned an invalid response.' }) }
    const first = Array.isArray(payload?.choices) ? payload.choices[0] : undefined
    const reply = typeof first?.text === 'string' ? first.text : typeof first?.message?.content === 'string' ? first.message.content : ''
    if (!reply.trim()) return res.status(502).json({ error: 'NovelAI returned an empty reply.' })
    return res.json({ reply: reply.trim() })
  } catch (error) {
    console.error('NovelAI roleplay proxy failed:', error instanceof Error ? error.message : error)
    return res.status(502).json({ error: 'NovelAI roleplay generation could not be reached.' })
  }
})

app.get('/api/session', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  if (!authReady) return res.json({ authenticated: false })

  const cookie = sharedSessionCookieHeader(req.headers.cookie || '')
  if (!cookie) return res.json({ authenticated: false })

  try {
    const response = await fetch(new URL('/api/coda/auth/landing', codaAuthBaseUrl), {
      headers: { Cookie: cookie, Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return res.status(502).json({ authenticated: false })
    const payload = await response.json()
    res.json(landingSessionFromCoda(payload))
  } catch (error) {
    console.error('Coda SSO identity lookup failed:', error)
    res.status(502).json({ authenticated: false })
  }
})

app.get('/auth/discord', (_req, res) => {
  if (!authReady) {
    return res.status(503).send('Shared Discord authentication is not configured yet.')
  }

  const returnTo = new URL('/', publicBaseUrl)
  returnTo.searchParams.set('worthy', '1')
  res.redirect(buildCodaLoginUrl(codaAuthBaseUrl, returnTo.toString()))
})

app.get('/auth/logout', async (req, res) => {
  const cookie = sharedSessionCookieHeader(req.headers.cookie || '')
  if (authReady && cookie) {
    try {
      await fetch(new URL('/api/coda/auth/logout', codaAuthBaseUrl), {
        method: 'POST',
        headers: { Cookie: cookie, Accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      })
    } catch (error) {
      console.error('Coda SSO logout cleanup failed:', error)
    }
  }

  res.setHeader('Set-Cookie', clearSharedSessionCookie({
    secure: isProduction,
    domain: sharedCookieDomain,
  }))
  res.redirect('/')
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
  if (!authReady) console.log('Shared Coda SSO is not configured. See .env.example.')
})
