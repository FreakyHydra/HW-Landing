export type AccessTier = 'stable' | 'beta' | 'alpha' | 'all'

export type Session = {
  authenticated: boolean
  user?: { username: string; avatarUrl?: string }
  access?: AccessTier[]
}

export type Project = {
  title: string
  stage: 'STABLE' | 'CLOSED BETA' | 'CLOSED ALPHA'
  realm: 'ROLEPLAY' | 'SOUND' | 'WORLD' | 'DESKTOP' | 'EVE ONLINE'
  desc: string
  href?: string
  actionLabel?: string
  access: Exclude<AccessTier, 'all'>
}

const appUrl = import.meta.env.VITE_HW_APP_URL || '/hwrpv2/'
const sandboxUrl = import.meta.env.VITE_SANDBOX_URL || 'https://sandbox.thehowlingwhispers.com'
const eveCorpUrl = import.meta.env.VITE_EVE_CORP_URL || '/eve/lightyear-apart/'

export const projects: Project[] = [
  {
    title: 'The Howling Whispers',
    stage: 'STABLE',
    realm: 'ROLEPLAY',
    desc: 'The new roleplay platform, including World Runtime and the Forge.',
    href: appUrl,
    actionLabel: 'ENTER REBRAND',
    access: 'stable',
  },
  {
    title: 'Sandbox',
    stage: 'STABLE',
    realm: 'ROLEPLAY',
    desc: 'Enter the isolated character and persona roleplay Sandbox.',
    href: sandboxUrl,
    actionLabel: 'ENTER SANDBOX',
    access: 'stable',
  },
  {
    title: 'Lightyear Apart',
    stage: 'STABLE',
    realm: 'EVE ONLINE',
    desc: 'Enter the Lightyear Apart corporation area.',
    href: eveCorpUrl,
    actionLabel: 'ENTER CORP',
    access: 'stable',
  },
  {
    title: 'Howling Whispers Analog',
    stage: 'CLOSED ALPHA',
    realm: 'SOUND',
    desc: 'A browser sound laboratory for shaping waves, loops and exportable samples.',
    access: 'alpha',
  },
  {
    title: 'Bitterroot',
    stage: 'CLOSED ALPHA',
    realm: 'WORLD',
    desc: 'A living world project built around consequence, survival and story.',
    href: `${appUrl.replace(/\/$/, '')}/forge/worlds/enter/bitterroot/`,
    access: 'alpha',
  },
  {
    title: 'Howling Whispers Desktop',
    stage: 'CLOSED BETA',
    realm: 'DESKTOP',
    desc: 'The standalone desktop branch of the Howling Whispers ecosystem.',
    access: 'beta',
  },
]
