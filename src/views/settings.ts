import { shell } from '../app/shell'
import { getThemePreference, setThemePreference, type ThemePreference } from '../app/theme'

export async function renderSettings(root: HTMLElement): Promise<void> {
  const preference = getThemePreference()
  root.innerHTML = shell('/settings/', `
    <section class="settings-grid">
      <article class="settings-panel instrument-panel">
        <header class="module-title"><div><p class="eyebrow">APPEARANCE</p><h2>Theme</h2></div><small>SURFACE SYSTEM</small></header>
        <p class="module-intro">Copper remains constant. Choose how the surrounding surfaces respond.</p>
        <div class="theme-selector" role="radiogroup" aria-label="Appearance theme">
          ${(['system','light','dark'] as ThemePreference[]).map((theme) => `<button type="button" role="radio" data-theme-choice="${theme}" aria-checked="${preference === theme}" class="${preference === theme ? 'active' : ''}"><span class="theme-swatch ${theme}"><i></i><b></b></span><strong>${theme[0].toUpperCase()}${theme.slice(1)}</strong><small>${theme === 'system' ? 'Follow this device' : theme === 'light' ? 'Warm daylight surfaces' : 'Analog night surfaces'}</small></button>`).join('')}
        </div>
      </article>
      <article class="settings-panel instrument-panel muted-setting"><header class="module-title"><div><p class="eyebrow">PERSISTENCE</p><h2>Storage</h2></div><small>DEVELOPMENT PHASE</small></header><p>Worlds, characters and personas currently stay on this device behind repository interfaces. Account and server storage can replace the implementation later.</p></article>
    </section>
  `, 'Settings', 'TOOLS · PLATFORM CONTROLS')

  root.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((button) => button.addEventListener('click', () => {
    const choice = button.dataset.themeChoice as ThemePreference
    setThemePreference(choice)
    root.querySelectorAll<HTMLButtonElement>('[data-quick-theme]').forEach((item) => {
      const active = item.dataset.quickTheme === choice
      item.classList.toggle('active', active)
      item.setAttribute('aria-pressed', String(active))
    })
    root.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((item) => {
      const active = item === button
      item.classList.toggle('active', active)
      item.setAttribute('aria-checked', String(active))
    })
  }))
}
