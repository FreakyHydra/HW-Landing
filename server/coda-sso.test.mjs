import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCodaLoginUrl,
  clearSharedSessionCookie,
  landingSessionFromCoda,
  sharedSessionCookieHeader,
} from './coda-sso.mjs'

test('sharedSessionCookieHeader forwards only the Coda session cookie', () => {
  assert.equal(
    sharedSessionCookieHeader('foo=1; hw_coda_admin_session=abc123; other=2'),
    'hw_coda_admin_session=abc123',
  )
})

test('buildCodaLoginUrl preserves the requested landing return URL', () => {
  const url = new URL(buildCodaLoginUrl(
    'https://admin.thehowlingwhispers.com',
    'https://thehowlingwhispers.com/?worthy=1',
  ))
  assert.equal(url.origin, 'https://admin.thehowlingwhispers.com')
  assert.equal(url.pathname, '/api/coda/auth/login')
  assert.equal(url.searchParams.get('return_to'), 'https://thehowlingwhispers.com/?worthy=1')
})

test('landingSessionFromCoda rejects sessions that are not guild members', () => {
  assert.deepEqual(landingSessionFromCoda({
    session: {
      user: { id: '1', username: 'Test' },
      guildMember: false,
      roles: ['beta'],
    },
  }), { authenticated: false })
})

test('landingSessionFromCoda maps Coda role IDs into landing seals', () => {
  const session = landingSessionFromCoda({
    session: {
      user: { id: '1', username: 'Test', avatarUrl: 'https://cdn.discordapp.com/avatar.png' },
      guildMember: true,
      roles: ['alpha-role'],
    },
  }, {
    DISCORD_BETA_ROLE_IDS: '',
    DISCORD_EA_ROLE_IDS: '',
    DISCORD_ALPHA_ROLE_IDS: 'alpha-role',
    DISCORD_DEV_ROLE_IDS: '',
  })

  assert.equal(session.authenticated, true)
  assert.deepEqual(session.access, ['stable', 'beta', 'alpha'])
  assert.equal(session.user.username, 'Test')
})

test('clearSharedSessionCookie clears the shared parent-domain cookie', () => {
  const value = clearSharedSessionCookie()
  assert.match(value, /^hw_coda_admin_session=;/)
  assert.match(value, /Max-Age=0/)
  assert.match(value, /Domain=\.thehowlingwhispers\.com/)
  assert.match(value, /Secure/)
})
