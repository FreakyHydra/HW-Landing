export function parseRoleIds(value = '') {
  return String(value)
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean)
}

export function accessFromRoles(roles = [], env = process.env) {
  const roleSet = new Set(roles)
  const betaRoles = new Set([
    ...parseRoleIds(env.DISCORD_BETA_ROLE_IDS),
    ...parseRoleIds(env.DISCORD_EA_ROLE_IDS),
  ])
  const alphaRoles = new Set(parseRoleIds(env.DISCORD_ALPHA_ROLE_IDS))
  const devRoles = new Set(parseRoleIds(env.DISCORD_DEV_ROLE_IDS))
  const access = new Set(['stable'])

  const hasAny = (allowed) => [...roleSet].some((role) => allowed.has(role))

  if (hasAny(betaRoles)) access.add('beta')
  if (hasAny(alphaRoles)) {
    access.add('beta')
    access.add('alpha')
  }
  if (hasAny(devRoles)) access.add('all')

  return [...access]
}
