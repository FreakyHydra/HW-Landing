import { defaultWorldTimeWeather, type WorldTimeWeather } from '../domain/world.ts'

const DRAFT_PREFIX = 'hw.forge.world-time-weather.'

function currentWorldId(): string | undefined {
  const match = location.pathname.match(/\/forge\/worlds\/edit\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

function readWorldTimeWeather(worldId: string): WorldTimeWeather {
  const defaults = defaultWorldTimeWeather()
  try {
    const draft = JSON.parse(localStorage.getItem(`${DRAFT_PREFIX}${worldId}`) || 'null') as Partial<WorldTimeWeather> | null
    if (draft) return { ...defaults, ...draft, seasons: draft.seasons ?? defaults.seasons }
    const worlds = JSON.parse(localStorage.getItem('hw.forge.worlds.v1') || '[]') as Array<{ id: string; timeWeather?: Partial<WorldTimeWeather> }>
    const world = worlds.find((item) => item.id === worldId)
    return { ...defaults, ...(world?.timeWeather ?? {}), seasons: world?.timeWeather?.seasons ?? defaults.seasons }
  } catch {
    return defaults
  }
}

function numberValue(form: HTMLFormElement, name: string, fallback: number): number {
  const control = form.elements.namedItem(name) as HTMLInputElement | null
  const value = Number(control?.value)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function selected(form: HTMLFormElement, name: string): string {
  return (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value || ''
}

function checked(form: HTMLFormElement, name: string): boolean {
  return Boolean((form.elements.namedItem(name) as HTMLInputElement | null)?.checked)
}

function input(label: string, name: string, value: string | number, type = 'text', min?: number, max?: number): string {
  const bounds = `${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''}`
  return `<label class="field-control"><span class="field-head">${label}</span><input name="${name}" type="${type}" value="${String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"${bounds}></label>`
}

function option(value: string, label: string, current: string): string {
  return `<option value="${value}"${value === current ? ' selected' : ''}>${label}</option>`
}

function seasonRows(settings: WorldTimeWeather): string {
  return settings.seasons.map((season, index) => `
    <div class="entity-composer" data-time-weather-season="${index}">
      <div class="field-grid compact-grid">
        ${input('Season name', `tw-season-name-${index}`, season.name)}
        ${input('Length in days', `tw-season-days-${index}`, season.lengthDays, 'number', 1, 100000)}
      </div>
      <label class="field-control"><span class="field-head">Season weather rules</span><textarea name="tw-season-prompt-${index}" rows="3" placeholder="Leave blank for normal seasonal logic.">${season.weatherPrompt}</textarea></label>
    </div>
  `).join('')
}

function buildPanel(settings: WorldTimeWeather): HTMLElement {
  const panel = document.createElement('section')
  panel.className = 'editor-panel instrument-panel'
  panel.dataset.worldPanel = 'time-weather'
  panel.hidden = true
  panel.innerHTML = `
    <header class="module-title"><div><p class="eyebrow">WORLD ENVIRONMENT</p><h2>Time & Weather</h2></div><small>TIME · SEASONS · CLIMATE</small></header>
    <p class="module-intro">Keep the defaults for a simple Earth-like world, or customize the clock, seasons and weather rules for this reality.</p>

    <section class="society-form-section">
      <p class="eyebrow">TIME</p>
      <div class="field-grid">
        <label class="field-control"><span class="field-head">Setup</span><select name="tw-preset">${option('simple','Simple',settings.preset)}${option('custom','Custom',settings.preset)}</select></label>
        <label class="field-control"><span class="field-head">Time progression</span><select name="tw-mode">${option('tick','Tick-based',settings.mode)}${option('realtime','Real-time',settings.mode)}</select></label>
        ${input('World minutes per player input', 'tw-minutes-input', settings.minutesPerInput, 'number', 1, 100000)}
        ${input('Hours per world day', 'tw-hours-day', settings.hoursPerDay, 'number', 1, 100000)}
        ${input('Simple mode: real minutes per day', 'tw-simple-day', settings.simpleDayRealMinutes, 'number', 1, 100000)}
        ${input('Starting world day', 'tw-start-day', settings.startingDay, 'number', 1, 1000000)}
        ${input('Starting hour', 'tw-start-hour', settings.startingHour, 'number', 0, Math.max(0, settings.hoursPerDay - 1))}
      </div>
      <label class="field-control"><span class="field-head">Persistence</span><span class="checkbox-row"><input name="tw-pause" type="checkbox" ${settings.pauseWhenInactive ? 'checked' : ''}> Pause world time when nobody is active</span></label>
    </section>

    <section class="society-form-section">
      <p class="eyebrow">SEASONS & CALENDAR</p>
      <label class="field-control"><span class="field-head">Season cycle</span><span class="checkbox-row"><input name="tw-seasons-enabled" type="checkbox" ${settings.seasonsEnabled ? 'checked' : ''}> Enable seasons</span></label>
      <div class="editor-stack" data-time-weather-seasons>${seasonRows(settings)}</div>
    </section>

    <section class="society-form-section">
      <p class="eyebrow">WEATHER</p>
      <div class="field-grid">
        <label class="field-control"><span class="field-head">Weather source</span><select name="tw-weather-mode">${option('simulated','Simulated',settings.weatherMode)}${option('real_world','Real-world synced',settings.weatherMode)}</select></label>
        ${input('Climate', 'tw-climate', settings.climate)}
        ${input('Real-world weather location', 'tw-real-location', settings.realWorldLocation)}
        ${input('Real-world influence %', 'tw-real-influence', settings.realWorldInfluence, 'number', 0, 100)}
      </div>
      <label class="field-control"><span class="field-head">World weather rules</span><textarea name="tw-weather-prompt" rows="6" placeholder="Leave blank for normal climate and seasonal logic.">${settings.weatherPrompt}</textarea></label>
    </section>
    <section class="inheritance-callout"><i class="lamp live"></i><div><strong>Blank prompts use basic world logic</strong><p>Custom prompts override or bend the default behavior. This is where a world can define unusual seasonal or weather rules.</p></div></section>
  `
  return panel
}

function readPanel(form: HTMLFormElement, previous: WorldTimeWeather): WorldTimeWeather {
  const seasons = previous.seasons.map((season, index) => ({
    ...season,
    name: selected(form, `tw-season-name-${index}`) || season.name,
    lengthDays: numberValue(form, `tw-season-days-${index}`, season.lengthDays),
    weatherPrompt: selected(form, `tw-season-prompt-${index}`),
  }))
  return {
    preset: selected(form, 'tw-preset') === 'custom' ? 'custom' : 'simple',
    mode: selected(form, 'tw-mode') === 'realtime' ? 'realtime' : 'tick',
    minutesPerInput: numberValue(form, 'tw-minutes-input', previous.minutesPerInput),
    hoursPerDay: numberValue(form, 'tw-hours-day', previous.hoursPerDay),
    simpleDayRealMinutes: numberValue(form, 'tw-simple-day', previous.simpleDayRealMinutes),
    pauseWhenInactive: checked(form, 'tw-pause'),
    startingDay: numberValue(form, 'tw-start-day', previous.startingDay),
    startingHour: Math.max(0, numberValue(form, 'tw-start-hour', previous.startingHour + 1) - 1),
    seasonsEnabled: checked(form, 'tw-seasons-enabled'),
    seasons,
    weatherMode: selected(form, 'tw-weather-mode') === 'real_world' ? 'real_world' : 'simulated',
    climate: selected(form, 'tw-climate'),
    weatherPrompt: selected(form, 'tw-weather-prompt'),
    realWorldLocation: selected(form, 'tw-real-location'),
    realWorldInfluence: Math.max(0, Math.min(100, Number(selected(form, 'tw-real-influence')) || 0)),
  }
}

function mount(): void {
  const form = document.querySelector<HTMLFormElement>('#world-form')
  const tabs = document.querySelector<HTMLElement>('.world-tabs')
  if (!form || !tabs || tabs.querySelector('[data-world-tab="time-weather"]')) return
  const worldId = currentWorldId()
  if (!worldId) return

  let settings = readWorldTimeWeather(worldId)
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.worldTab = 'time-weather'
  button.setAttribute('aria-selected', 'false')
  button.textContent = 'TIME & WEATHER'
  tabs.append(button)

  const panel = buildPanel(settings)
  form.append(panel)

  const activate = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-world-tab]').forEach((item) => {
      const active = item.dataset.worldTab === 'time-weather'
      item.classList.toggle('active', active)
      item.setAttribute('aria-selected', String(active))
    })
    document.querySelectorAll<HTMLElement>('[data-world-panel]').forEach((item) => { item.hidden = item.dataset.worldPanel !== 'time-weather' })
  }
  button.addEventListener('click', activate)

  panel.addEventListener('input', () => {
    settings = readPanel(form, settings)
    localStorage.setItem(`${DRAFT_PREFIX}${worldId}`, JSON.stringify(settings))
    const status = document.querySelector<HTMLElement>('#world-save-status')
    if (status) status.textContent = 'UNSAVED WORLD CHANGES'
  })

  document.querySelector('#save-world')?.addEventListener('click', () => {
    settings = readPanel(form, settings)
    localStorage.setItem(`${DRAFT_PREFIX}${worldId}`, JSON.stringify(settings))
  }, { capture: true })

  if (new URLSearchParams(location.search).get('tab') === 'time-weather') activate()
}

const observer = new MutationObserver(mount)
observer.observe(document.documentElement, { childList: true, subtree: true })
mount()

export function pendingWorldTimeWeather(worldId: string): WorldTimeWeather | undefined {
  try {
    const value = localStorage.getItem(`${DRAFT_PREFIX}${worldId}`)
    return value ? JSON.parse(value) as WorldTimeWeather : undefined
  } catch {
    return undefined
  }
}

export function clearPendingWorldTimeWeather(worldId: string): void {
  localStorage.removeItem(`${DRAFT_PREFIX}${worldId}`)
}
