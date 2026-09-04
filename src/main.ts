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
createField(ui.field, ui.shatter, ui.aura, ui.fieldAnchor, reducedMotion)

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

  ui.world.hidden = false
  ui.world.removeAttribute('aria-hidden')
  ui.world.classList.add('world-visible')
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
