import { accessFromRoles } from './access.mjs'

export const CODA_COOKIE_NAME = 'hw_coda_admin_session'

export function parseCookies(header = '') {
  const out = new Map()
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    out.set(part.slice(0, index).trim(), part.slice(index + 1).trim())
  }
  return out
}

export function sharedSessionCookieHeader(header = '') {
  const value = parseCookies(header).get(CODA_COOKIE_NAME)
  return value ? `${CODA_COOKIE_NAME}=${value}` : ''
}

export function buildCodaLoginUrl(authBaseUrl, returnTo) {
  const target = new URL('/api/coda/auth/login', authBaseUrl)
  target.searchParams.set('return_to', returnTo)
  return target.toString()
}

export function landingSessionFromCoda(payload, env = process.env) {
  const session = payload?.session
  if (!session?.user || !session.guildMember) return { authenticated: false }

  return {
    authenticated: true,
    user: {
      id: session.user.id,
      username: session.user.username,
      avatarUrl: session.user.avatarUrl || undefined,
    },
    access: accessFromRoles(Array.isArray(session.roles) ? session.roles : [], env),
  }
}

export function clearSharedSessionCookie({ secure = true, domain = '.thehowlingwhispers.com' } = {}) {
  const domainPart = domain ? `; Domain=${domain}` : ''
  return `${CODA_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}${domainPart}`
}
