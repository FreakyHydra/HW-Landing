import type { AppContext, Navigate } from '../app/router'
import { escapeHtml, uid } from '../app/html'
import { shell, toast } from '../app/shell'
import { copyPublicWorldForLocal } from '../data/public-worlds'
import type { WorldRecord } from '../domain/world'
import type { WorldRuntimeSession } from '../runtime/world-brain'

function savedSession(worldId: string): WorldRuntimeSession | undefined {
  try {
    const value = localStorage.getItem(`hw.runtime.world.${worldId}.v1`)
    return value ? JSON.parse(value) as WorldRuntimeSession : undefined
  } catch { return undefined }
}

function formatSessionAge(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved session'
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function backupFilename(world: WorldRecord): string {
  const safeName = (world.identity.name || 'world')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'world'
  const date = new Date().toISOString().slice(0, 10)
  return `${safeName}-${date}.hw-world.json`
}

function downloadWorldBackup(world: WorldRecord): void {
  const payload = {
    format: 'hw-world-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    world,
    runtimeSession: savedSession(world.id) ?? null,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = backupFilename(world)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function worldCard(world: WorldRecord, source: 'public' | 'local', selection?: { tab: string; action: string }): string {
  const worldId = encodeURIComponent(world.id)
  const manageUrl = `/forge/worlds/edit/${worldId}/${selection ? `?tab=${selection.tab}` : ''}`
  const enterUrl = `/roleplay/world/${worldId}/`
  const session = savedSession(world.id)
  const sourceLabel = source === 'public' ? 'PUBLIC STARTER' : 'LOCAL WORLD'
  const runtimeActions = session
    ? `<a class="machine-button primary" href="${enterUrl}" data-nav>RESUME</a><button class="machine-button" type="button" data-reset-world="${worldId}" data-world-name="${escapeHtml(world.identity.name)}">START OVER</button>`
    : `<a class="machine-button primary" href="${enterUrl}" data-nav>OPEN WORLD</a>`
  const actions = source === 'public'
    ? `${runtimeActions}<button class="machine-button" type="button" data-copy-public-world="${worldId}">COPY TO LIBRARY</button>`
    : `${runtimeActions}<a class="machine-button" href="${manageUrl}" data-nav>${selection?.action || 'MANAGE WORLD'}</a><button class="machine-button" type="button" data-download-world="${worldId}">DOWNLOAD BACKUP</button>`

  return `
    <article class="world-card instrument-panel compact-world-card">
      <div class="world-sigil"><span>${escapeHtml(world.identity.name.slice(0, 1).toUpperCase() || 'W')}</span><i></i></div>
      <div class="world-card-copy">
        <p class="eyebrow">${escapeHtml(world.identity.genre || 'UNCLASSIFIED REALITY')} · ${sourceLabel}</p>
        <h2>${escapeHtml(world.identity.name || 'Untitled world')}</h2>
        <p class="world-card-description">${escapeHtml(world.identity.description || 'No world description yet.')}</p>
        <div class="world-counts"><span>${world.locations.length} places</span><span>${world.societies.length} societies</span><span>${world.families.length} families</span><span>${world.factions.length} factions</span><span>${world.memories.length} memories</span>${session ? `<span>Saved ${formatSessionAge(session.updatedAt)}</span>` : ''}</div>
      </div>
      <div class="card-actions">${actions}</div>
    </article>`
}

function recentSessionCard(world: WorldRecord, session: WorldRuntimeSession): string {
  const worldId = encodeURIComponent(world.id)
  const location = world.locations.find((item) => item.id === session.currentLocationId)
  const turns = session.history.filter((message) => message.sender === 'player').length
  return `<a class="recent-world-session" href="/roleplay/world/${worldId}/" data-nav>
    <span class="recent-world-mark">${escapeHtml(world.identity.name.slice(0, 1).toUpperCase() || 'W')}</span>
    <span class="recent-world-copy"><strong>${escapeHtml(world.identity.name)}</strong><small>${escapeHtml(location?.name || 'Location not established')} · ${turns} ${turns === 1 ? 'turn' : 'turns'} · ${formatSessionAge(session.updatedAt)}</small></span>
    <b>RESUME →</b>
  </a>`
}

export async function renderWorldLibrary(root: HTMLElement, context: AppContext, navigate: Navigate): Promise<void> {
  const [worlds, publicWorlds] = await Promise.all([context.worlds.list(), context.publicWorlds.list()])
  const section = new URLSearchParams(location.search).get('section')
  const sections: Record<string, { tab: string; title: string; eyebrow: string; action: string }> = {
    lore: { tab: 'lore', title: 'World Lore', eyebrow: 'SELECT A ROOT REALITY', action: 'MANAGE LORE' },
    places: { tab: 'places', title: 'World Locations', eyebrow: 'SELECT A ROOT REALITY', action: 'MANAGE LOCATIONS' },
    people: { tab: 'people', title: 'World Factions', eyebrow: 'SELECT A ROOT REALITY', action: 'MANAGE PEOPLE' },
    societies: { tab: 'societies', title: 'Peoples & Societies', eyebrow: 'SELECT A ROOT REALITY', action: 'MANAGE SOCIETIES' },
    families: { tab: 'families', title: 'World Families', eyebrow: 'SELECT A ROOT REALITY', action: 'MANAGE FAMILIES' },
    memory: { tab: 'memory', title: 'World Memory', eyebrow: 'SELECT A ROOT REALITY', action: 'MANAGE TIMELINE' },
  }
  const selection = section ? sections[section] : undefined
  const totalWorlds = worlds.length + publicWorlds.length
  const allWorlds = [...publicWorlds, ...worlds]
  const uniqueWorlds = [...new Map(allWorlds.map((world) => [world.id, world])).values()]
  const recentSessions = uniqueWorlds
    .map((world) => ({ world, session: savedSession(world.id) }))
    .filter((item): item is { world: WorldRecord; session: WorldRuntimeSession } => Boolean(item.session))
    .sort((a, b) => new Date(b.session.updatedAt).getTime() - new Date(a.session.updatedAt).getTime())

  root.innerHTML = shell('/forge/worlds/', `
    ${recentSessions.length ? `<section class="recent-worlds instrument-panel"><header class="module-title"><div><p class="eyebrow">CONTINUE PLAYING</p><h2>Opened worlds</h2></div><small>${recentSessions.length} SAVED ${recentSessions.length === 1 ? 'WORLD' : 'WORLDS'}</small></header><p class="module-intro">Jump between worlds without resetting them. Each world keeps its own conversation and current location.</p><div class="recent-world-list">${recentSessions.map(({ world, session }) => recentSessionCard(world, session)).join('')}</div></section>` : ''}
    <section class="library-toolbar">
      <div><p>${totalWorlds} ${totalWorlds === 1 ? 'living reality' : 'living realities'} · ${publicWorlds.length} public starter${publicWorlds.length === 1 ? '' : 's'}</p></div>
      <a class="machine-button primary" href="/forge/worlds/create/" data-nav>CREATE WORLD</a>
    </section>
    <section class="world-library-grid">
      ${publicWorlds.map((world) => worldCard(world, 'public', selection)).join('')}
      ${worlds.map((world) => worldCard(world, 'local', selection)).join('')}
      ${totalWorlds ? '' : `<div class="empty-state instrument-panel world-empty"><span>◎</span><h2>Create the reality first</h2><p>Define the world, its rules, people and remembered history before creating anyone inside it.</p><a class="machine-button primary" href="/forge/worlds/create/" data-nav>CREATE FIRST WORLD</a></div>`}
    </section>
  `, selection?.title || 'World Library', selection?.eyebrow || 'FORGE · ROOT REALITIES')

  root.querySelectorAll<HTMLButtonElement>('[data-reset-world]').forEach((button) => {
    button.addEventListener('click', () => {
      const worldId = decodeURIComponent(button.dataset.resetWorld || '')
      const worldName = button.dataset.worldName || 'this world'
      const accepted = window.confirm(`Start ${worldName} over?\n\nThis deletes only this world's current conversation. Other opened worlds are kept.`)
      if (!accepted) return
      navigate(`/roleplay/world/${encodeURIComponent(worldId)}/?new=1`)
    })
  })

  root.querySelectorAll<HTMLButtonElement>('[data-download-world]').forEach((button) => {
    button.addEventListener('click', () => {
      const worldId = decodeURIComponent(button.dataset.downloadWorld || '')
      const world = worlds.find((item) => item.id === worldId)
      if (!world) return toast(root, 'World could not be found for backup.', 'error')
      downloadWorldBackup(world)
      toast(root, `${world.identity.name} backup downloaded.`, 'normal')
    })
  })

  root.querySelectorAll<HTMLButtonElement>('[data-copy-public-world]').forEach((button) => {
    button.addEventListener('click', async () => {
      const publicWorldId = decodeURIComponent(button.dataset.copyPublicWorld || '')
      const publicWorld = await context.publicWorlds.get(publicWorldId)
      if (!publicWorld) return toast(root, 'Public world could not be found.', 'error')
      const localCopy = copyPublicWorldForLocal(publicWorld, uid('world'))
      await context.worlds.save(localCopy)
      toast(root, `${publicWorld.identity.name} copied to your local library.`, 'normal')
      navigate(`/forge/worlds/edit/${encodeURIComponent(localCopy.id)}/`)
    })
  })
}

export async function renderWorldSelectionForCharacter(root: HTMLElement, context: AppContext): Promise<void> {
  const worlds = await context.worlds.list()
  root.innerHTML = shell('/forge/characters/create/', `
    <section class="world-selection instrument-panel">
      <header><p class="eyebrow">WORLD REQUIRED</p><h2>Where does this character belong?</h2><p>The world provides species, places, families, factions, history and rules before the first character field is written.</p></header>
      <div class="selection-grid">
        ${worlds.map((world) => `<a href="/forge/characters/create/?world=${encodeURIComponent(world.id)}" data-nav class="selection-card"><span class="selection-mark">${escapeHtml(world.identity.name.slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(world.identity.name)}</strong><small>${escapeHtml(world.identity.genre || 'Living reality')}</small></div><b>SELECT →</b></a>`).join('')}
        <a href="/forge/worlds/create/" data-nav class="selection-card create-selection"><span class="selection-mark">+</span><div><strong>Create a world</strong><small>Begin with the reality container</small></div><b>CREATE →</b></a>
      </div>
    </section>
  `, 'Select a World', 'CHARACTER FORGE · FIRST STEP')
}