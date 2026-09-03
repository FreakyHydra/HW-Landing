import './style.css'
import { createField } from './field'
import { mountUi, renderIdentity, renderProjects } from './ui'
import type { AccessTier, Session } from './projects'

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const authUrl = import.meta.env.VITE_AUTH_URL || '/'

document.addEventListener('contextmenu', (event) => {
  event.preventDefault()
})

const ui = mountUi()
createField(ui.field, ui.shatter, ui.aura, ui.sigil, reducedMotion)

function devPreviewSession(): Session | undefined {
  if (!import.meta.env.DEV) return undefined
  const preview = new URLSearchParams(location.search).get('preview')
  const accessMap: Record<string, AccessTier[]> = {
    stable: ['stable'],
    beta: ['stable', 'beta'],
    alpha: ['stable', 'beta', 'alpha'],
    dev: ['stable', 'all'],
  }
  if (!preview || !accessMap[preview]) return undefined
  return {
    authenticated: true,
    user: { username: 'Lobby Preview' },
    access: accessMap[preview],
  }
}

function showLobby(session: Session): void {
  renderIdentity(ui.identity, session)
  renderProjects(ui.projectGrid, session)

  const eyebrow = ui.world.querySelector<HTMLElement>('.world-hero .eyebrow')
  const title = ui.world.querySelector<HTMLElement>('.world-hero h2')
  const intro = ui.world.querySelector<HTMLElement>('.world-hero > p:not(.eyebrow)')
  const divider = ui.world.querySelector<HTMLElement>('.realm-divider span')
  if (eyebrow) eyebrow.textContent = 'SEAL VERIFIED'
  if (title) title.textContent = 'The Howling Whispers Lobby'
  if (intro) intro.textContent = 'Choose where you want to go. Rebrand, Sandbox and the Lightyear Apart corporation area remain separate destinations behind the same authenticated gate.'
  if (divider) divider.textContent = 'CHOOSE A DESTINATION'

  ui.gate.hidden = true
  ui.world.hidden = false
  ui.world.removeAttribute('aria-hidden')
  document.body.classList.remove('gate-locked')
  document.body.classList.add('gate-open')
  window.scrollTo({ top: 0, behavior: 'auto' })
}

async function loadSession(): Promise<void> {
  try {
    const session = devPreviewSession() || await (async () => {
      const response = await fetch('/api/session', { credentials: 'include', cache: 'no-store' })
      if (!response.ok) return { authenticated: false } as Session
      return response.json() as Promise<Session>
    })()

    if (!session.authenticated) {
      location.replace(authUrl)
      return
    }
    showLobby(session)
  } catch {
    location.replace(authUrl)
  }
}

loadSession()
