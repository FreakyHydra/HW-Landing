import test from 'node:test'
import assert from 'node:assert/strict'
import { accessFromRoles, parseRoleIds } from '../server/access.mjs'

test('parseRoleIds normalizes a comma-separated role list', () => {
  assert.deepEqual(parseRoleIds(' 1,2, ,3 '), ['1', '2', '3'])
})

test('stable access is always present', () => {
  assert.deepEqual(accessFromRoles([], {}), ['stable'])
})

test('beta roles unlock beta', () => {
  assert.deepEqual(accessFromRoles(['b'], { DISCORD_BETA_ROLE_IDS: 'b' }), ['stable', 'beta'])
})

test('legacy EA roles are treated as closed beta access', () => {
  assert.deepEqual(accessFromRoles(['ea'], { DISCORD_EA_ROLE_IDS: 'ea' }), ['stable', 'beta'])
})

test('alpha inherits beta access', () => {
  assert.deepEqual(accessFromRoles(['a'], { DISCORD_ALPHA_ROLE_IDS: 'a' }), ['stable', 'beta', 'alpha'])
})

test('developer roles unlock all projects', () => {
  assert.deepEqual(accessFromRoles(['dev'], { DISCORD_DEV_ROLE_IDS: 'dev' }), ['stable', 'all'])
})
