import './style.css'
import { createField } from './field'
import { shatterSigil } from './shatter'
import { mountUi, renderIdentity, renderProjects, showDeniedReason } from './ui'
import type { Session } from './projects'

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

async function loadSession() {
  try {
    const response = await fetch('/api/session', { credentials: 'include', cache: 'no-store' })
    if (!response.ok) return
    const session = await response.json() as Session
    if (session.authenticated) {
      setTimeout(() => revealWorld(session), reducedMotion ? 80 : 760)
    }
  } catch {
    ui.gateNote.textContent = 'The gate is offline. The worlds remain sealed for now.'
    ui.gateNote.classList.add('warning')
  }
}

loadSession()
