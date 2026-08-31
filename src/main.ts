import './style.css'
import { createField } from './field'
import { shatterSigil } from './shatter'
import { mountUi, renderIdentity, renderProjects, showDeniedReason } from './ui'
import type { AccessTier, Session } from './projects'

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const ui = mountUi()
const field = createField(ui.field, ui.shatter, ui.aura, ui.sigil, reducedMotion)
showDeniedReason(ui.gateNote)

function revealWorld(session: Session) {
  renderIdentity(ui.identity, session)
  renderProjects(ui.projectGrid, session)
  shatterSigil({
    canvas: ui.shatter,
    image: ui.sigilImage,
    gate: ui.gate,
    world: ui.world,
    reducedMotion,
    addRipple: field.addRipple,
  }, () => {
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    history.replaceState({}, '', location.pathname)
  })
}

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
  ui.gateNote.textContent = `Local preview seal: ${preview.toUpperCase()}`
  return {
    authenticated: true,
    user: { username: 'Gate Preview' },
    access: accessMap[preview],
  }
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
      setTimeout(() => revealWorld(session), reducedMotion ? 80 : 760)
    }
  } catch {
    ui.gateNote.textContent = 'The gate is offline. The worlds remain sealed for now.'
    ui.gateNote.classList.add('warning')
  }
}

loadSession()
