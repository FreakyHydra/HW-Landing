import { shell, toast } from '../app/shell'
import { getThemePreference, setThemePreference, type ThemePreference } from '../app/theme'
import { WORLD_RUNTIME_NAI_MODELS, type WorldRuntimeNovelAiModel } from '../runtime/novelai.ts'
import { clearNovelAiToken, getNovelAiRuntimeSettings, saveNovelAiRuntimeSettings } from '../runtime/novelai-settings.ts'
import { getRoleplayTextColors, resetRoleplayTextColors, saveRoleplayTextColors } from '../runtime/roleplay-visual-settings.ts'

export async function renderSettings(root: HTMLElement): Promise<void> {
  const preference = getThemePreference()
  const nai = getNovelAiRuntimeSettings()
  const textColors = getRoleplayTextColors()
  root.innerHTML = shell('/settings/', `
    <section class="settings-grid">
      <article class="settings-panel instrument-panel">
        <header class="module-title"><div><p class="eyebrow">APPEARANCE</p><h2>Theme</h2></div><small>SURFACE SYSTEM</small></header>
        <p class="module-intro">Copper remains constant. Choose how the surrounding surfaces respond.</p>
        <div class="theme-selector" role="radiogroup" aria-label="Appearance theme">
          ${(['system','light','dark'] as ThemePreference[]).map((theme) => `<button type="button" role="radio" data-theme-choice="${theme}" aria-checked="${preference === theme}" class="${preference === theme ? 'active' : ''}"><span class="theme-swatch ${theme}"><i></i><b></b></span><strong>${theme[0].toUpperCase()}${theme.slice(1)}</strong><small>${theme === 'system' ? 'Follow this device' : theme === 'light' ? 'Warm daylight surfaces' : 'Analog night surfaces'}</small></button>`).join('')}
        </div>
      </article>

      <article class="settings-panel instrument-panel">
        <header class="module-title"><div><p class="eyebrow">ROLEPLAY DISPLAY</p><h2>Text colors</h2></div><small>SANDBOX DEFAULTS</small></header>
        <p class="module-intro">Dialogue, action and narration use the same default colors as Sandbox. Change them here for the world runtime.</p>
        <form id="roleplay-color-settings" class="editor-panel roleplay-color-settings">
          <label class="field-control roleplay-color-field">
            <span class="field-head">Dialogue</span>
            <span class="roleplay-color-input"><input id="rp-dialogue-color" type="color" value="${textColors.dialogue}" /><code>${textColors.dialogue.toUpperCase()}</code></span>
          </label>
          <label class="field-control roleplay-color-field">
            <span class="field-head">Action</span>
            <span class="roleplay-color-input"><input id="rp-action-color" type="color" value="${textColors.action}" /><code>${textColors.action.toUpperCase()}</code></span>
          </label>
          <label class="field-control roleplay-color-field">
            <span class="field-head">Narration</span>
            <span class="roleplay-color-input"><input id="rp-narration-color" type="color" value="${textColors.narration}" /><code>${textColors.narration.toUpperCase()}</code></span>
          </label>
          <div class="card-actions">
            <button type="submit" class="machine-button primary">SAVE TEXT COLORS</button>
            <button type="button" class="machine-button" id="reset-roleplay-colors">RESET TO SANDBOX</button>
          </div>
        </form>
      </article>

      <article class="settings-panel instrument-panel">
        <header class="module-title"><div><p class="eyebrow">ROLEPLAY PROVIDER</p><h2>NovelAI</h2></div><small>LOCAL DEVICE</small></header>
        <p class="module-intro">These settings are stored only in this browser on this machine and are used by the world runtime.</p>
        <form id="novelai-settings" class="editor-panel">
          <label class="field-control">
            <span class="field-head">Persistent API token</span>
            <input id="nai-token" type="password" autocomplete="off" value="${nai.token ? '••••••••••••' : ''}" placeholder="Paste NovelAI persistent token" />
            <small>${nai.token ? 'A token is already saved on this device. Leave the masked value unchanged to keep it.' : 'Not saved yet.'}</small>
          </label>
          <label class="field-control">
            <span class="field-head">Model</span>
            <select id="nai-model">
              ${WORLD_RUNTIME_NAI_MODELS.map((model) => `<option value="${model}" ${model === nai.model ? 'selected' : ''}>${model}</option>`).join('')}
            </select>
          </label>
          <div class="field-grid">
            <label class="field-control">
              <span class="field-head">Maximum reply tokens</span>
              <input id="nai-max-tokens" type="number" min="64" max="1600" step="1" value="${nai.maxTokens}" />
            </label>
            <label class="field-control">
              <span class="field-head">Temperature</span>
              <input id="nai-temperature" type="number" min="0.1" max="1.5" step="0.05" value="${nai.temperature}" />
            </label>
          </div>
          <div class="card-actions">
            <button type="submit" class="machine-button primary">SAVE NOVELAI SETTINGS</button>
            <button type="button" class="machine-button" id="clear-nai-token">CLEAR TOKEN</button>
          </div>
        </form>
      </article>

      <article class="settings-panel instrument-panel muted-setting"><header class="module-title"><div><p class="eyebrow">PERSISTENCE</p><h2>Storage</h2></div><small>DEVELOPMENT PHASE</small></header><p>Worlds, characters, personas, roleplay colors and NovelAI runtime settings currently stay on this device behind local repository interfaces.</p></article>
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

  const colorForm = root.querySelector<HTMLFormElement>('#roleplay-color-settings')!
  const dialogueColor = root.querySelector<HTMLInputElement>('#rp-dialogue-color')!
  const actionColor = root.querySelector<HTMLInputElement>('#rp-action-color')!
  const narrationColor = root.querySelector<HTMLInputElement>('#rp-narration-color')!
  const colorInputs = [dialogueColor, actionColor, narrationColor]
  colorInputs.forEach((input) => input.addEventListener('input', () => {
    const code = input.parentElement?.querySelector('code')
    if (code) code.textContent = input.value.toUpperCase()
  }))
  colorForm.addEventListener('submit', (event) => {
    event.preventDefault()
    saveRoleplayTextColors({ dialogue: dialogueColor.value, action: actionColor.value, narration: narrationColor.value })
    toast(root, 'Roleplay text colors saved on this device.', 'normal')
  })
  root.querySelector<HTMLButtonElement>('#reset-roleplay-colors')?.addEventListener('click', () => {
    const defaults = resetRoleplayTextColors()
    dialogueColor.value = defaults.dialogue
    actionColor.value = defaults.action
    narrationColor.value = defaults.narration
    colorInputs.forEach((input) => {
      const code = input.parentElement?.querySelector('code')
      if (code) code.textContent = input.value.toUpperCase()
    })
    toast(root, 'Roleplay colors reset to Sandbox defaults.', 'normal')
  })

  const form = root.querySelector<HTMLFormElement>('#novelai-settings')!
  const tokenInput = root.querySelector<HTMLInputElement>('#nai-token')!
  const modelInput = root.querySelector<HTMLSelectElement>('#nai-model')!
  const maxTokensInput = root.querySelector<HTMLInputElement>('#nai-max-tokens')!
  const temperatureInput = root.querySelector<HTMLInputElement>('#nai-temperature')!
  let tokenWasMasked = Boolean(nai.token)

  tokenInput.addEventListener('focus', () => {
    if (tokenWasMasked && tokenInput.value === '••••••••••••') tokenInput.select()
  })
  tokenInput.addEventListener('input', () => { tokenWasMasked = false })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const token = tokenWasMasked && tokenInput.value === '••••••••••••' ? nai.token : tokenInput.value
    const saved = saveNovelAiRuntimeSettings({
      token,
      model: modelInput.value as WorldRuntimeNovelAiModel,
      maxTokens: Number(maxTokensInput.value),
      temperature: Number(temperatureInput.value),
    })
    maxTokensInput.value = String(saved.maxTokens)
    temperatureInput.value = String(saved.temperature)
    if (saved.token) {
      tokenInput.value = '••••••••••••'
      tokenWasMasked = true
    }
    toast(root, 'NovelAI settings saved on this device.', 'normal')
  })

  root.querySelector<HTMLButtonElement>('#clear-nai-token')?.addEventListener('click', () => {
    clearNovelAiToken()
    tokenInput.value = ''
    tokenWasMasked = false
    toast(root, 'NovelAI token removed from this device.', 'normal')
  })
}
