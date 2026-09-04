import { CanonicalPublicWorldRepository } from '../data/canonical-public-worlds.ts'
import { LocalWorldRepository } from '../data/repositories.ts'
import { worldTimeWeatherOf, type WorldRecord } from '../domain/world.ts'
import { advanceWorldRuntimeClock, createWorldRuntimeClock, worldRuntimeTimeSnapshot, type WorldRuntimeClock } from './world-time-runtime.ts'
import { getRoleplayLayout } from './roleplay-layout-settings.ts'
import type { WorldRuntimeMessage, WorldRuntimeSession } from './world-brain.ts'

type RuntimeHudSession = WorldRuntimeSession & {
  clock?: WorldRuntimeClock
  weather?: {
    condition?: string
    intensity?: string
    temperatureBand?: string
    wind?: string
  }
  travel?: {
    destinationLocationId?: string
    status?: string
    remainingMinutes?: number
    progress?: number
  }
}

const worlds = new LocalWorldRepository()
const publicWorlds = new CanonicalPublicWorldRepository()

function desktopCapable(): boolean {
  return window.matchMedia('(min-width: 1360px)').matches
    || window.matchMedia('(min-width: 1024px) and (orientation: landscape)').matches
}

function runtimeSession(worldId: string): RuntimeHudSession | undefined {
  try {
    const raw = localStorage.getItem(`hw.runtime.world.${worldId}.v1`)
    return raw ? JSON.parse(raw) as RuntimeHudSession : undefined
  } catch {
    return undefined
  }
}

function provisionalClock(world: WorldRecord, session?: RuntimeHudSession): WorldRuntimeClock {
  if (session?.clock) return session.clock
  const base = createWorldRuntimeClock(world, session?.createdAt)
  const settings = worldTimeWeatherOf(world)
  if (settings.mode !== 'tick') return base
  const turns = session?.history?.filter((message: WorldRuntimeMessage) => message.sender === 'player').length ?? 0
  return advanceWorldRuntimeClock(base, world, turns * settings.minutesPerInput, session?.updatedAt)
}

function locationInfo(world: WorldRecord, locationId?: string): { primary: string; secondary: string } {
  const current = world.locations.find((location) => location.id === locationId)
  if (!current) return { primary: 'Unspecified', secondary: world.identity.name }
  const parent = current.parentLocationId ? world.locations.find((location) => location.id === current.parentLocationId) : undefined
  return { primary: current.name, secondary: parent?.name || world.identity.name }
}

function card(label: string, icon: string, className = ''): HTMLElement {
  const section = document.createElement('section')
  section.className = `framed-world-card ${className}`.trim()
  section.innerHTML = `<header><span>${label}</span><i aria-hidden="true">${icon}</i></header><strong class="hud-primary"></strong><span class="hud-secondary"></span><span class="hud-tertiary"></span>`
  return section
}

async function worldFor(id: string): Promise<WorldRecord | undefined> {
  return (await worlds.get(id)) ?? (await publicWorlds.get(id))
}

async function refreshHud(runtime: HTMLElement): Promise<void> {
  const hud = runtime.querySelector<HTMLElement>('.framed-world-hud')
  if (!hud) return
  const worldId = runtime.dataset.worldId
  if (!worldId) return
  const world = await worldFor(worldId)
  if (!world) return
  const session = runtimeSession(worldId)
  const settings = worldTimeWeatherOf(world)
  const snapshot = worldRuntimeTimeSnapshot(provisionalClock(world, session), world)
  const place = locationInfo(world, session?.currentLocationId)

  const headerScene = runtime.querySelector<HTMLElement>('.framed-rp-scene')
  if (headerScene) headerScene.innerHTML = `<strong>${place.primary}</strong><span>${world.identity.name}</span>`

  const time = hud.querySelector<HTMLElement>('.framed-world-card.time')!
  time.querySelector<HTMLElement>('.hud-primary')!.textContent = `${String(snapshot.hour).padStart(2, '0')}:${String(snapshot.minute).padStart(2, '0')}`
  time.querySelector<HTMLElement>('.hud-secondary')!.textContent = `Day ${snapshot.day}${snapshot.season ? ` · ${snapshot.season.name}` : ''}`
  time.querySelector<HTMLElement>('.hud-tertiary')!.textContent = snapshot.seasonDay ? `Season day ${snapshot.seasonDay}` : ''

  const location = hud.querySelector<HTMLElement>('.framed-world-card.location')!
  location.querySelector<HTMLElement>('.hud-primary')!.textContent = place.primary
  location.querySelector<HTMLElement>('.hud-secondary')!.textContent = place.secondary
  location.querySelector<HTMLElement>('.hud-tertiary')!.textContent = world.locations.find((item) => item.id === session?.currentLocationId)?.kind || ''

  const weather = hud.querySelector<HTMLElement>('.framed-world-card.weather')!
  const condition = session?.weather?.condition
  weather.querySelector<HTMLElement>('.hud-primary')!.textContent = condition || (settings.weatherMode === 'real_world' ? 'Real-world linked' : 'Simulated weather')
  weather.querySelector<HTMLElement>('.hud-secondary')!.textContent = [session?.weather?.intensity, session?.weather?.temperatureBand].filter(Boolean).join(' · ') || settings.climate || 'Climate not set'
  weather.querySelector<HTMLElement>('.hud-tertiary')!.textContent = session?.weather?.wind || (settings.weatherMode === 'real_world' && settings.realWorldLocation ? settings.realWorldLocation : 'Persistent weather state will appear here')

  const travel = hud.querySelector<HTMLElement>('.framed-world-card.travel')!
  if (session?.travel && session.travel.status && session.travel.status !== 'arrived') {
    travel.hidden = false
    const destination = world.locations.find((item) => item.id === session.travel?.destinationLocationId)
    travel.querySelector<HTMLElement>('.hud-primary')!.textContent = destination?.name || 'Travelling'
    travel.querySelector<HTMLElement>('.hud-secondary')!.textContent = session.travel.status
    travel.querySelector<HTMLElement>('.hud-tertiary')!.textContent = Number.isFinite(session.travel.remainingMinutes) ? `${Math.max(0, Math.round(session.travel.remainingMinutes!))} min remaining` : ''
    const progress = travel.querySelector<HTMLElement>('.framed-travel-progress b')
    if (progress) progress.style.width = `${Math.max(0, Math.min(100, (session.travel.progress ?? 0) * 100))}%`
  } else {
    travel.hidden = true
  }
}

function buildHud(): HTMLElement {
  const hud = document.createElement('aside')
  hud.className = 'framed-world-hud'
  hud.setAttribute('aria-label', 'World state')
  hud.append(card('WORLD TIME', '◷', 'time'), card('LOCATION', '⌖', 'location'), card('WEATHER', '☁', 'weather'))
  const travel = card('TRAVEL', '↗', 'travel')
  travel.hidden = true
  const progress = document.createElement('div')
  progress.className = 'framed-travel-progress'
  progress.innerHTML = '<b></b>'
  travel.append(progress)
  hud.append(travel)
  return hud
}

function enhance(runtime: HTMLElement): void {
  if (runtime.classList.contains('framed-hud-active') || getRoleplayLayout() !== 'framed-hud' || !desktopCapable()) return
  const story = runtime.querySelector<HTMLElement>('.world-runtime-story')
  const prompt = runtime.querySelector<HTMLElement>('.world-runtime-prompt')
  const rs = runtime.querySelector<HTMLElement>('.world-runtime-rs')
  if (!story || !prompt || !rs) return

  runtime.classList.add('framed-hud-active')

  const header = document.createElement('header')
  header.className = 'framed-rp-header'
  header.innerHTML = `<div class="framed-rp-brand"><img src="/hw-logo.png" alt=""><span>The Howling Whispers</span></div><div class="framed-rp-scene"><strong>World Runtime</strong><span>Loading location</span></div><div class="framed-rp-header-actions">WORLD RUNTIME</div>`

  const center = document.createElement('section')
  center.className = 'framed-rp-center'
  center.setAttribute('aria-label', 'Roleplay console')
  center.append(story, prompt)

  runtime.append(header, center, buildHud())
  void refreshHud(runtime)

  const storyObserver = new MutationObserver(() => void refreshHud(runtime))
  storyObserver.observe(story, { childList: true, subtree: true })
  ;(runtime as HTMLElement & { _framedHudObserver?: MutationObserver })._framedHudObserver = storyObserver
}

function restore(runtime: HTMLElement): void {
  if (!runtime.classList.contains('framed-hud-active')) return
  const story = runtime.querySelector<HTMLElement>('.world-runtime-story')
  const prompt = runtime.querySelector<HTMLElement>('.world-runtime-prompt')
  const center = runtime.querySelector<HTMLElement>('.framed-rp-center')
  const observerRuntime = runtime as HTMLElement & { _framedHudObserver?: MutationObserver }
  observerRuntime._framedHudObserver?.disconnect()
  delete observerRuntime._framedHudObserver
  if (story) runtime.append(story)
  if (prompt) runtime.append(prompt)
  center?.remove()
  runtime.querySelector('.framed-rp-header')?.remove()
  runtime.querySelector('.framed-world-hud')?.remove()
  runtime.classList.remove('framed-hud-active')
}

function reconcile(): void {
  const runtime = document.querySelector<HTMLElement>('.world-runtime')
  if (!runtime) return
  if (getRoleplayLayout() === 'framed-hud' && desktopCapable()) enhance(runtime)
  else restore(runtime)
}

export function installFramedRoleplayLayout(): void {
  const observer = new MutationObserver(() => reconcile())
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', reconcile)
  window.addEventListener('hw:roleplay-layout-changed', reconcile)
  reconcile()
}
