export type RoleplayLayout = 'current' | 'framed-hud'

const STORAGE_KEY = 'hw.roleplay.layout.v1'

export function getRoleplayLayout(): RoleplayLayout {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'framed-hud' ? 'framed-hud' : 'current'
}

export function saveRoleplayLayout(layout: RoleplayLayout): RoleplayLayout {
  localStorage.setItem(STORAGE_KEY, layout)
  window.dispatchEvent(new CustomEvent('hw:roleplay-layout-changed', { detail: { layout } }))
  return layout
}

function installSettingsPanel(): void {
  const grid = document.querySelector<HTMLElement>('.settings-grid')
  if (!grid || grid.querySelector('[data-roleplay-layout-settings]')) return

  const selected = getRoleplayLayout()
  const panel = document.createElement('article')
  panel.className = 'settings-panel instrument-panel'
  panel.dataset.roleplayLayoutSettings = 'true'
  panel.innerHTML = `
    <header class="module-title"><div><p class="eyebrow">ROLEPLAY DISPLAY</p><h2>Layout</h2></div><small>WORLD RUNTIME</small></header>
    <p class="module-intro">Choose how World Runtime is presented. The current layout remains available and unchanged.</p>
    <div class="theme-selector roleplay-layout-selector" role="radiogroup" aria-label="Roleplay layout">
      <button type="button" role="radio" data-roleplay-layout="current" aria-checked="${selected === 'current'}" class="${selected === 'current' ? 'active' : ''}">
        <span class="roleplay-layout-preview current"><i></i><b></b></span>
        <strong>Current</strong>
        <small>Original open roleplay view</small>
      </button>
      <button type="button" role="radio" data-roleplay-layout="framed-hud" aria-checked="${selected === 'framed-hud'}" class="${selected === 'framed-hud' ? 'active' : ''}">
        <span class="roleplay-layout-preview framed"><i></i><b></b></span>
        <strong>Framed HUD</strong>
        <small>People · Story · World state</small>
      </button>
    </div>
    <p class="roleplay-layout-note">Framed HUD is intended for PC browsers and landscape tablets. Smaller screens automatically keep the current layout.</p>
  `

  const appearancePanel = grid.querySelector<HTMLElement>('.settings-panel')
  if (appearancePanel?.nextSibling) grid.insertBefore(panel, appearancePanel.nextSibling)
  else grid.prepend(panel)

  panel.querySelectorAll<HTMLButtonElement>('[data-roleplay-layout]').forEach((button) => {
    button.addEventListener('click', () => {
      const layout = button.dataset.roleplayLayout === 'framed-hud' ? 'framed-hud' : 'current'
      saveRoleplayLayout(layout)
      panel.querySelectorAll<HTMLButtonElement>('[data-roleplay-layout]').forEach((item) => {
        const active = item === button
        item.classList.toggle('active', active)
        item.setAttribute('aria-checked', String(active))
      })
    })
  })
}

export function installRoleplayLayoutSettings(): void {
  const observer = new MutationObserver(() => installSettingsPanel())
  observer.observe(document.body, { childList: true, subtree: true })
  installSettingsPanel()
}
