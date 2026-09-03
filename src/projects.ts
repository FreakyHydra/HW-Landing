export type AccessTier = 'stable' | 'beta' | 'alpha' | 'all'

export type Session = {
  authenticated: boolean
  user?: { username: string; avatarUrl?: string }
  access?: AccessTier[]
}

export type Project = {
  title: string
  stage: 'STABLE' | 'CLOSED BETA' | 'CLOSED ALPHA'
  realm: 'ROLEPLAY' | 'SOUND' | 'WORLD' | 'DESKTOP'
  desc: string
  href?: string
  access: Exclude<AccessTier, 'all'>
}

const appUrl = import.meta.env.VITE_HW_APP_URL || '/hwrpv2/'

export const projects: Project[] = [
  {
    title: 'The Howling Whispers',
    stage: 'STABLE',
    realm: 'ROLEPLAY',
    desc: 'The main roleplay platform, including Sandbox, World Runtime and the Forge.',
    href: appUrl,
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
