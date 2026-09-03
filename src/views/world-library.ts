import type { AppContext } from '../app/router'
import { escapeHtml } from '../app/html'
import { shell } from '../app/shell'

export async function renderWorldLibrary(root: HTMLElement, context: AppContext): Promise<void> {
  const worlds = await context.worlds.list()
  const section = new URLSearchParams(location.search).get('section')
  const sections: Record<string, { tab: string; title: string; eyebrow: string; action: string }> = {
    lore: { tab: 'lore', title: 'World Lore', eyebrow: 'SELECT A ROOT REALITY', action: 'OPEN LORE' },
    places: { tab: 'places', title: 'World Locations', eyebrow: 'SELECT A ROOT REALITY', action: 'OPEN LOCATIONS' },
    people: { tab: 'people', title: 'World Factions', eyebrow: 'SELECT A ROOT REALITY', action: 'OPEN PEOPLE' },
    societies: { tab: 'societies', title: 'Peoples & Societies', eyebrow: 'SELECT A ROOT REALITY', action: 'OPEN SOCIETIES' },
    families: { tab: 'families', title: 'World Families', eyebrow: 'SELECT A ROOT REALITY', action: 'OPEN FAMILIES' },
    memory: { tab: 'memory', title: 'World Memory', eyebrow: 'SELECT A ROOT REALITY', action: 'OPEN TIMELINE' },
  }
  const selection = section ? sections[section] : undefined
  root.innerHTML = shell('/forge/worlds/', `
    <section class="library-toolbar">
      <div><p>${worlds.length} ${worlds.length === 1 ? 'living reality' : 'living realities'}</p></div>
      <a class="machine-button primary" href="/forge/worlds/create/" data-nav>CREATE WORLD</a>
    </section>
    <section class="world-library-grid">
      ${worlds.length ? worlds.map((world) => `
        <article class="world-card instrument-panel">
          <div class="world-sigil"><span>${escapeHtml(world.identity.name.slice(0, 1).toUpperCase() || 'W')}</span><i></i></div>
          <div class="world-card-copy">
            <p class="eyebrow">${escapeHtml(world.identity.genre || 'UNCLASSIFIED REALITY')}</p>
            <h2>${escapeHtml(world.identity.name || 'Untitled world')}</h2>
            <p>${escapeHtml(world.identity.description || 'No world description yet.')}</p>
            <div class="world-counts"><span>${world.locations.length} places</span><span>${world.societies.length} societies</span><span>${world.families.length} families</span><span>${world.factions.length} factions</span><span>${world.memories.length} memories</span></div>
          </div>
          <div class="card-actions"><a class="machine-button primary" href="/forge/worlds/edit/${encodeURIComponent(world.id)}/${selection ? `?tab=${selection.tab}` : ''}" data-nav>${selection?.action || 'OPEN WORLD'}</a><a class="machine-button" href="/forge/characters/create/?world=${encodeURIComponent(world.id)}" data-nav>CREATE CHARACTER</a></div>
        </article>`).join('') : `
        <div class="empty-state instrument-panel world-empty"><span>◎</span><h2>Create the reality first</h2><p>Define the world, its rules, people and remembered history before creating anyone inside it.</p><a class="machine-button primary" href="/forge/worlds/create/" data-nav>CREATE FIRST WORLD</a></div>`}
    </section>
  `, selection?.title || 'World Library', selection?.eyebrow || 'FORGE · ROOT REALITIES')
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
