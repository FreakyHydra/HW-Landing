import './style.css'
import { createField } from './field'
import { markGateAccepted, mountUi, showDeniedReason } from './ui'
import type { AccessTier, Session } from './projects'

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const lobbyUrl = import.meta.env.VITE_LOBBY_URL || '/lobby/'

document.addEventListener('contextmenu', (event) => {
  event.preventDefault()
})

const ui = mountUi()
createField(ui.field, ui.shatter, ui.aura, ui.sigil, reducedMotion)
showDeniedReason(ui.gateNote)

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
    user: { username: 'Gate Preview' },
    access: accessMap[preview],
  }
}

function enterLobby(session: Session): void {
  markGateAccepted(ui, session)
  ui.gateAction.textContent = 'ENTER THE LOBBY'
  ui.gateNote.textContent = 'Your seal is accepted. Passing you beyond the gate.'
  window.setTimeout(() => {
    location.assign(lobbyUrl)
  }, reducedMotion ? 150 : 1050)
}

async function loadSession() {
  try {
    const session = devPreviewSession() || await (async () => {
      const response = await fetch('/api/session', { credentials: 'include', cache: 'no-store' })
      if (!response.ok) return { authenticated: false } as Session
      return response.json() as Promise<Session>
    })()

    if (session.authenticated) {
      await ui.sigilImage.decode().catch(() => undefined)
      enterLobby(session)
    }
  } catch {
    ui.gateNote.textContent = 'The gate is offline. The worlds remain sealed for now.'
    ui.gateNote.classList.add('warning')
  }
}

loadSession()
