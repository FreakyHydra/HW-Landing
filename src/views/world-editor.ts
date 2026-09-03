import type { AppContext, Navigate } from '../app/router'
import { escapeHtml, uid } from '../app/html'
import { shell, toast } from '../app/shell'
import { createEmptyWorld, validateWorld, worldContextSummary, type FamilyRelationshipKind, type WorldLocation, type WorldMemoryKind, type WorldMemoryVisibility, type WorldRecord } from '../domain/world'

function field(name: string, label: string, value: string, hint = '', rows = 0): string {
  const control = rows
    ? `<textarea name="${name}" rows="${rows}" placeholder="${escapeHtml(hint)}">${escapeHtml(value)}</textarea>`
    : `<input name="${name}" value="${escapeHtml(value)}" placeholder="${escapeHtml(hint)}" />`
  return `<label class="field-control"><span class="field-head">${escapeHtml(label)}</span>${control}</label>`
}

function option(value: string, label: string): string { return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>` }

function compactItem(kind: string, id: string, title: string, meta: string, description: string): string {
  return `<article class="entity-card"><div><p class="eyebrow">${escapeHtml(meta)}</p><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description || 'No description.')}</p></div><button class="icon-button" type="button" data-remove-kind="${kind}" data-remove-id="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(title)}">×</button></article>`
}

function familyMarkup(world: WorldRecord): string {
  if (!world.families.length) return '<p class="empty-note">Create a family before adding people or relationships.</p>'
  return world.families.map((family) => {
    const names = new Map(family.people.map((person) => [person.id, person.name]))
    return `<article class="family-card">
      <header><div><p class="eyebrow">FAMILY TREE</p><h3>${escapeHtml(family.name)}</h3><p>${escapeHtml(family.description)}</p></div><button class="icon-button" type="button" data-remove-kind="family" data-remove-id="${family.id}" aria-label="Remove ${escapeHtml(family.name)}">×</button></header>
      <div class="family-people">${family.people.length ? family.people.map((person) => `<span><i></i><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.description)}</small></span>`).join('') : '<small>No people linked yet.</small>'}</div>
      <div class="family-links">${family.relationships.length ? family.relationships.map((relationship) => `<p><strong>${escapeHtml(names.get(relationship.fromPersonId) || 'Unknown')}</strong><span>${escapeHtml(relationship.kind)}</span><strong>${escapeHtml(names.get(relationship.toPersonId) || 'Unknown')}</strong>${relationship.notes ? `<small>${escapeHtml(relationship.notes)}</small>` : ''}</p>`).join('') : '<small>No family relationships yet.</small>'}</div>
    </article>`
  }).join('')
}

function memoryMarkup(world: WorldRecord): string {
  const sorted = [...world.memories].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  return sorted.length ? sorted.map((memory) => `<article class="timeline-event"><div class="timeline-rail"><i></i></div><div><p class="eyebrow">${escapeHtml(memory.occurredAt || 'UNDATED')} · ${escapeHtml(memory.kind.replaceAll('_', ' '))}</p><h3>${escapeHtml(memory.title)}</h3><p>${escapeHtml(memory.description)}</p><div class="tag-row"><span>${escapeHtml(memory.visibility)}</span>${memory.persistentEffects.map((effect) => `<span>${escapeHtml(effect)}</span>`).join('')}</div></div><button class="icon-button" type="button" data-remove-kind="memory" data-remove-id="${memory.id}" aria-label="Remove ${escapeHtml(memory.title)}">×</button></article>`).join('') : '<p class="empty-note">The world has no recorded events yet.</p>'
}

function previewMarkup(world: WorldRecord): string {
  return `<div class="world-preview-sigil"><span>${escapeHtml(world.identity.name.slice(0, 1).toUpperCase() || 'W')}</span><i></i><i></i></div>
    <p class="eyebrow">LIVING REALITY CONTAINER</p><h2>${escapeHtml(world.identity.name || 'Untitled world')}</h2><p class="interpretation">${escapeHtml(world.identity.description || 'Define the reality that every character will grow inside.')}</p>
    <div class="context-stack">${worldContextSummary(world).map((line) => `<p>${escapeHtml(line)}</p>`).join('') || '<p>World context has not been defined yet.</p>'}</div>
    <div class="world-preview-counts"><span><b>${world.species.length}</b>Species</span><span><b>${world.locations.length}</b>Places</span><span><b>${world.families.length}</b>Families</span><span><b>${world.memories.length}</b>Memories</span></div>`
}

export async function renderWorldEditor(root: HTMLElement, context: AppContext, navigate: Navigate, id?: string): Promise<void> {
  const existing = id ? await context.worlds.get(id) : undefined
  if (id && !existing) {
    root.innerHTML = shell(location.pathname, '<section class="empty-state instrument-panel"><h2>World not found</h2><a class="machine-button" href="/forge/worlds/" data-nav>RETURN TO WORLDS</a></section>', 'World not found')
    return
  }
  const world = existing ?? createEmptyWorld(uid('world'))
  const characters = (await context.characters.list()).filter((record) => record.worldId === world.id)

  root.innerHTML = shell(location.pathname, `
    <section class="editor-toolbar instrument-panel"><a href="/forge/worlds/" data-nav class="text-link">← WORLD LIBRARY</a><div class="editor-status"><i class="lamp live"></i><span id="world-save-status">WORLD ROOT · LOCAL DRAFT</span></div><div class="action-row">${id ? `<a class="machine-button" href="/forge/characters/create/?world=${world.id}" data-nav>CREATE CHARACTER HERE</a>` : '<button class="machine-button" disabled>SAVE WORLD FIRST</button>'}<button class="machine-button primary" id="save-world">SAVE WORLD</button></div></section>
    <nav class="editor-tabs world-tabs" aria-label="World editor sections" role="tablist">
      <button type="button" class="active" data-world-tab="identity" aria-selected="true">IDENTITY</button>
      <button type="button" data-world-tab="lore" aria-selected="false">LORE</button>
      <button type="button" data-world-tab="places" aria-selected="false">PLACES</button>
      <button type="button" data-world-tab="people" aria-selected="false">PEOPLE</button>
      <button type="button" data-world-tab="families" aria-selected="false">FAMILY TREES</button>
      <button type="button" data-world-tab="memory" aria-selected="false">MEMORY & TIMELINE</button>
      <button type="button" data-world-tab="rules" aria-selected="false">RULES</button>
    </nav>
    <div class="world-workbench">
      <form class="editor-stack" id="world-form" novalidate>
        <section class="editor-panel instrument-panel" data-world-panel="identity">
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 01</p><h2>Identity</h2></div><small>THE REALITY CONTAINER</small></header>
          <div class="field-grid">${field('world-name', 'World name', world.identity.name, 'Bitterroot')}${field('world-genre', 'Genre', world.identity.genre, 'Dark fantasy')}${field('world-tone', 'Tone', world.identity.tone, 'Intimate, dangerous, hopeful')}</div>
          ${field('world-description', 'Description', world.identity.description, 'What kind of living reality is this?', 7)}
          <section class="inheritance-callout"><i class="lamp live"></i><div><strong>${characters.length} characters belong here</strong><p>Characters reference this world and inherit only the context relevant to their place, family, faction and knowledge.</p></div></section>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="lore" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 02</p><h2>Lore</h2></div><small>HISTORY · CULTURE · FACT</small></header>
          ${field('lore-history', 'History', world.lore.history, 'The past that shaped the present...', 8)}${field('lore-cultures', 'Cultures', world.lore.cultures, 'Cultures, groups and ways of life...', 7)}${field('lore-customs', 'Customs', world.lore.customs, 'Traditions, expectations and rituals...', 6)}${field('lore-facts', 'Important facts', world.lore.importantFacts.join('\n'), 'One durable fact per line...', 6)}
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="places" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 03</p><h2>Locations</h2></div><small>REGIONS · TOWNS · BUILDINGS</small></header>
          <div class="entity-composer"><div class="field-grid compact-grid">${field('location-name', 'Name', '', 'Whispering Woods')}<label class="field-control"><span class="field-head">Kind</span><select name="location-kind">${(['region','town','building','landmark','other'] as const).map((kind) => option(kind, kind)).join('')}</select></label><label class="field-control"><span class="field-head">Inside location</span><select name="location-parent"><option value="">No parent</option>${world.locations.map((location) => option(location.id, location.name)).join('')}</select></label></div>${field('location-description', 'Description', '', 'What is important about this place?', 3)}<button type="button" class="machine-button primary" data-add="location">ADD LOCATION</button></div>
          <div class="entity-list">${world.locations.length ? world.locations.map((location) => compactItem('location', location.id, location.name, location.kind, location.description)).join('') : '<p class="empty-note">No locations yet.</p>'}</div>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="people" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 04</p><h2>People of the world</h2></div><small>SPECIES · FACTIONS</small></header>
          <div class="split-composers">
            <div class="entity-composer"><h3>Species</h3>${field('species-name', 'Name', '', 'Fox')}${field('species-description', 'World definition', '', 'How this species exists in this reality...', 3)}<button type="button" class="machine-button primary" data-add="species">ADD SPECIES</button></div>
            <div class="entity-composer"><h3>Faction</h3>${field('faction-name', 'Name', '', 'River Watch')}${field('faction-description', 'Purpose and influence', '', 'What they want and where they hold power...', 3)}<button type="button" class="machine-button primary" data-add="faction">ADD FACTION</button></div>
          </div>
          <div class="entity-columns"><div><p class="eyebrow">SPECIES INDEX</p>${world.species.map((item) => compactItem('species', item.id, item.name, 'species', item.description)).join('') || '<p class="empty-note">No species defined.</p>'}</div><div><p class="eyebrow">FACTION INDEX</p>${world.factions.map((item) => compactItem('faction', item.id, item.name, 'faction', item.description)).join('') || '<p class="empty-note">No factions defined.</p>'}</div></div>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="families" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 05</p><h2>Families & trees</h2></div><small>FIRST-CLASS RELATIONSHIPS</small></header>
          <div class="family-composers">
            <div class="entity-composer"><h3>Create family</h3>${field('family-name', 'Family name', '', 'Whiteclaw')}${field('family-description', 'Family identity', '', 'History, reputation or role...', 3)}<button type="button" class="machine-button primary" data-add="family">ADD FAMILY</button></div>
            <div class="entity-composer"><h3>Add person</h3><label class="field-control"><span class="field-head">Family</span><select name="person-family"><option value="">Select family</option>${world.families.map((family) => option(family.id, family.name)).join('')}</select></label>${field('person-name', 'Name', '', 'Heather Whiteclaw')}${field('person-description', 'Place in family', '', 'Parent, founder, missing relative...', 2)}<button type="button" class="machine-button primary" data-add="person">ADD PERSON</button></div>
            <div class="entity-composer relationship-composer"><h3>Connect people</h3><label class="field-control"><span class="field-head">Family</span><select name="link-family" id="link-family"><option value="">Select family</option>${world.families.map((family) => option(family.id, family.name)).join('')}</select></label><div class="field-grid compact-grid"><label class="field-control"><span class="field-head">First person</span><select name="link-from"><option value="">Select person</option>${world.families.flatMap((family) => family.people.map((person) => option(`${family.id}:${person.id}`, `${family.name} · ${person.name}`))).join('')}</select></label><label class="field-control"><span class="field-head">Relationship</span><select name="link-kind">${(['parent','partner','sibling','guardian'] as FamilyRelationshipKind[]).map((kind) => option(kind, kind)).join('')}</select></label><label class="field-control"><span class="field-head">Second person</span><select name="link-to"><option value="">Select person</option>${world.families.flatMap((family) => family.people.map((person) => option(`${family.id}:${person.id}`, `${family.name} · ${person.name}`))).join('')}</select></label></div>${field('link-notes', 'Relationship notes', '', 'Optional history or nuance')}<button type="button" class="machine-button primary" data-add="relationship">CONNECT PEOPLE</button></div>
          </div>
          <div class="family-list">${familyMarkup(world)}</div>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="memory" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 06</p><h2>World memory</h2></div><small>EVENTS THAT REMAIN TRUE</small></header>
          <div class="entity-composer"><div class="field-grid compact-grid">${field('memory-title', 'Event', '', 'The bridge burned down')}<label class="field-control"><span class="field-head">Kind</span><select name="memory-kind">${(['event','discovery','death','conflict','persistent_change'] as WorldMemoryKind[]).map((kind) => option(kind, kind.replaceAll('_',' '))).join('')}</select></label>${field('memory-date', 'World date', '', 'Year 17, first winter')}<label class="field-control"><span class="field-head">Visibility</span><select name="memory-visibility">${(['common','regional','faction','family','private','disputed'] as WorldMemoryVisibility[]).map((visibility) => option(visibility, visibility)).join('')}</select></label></div>${field('memory-description', 'What happened', '', 'Record the event as a durable world fact...', 4)}<div class="world-reference-grid memory-scope"><label class="field-control"><span class="field-head">Affected locations</span><select name="memory-locations" multiple>${world.locations.map((location) => option(location.id, location.name)).join('')}</select></label><label class="field-control"><span class="field-head">Affected factions</span><select name="memory-factions" multiple>${world.factions.map((faction) => option(faction.id, faction.name)).join('')}</select></label><label class="field-control"><span class="field-head">Affected families</span><select name="memory-families" multiple>${world.families.map((family) => option(family.id, family.name)).join('')}</select></label><label class="field-control"><span class="field-head">Affected characters</span><select name="memory-characters" multiple>${characters.map((character) => option(character.id, character.cardV2.data.name || 'Untitled character')).join('')}</select></label></div>${field('memory-effects', 'Persistent effects', '', 'One lasting consequence per line...', 3)}<button type="button" class="machine-button primary" data-add="memory">RECORD WORLD MEMORY</button></div>
          <div class="timeline-list">${memoryMarkup(world)}</div>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="rules" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 07</p><h2>Rules</h2></div><small>THE CONSTRAINTS OF REALITY</small></header>
          ${field('rule-technology', 'Technology', world.rules.technology, 'Pre-industrial tools, transport and medicine...', 5)}${field('rule-magic', 'Magic / physics', world.rules.magicPhysics, 'What is possible, impossible or costly...', 5)}${field('rule-society', 'Society', world.rules.society, 'Law, hierarchy, economy and social structure...', 5)}${field('rule-constraints', 'Other constraints', world.rules.constraints.join('\n'), 'One authoritative rule per line...', 5)}
        </section>
      </form>

      <aside class="preview-rail instrument-panel world-preview" aria-label="World context preview"><header class="panel-heading"><div><p class="eyebrow">INHERITANCE VIEW</p><h2>World context</h2></div><div class="status-cluster"><i class="lamp live"></i>ROOT</div></header><div id="world-preview">${previewMarkup(world)}</div></aside>
    </div>
  `, id ? (world.identity.name || 'Edit World') : 'Create World', 'WORLD FORGE · ROOT OBJECT')

  const form = root.querySelector<HTMLFormElement>('#world-form')!
  const input = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
  const lines = (name: string) => input(name).split('\n').map((line) => line.trim()).filter(Boolean)
  const selected = (name: string) => [...(form.elements.namedItem(name) as HTMLSelectElement).selectedOptions].map((item) => item.value)

  function syncCore(): void {
    world.identity = { name: input('world-name'), genre: input('world-genre'), tone: input('world-tone'), description: input('world-description') }
    world.lore = { history: input('lore-history'), cultures: input('lore-cultures'), customs: input('lore-customs'), importantFacts: lines('lore-facts') }
    world.rules = { technology: input('rule-technology'), magicPhysics: input('rule-magic'), society: input('rule-society'), constraints: lines('rule-constraints') }
    world.updatedAt = new Date().toISOString()
  }

  async function persistAndReopen(tab?: string): Promise<void> {
    syncCore()
    await context.worlds.save(world)
    const path = `/forge/worlds/edit/${world.id}/${tab ? `?tab=${tab}` : ''}`
    navigate(path)
  }

  function activateTab(name: string): void {
    root.querySelectorAll<HTMLButtonElement>('[data-world-tab]').forEach((button) => { const active = button.dataset.worldTab === name; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)) })
    root.querySelectorAll<HTMLElement>('[data-world-panel]').forEach((panel) => { panel.hidden = panel.dataset.worldPanel !== name })
  }
  root.querySelectorAll<HTMLButtonElement>('[data-world-tab]').forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.worldTab!)))
  const requestedTab = new URLSearchParams(location.search).get('tab')
  if (requestedTab) activateTab(requestedTab)

  form.addEventListener('input', (event) => {
    if ((event.target as HTMLElement).closest('.entity-composer')) return
    syncCore()
    root.querySelector('#world-save-status')!.textContent = 'UNSAVED WORLD CHANGES'
    root.querySelector('#world-preview')!.innerHTML = previewMarkup(world)
  })

  root.querySelector('#save-world')?.addEventListener('click', async () => {
    syncCore()
    const result = validateWorld(world)
    if (!result.success) return toast(root, result.errors[0], 'error')
    await context.worlds.save(world)
    toast(root, 'World saved')
    if (!id) navigate(`/forge/worlds/edit/${world.id}/`)
    else root.querySelector('#world-save-status')!.textContent = 'WORLD ROOT SAVED'
  })

  root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((button) => button.addEventListener('click', async () => {
    syncCore()
    if (!world.identity.name.trim()) return toast(root, 'Name and save the world before adding its contents.', 'error')
    const kind = button.dataset.add
    if (kind === 'location') {
      const name = input('location-name').trim(); if (!name) return toast(root, 'Location name is required.', 'error')
      world.locations.push({ id: uid('location'), name, kind: input('location-kind') as WorldLocation['kind'], parentLocationId: input('location-parent') || undefined, description: input('location-description') })
    } else if (kind === 'species') {
      const name = input('species-name').trim(); if (!name) return toast(root, 'Species name is required.', 'error')
      world.species.push({ id: uid('species'), name, description: input('species-description') })
    } else if (kind === 'faction') {
      const name = input('faction-name').trim(); if (!name) return toast(root, 'Faction name is required.', 'error')
      world.factions.push({ id: uid('faction'), name, description: input('faction-description') })
    } else if (kind === 'family') {
      const name = input('family-name').trim(); if (!name) return toast(root, 'Family name is required.', 'error')
      world.families.push({ id: uid('family'), name, description: input('family-description'), people: [], relationships: [] })
    } else if (kind === 'person') {
      const family = world.families.find((item) => item.id === input('person-family')); const name = input('person-name').trim()
      if (!family || !name) return toast(root, 'Select a family and enter a person.', 'error')
      family.people.push({ id: uid('person'), name, description: input('person-description') })
    } else if (kind === 'relationship') {
      const from = input('link-from').split(':'); const to = input('link-to').split(':'); const familyId = input('link-family')
      const family = world.families.find((item) => item.id === familyId)
      if (!family || from[0] !== familyId || to[0] !== familyId || !from[1] || !to[1]) return toast(root, 'Choose two people from the selected family.', 'error')
      if (from[1] === to[1]) return toast(root, 'Choose two different people.', 'error')
      family.relationships.push({ id: uid('relation'), fromPersonId: from[1], toPersonId: to[1], kind: input('link-kind') as FamilyRelationshipKind, notes: input('link-notes') })
    } else if (kind === 'memory') {
      const title = input('memory-title').trim(); if (!title) return toast(root, 'Event title is required.', 'error')
      world.memories.push({ id: uid('memory'), title, description: input('memory-description'), kind: input('memory-kind') as WorldMemoryKind, occurredAt: input('memory-date'), visibility: input('memory-visibility') as WorldMemoryVisibility, locationIds: selected('memory-locations'), factionIds: selected('memory-factions'), familyIds: selected('memory-families'), affectedCharacterIds: selected('memory-characters'), persistentEffects: lines('memory-effects'), createdAt: new Date().toISOString() })
    }
    await persistAndReopen(kind === 'memory' ? 'memory' : kind === 'location' ? 'places' : ['family','person','relationship'].includes(kind || '') ? 'families' : 'people')
  }))

  root.querySelectorAll<HTMLButtonElement>('[data-remove-kind]').forEach((button) => button.addEventListener('click', async () => {
    const id = button.dataset.removeId; const kind = button.dataset.removeKind
    if (kind === 'location' && (world.locations.some((item) => item.parentLocationId === id) || world.memories.some((memory) => memory.locationIds.includes(id!)) || characters.some((character) => character.homeLocationId === id))) return toast(root, 'This location is still referenced by the world or a character.', 'error')
    if (kind === 'species' && characters.some((character) => character.speciesId === id)) return toast(root, 'This species is still referenced by a character.', 'error')
    if (kind === 'faction' && (world.memories.some((memory) => memory.factionIds.includes(id!)) || characters.some((character) => character.factionIds.includes(id!)))) return toast(root, 'This faction is still referenced by world memory or a character.', 'error')
    if (kind === 'family') {
      const family = world.families.find((item) => item.id === id)
      const personIds = new Set(family?.people.map((person) => person.id) || [])
      if (world.memories.some((memory) => memory.familyIds.includes(id!)) || characters.some((character) => character.familyPersonIds.some((personId) => personIds.has(personId)))) return toast(root, 'This family is still referenced by world memory or a character.', 'error')
    }
    if (kind === 'memory' && characters.some((character) => character.knownWorldMemoryIds.includes(id!))) return toast(root, 'This memory is still referenced by a character.', 'error')
    if (kind === 'location') world.locations = world.locations.filter((item) => item.id !== id)
    if (kind === 'species') world.species = world.species.filter((item) => item.id !== id)
    if (kind === 'faction') world.factions = world.factions.filter((item) => item.id !== id)
    if (kind === 'family') world.families = world.families.filter((item) => item.id !== id)
    if (kind === 'memory') world.memories = world.memories.filter((item) => item.id !== id)
    await persistAndReopen(kind === 'memory' ? 'memory' : kind === 'location' ? 'places' : kind === 'family' ? 'families' : 'people')
  }))
}
