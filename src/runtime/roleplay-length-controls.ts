import { getRoleplayResponseLength, ROLEPLAY_RESPONSE_LENGTHS, saveRoleplayResponseLength, type RoleplayResponseLength } from './roleplay-length-settings.ts'

function labelFor(value: RoleplayResponseLength): string {
  return ROLEPLAY_RESPONSE_LENGTHS.find((item) => item.value === value)?.label || value
}

function mountSettings(): void {
  if (location.pathname !== '/settings/' && !location.pathname.endsWith('/settings')) return
  const grid = document.querySelector<HTMLElement>('.settings-grid')
  if (!grid || grid.querySelector('[data-response-length-settings]')) return
  const current = getRoleplayResponseLength()
  const panel = document.createElement('article')
  panel.className = 'settings-panel instrument-panel'
  panel.dataset.responseLengthSettings = 'true'
  panel.innerHTML = `
    <header class="module-title"><div><p class="eyebrow">ROLEPLAY GENERATION</p><h2>Response length</h2></div><small>SANDBOX RULE</small></header>
    <p class="module-intro">Controls the usual size of world replies. These are pacing guidelines, not forced minimums.</p>
    <form data-response-length-form class="editor-panel">
      <label class="field-control">
        <span class="field-head">Reply length</span>
        <select data-response-length-select>
          ${ROLEPLAY_RESPONSE_LENGTHS.map((item) => `<option value="${item.value}"${item.value === current ? ' selected' : ''}>${item.label} · ${item.description}</option>`).join('')}
        </select>
      </label>
      <p class="module-intro">Quick: 1-2 paragraphs. Immersive: 3-5 substantial paragraphs. Novel-like: 5-8 substantial paragraphs. Short exchanges may stay short instead of being padded.</p>
      <div class="card-actions"><button type="submit" class="machine-button primary">SAVE RESPONSE LENGTH</button></div>
    </form>
  `
  grid.append(panel)
  panel.querySelector<HTMLFormElement>('[data-response-length-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const select = panel.querySelector<HTMLSelectElement>('[data-response-length-select]')!
    const value = select.value as RoleplayResponseLength
    saveRoleplayResponseLength(value)
    const button = panel.querySelector<HTMLButtonElement>('button[type="submit"]')!
    const previous = button.textContent
    button.textContent = `${labelFor(value).toUpperCase()} SAVED`
    window.setTimeout(() => { button.textContent = previous }, 1200)
  })
}

function appendRuntimeSystem(text: string): void {
  const story = document.querySelector<HTMLElement>('.world-runtime-story')
  if (!story) return
  const article = document.createElement('article')
  article.className = 'world-runtime-message system'
  const body = document.createElement('div')
  body.className = 'world-runtime-message-body'
  body.textContent = text
  article.append(body)
  story.append(article)
  story.scrollTop = story.scrollHeight
}

function handleLengthCommand(event: Event): void {
  const form = event.target as HTMLFormElement
  if (!form.matches('.world-runtime-prompt')) return
  const input = form.querySelector<HTMLTextAreaElement>('textarea')
  if (!input) return
  const command = input.value.trim()
  if (!/^\/length(?:\s|$)/i.test(command)) return

  event.preventDefault()
  event.stopImmediatePropagation()
  const argument = command.slice('/length'.length).trim().toLowerCase()
  input.value = ''
  input.style.height = 'auto'

  if (!argument) {
    const current = getRoleplayResponseLength()
    appendRuntimeSystem(`Response length: ${labelFor(current)}. Use /length quick, /length immersive, or /length novel.`)
    return
  }

  const aliases: Record<string, RoleplayResponseLength> = {
    quick: 'quick', short: 'quick',
    immersive: 'immersive', normal: 'immersive', default: 'immersive',
    novel: 'novel', 'novel-like': 'novel', long: 'novel',
  }
  const value = aliases[argument]
  if (!value) {
    appendRuntimeSystem('Unknown response length. Use quick, immersive, or novel.')
    return
  }
  saveRoleplayResponseLength(value)
  appendRuntimeSystem(`Response length changed to ${labelFor(value)}.`)
}

const observer = new MutationObserver(mountSettings)
observer.observe(document.documentElement, { childList: true, subtree: true })
document.addEventListener('submit', handleLengthCommand, true)
mountSettings()

export function installRoleplayLengthControls(): void {
  mountSettings()
}
