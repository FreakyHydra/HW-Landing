import type { AppContext, Navigate } from '../app/router'
import { escapeHtml, uid } from '../app/html'
import { shell, toast } from '../app/shell'
import { copyPublicWorldForLocal } from '../data/public-worlds'
import type { WorldRecord } from '../domain/world'

function worldCard(world: WorldRecord, source: 'public' | 'local', selection?: { tab: string; action: string }): string {
  const worldId = encodeURIComponent(world.id)
  const manageUrl = `/forge/worlds/edit/${worldId}/${selection ? `?tab=${selection.tab}` : ''}`
  const enterUrl = `/roleplay/world/${worldId}/`
  const sourceLabel = source === 'public' ? 'PUBLIC STARTER' : 'LOCAL WORLD'
  const actions = source === 'public'
    ? `<a class="machine-button primary" href="${enterUrl}" data-nav>ENTER WORLD</a><button class="machine-button" type="button" data-copy-public-world="${worldId}">COPY TO LIBRARY</button>`
    : `<a class="machine-button primary" href="${enterUrl}" data-nav>ENTER WORLD</a><a class="machine-button" href="${manageUrl}" data-nav>${selection?.action || 'MANAGE WORLD'}</a>`

  return `
    <article class="world-card instrument-panel compact-world-card">
      <div class="world-sigil"><span>${escapeHtml(world.identity.name.slice(0, 1).toUpperCase() || 'W')}</span><i></i></div>
      <div class="world-card-copy">
        <p class="eyebrow">${escapeHtml(world.identity.genre || 'UNCLASSIFIED REALITY')} · ${sourceLabel}</p>
        <h2>${escapeHtml(world.identity.name || 'Untitled world')}</h2>
        <p class="world-card-description">${escapeHtml(world.identity.description || 'No world description yet.')}</p>
        <div class="world-counts"><span>${world.locations.length} places</span><span>${world.societies.length} societies</span><span>${world.families.length} families</span><span>${world.factions.length} factions</span><span>${world.memories.length} memories</span></div>
      </div>
      <div class="card-actions">${actions}</div>
    </article>`
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

  root.innerHTML = shell('/forge/worlds/', `
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
