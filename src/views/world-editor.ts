import type { AppContext, Navigate } from '../app/router'
import { bindEntityContextMenus, type EntityMenuAction } from '../app/entity-context-menu'
import { escapeHtml, uid } from '../app/html'
import { shell, toast } from '../app/shell'
import { createEmptyWorld, societyTypes, validateWorld, wouldCreateHierarchyCycle, worldContextSummary, type FamilyRelationshipKind, type WorldLocation, type WorldMemoryKind, type WorldMemoryVisibility, type WorldRecord, type WorldSociety, type WorldSocietyCanonStatus, type WorldSocietyLifestyle } from '../domain/world'

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

function contextCard(kind: 'location' | 'society', id: string, body: string, label: string): string {
  return `<article class="entity-card context-entity-card" tabindex="0" data-entity-menu-kind="${kind}" data-entity-menu-id="${escapeHtml(id)}">${body}<button class="entity-menu-trigger" type="button" data-entity-menu-trigger aria-label="Open actions for ${escapeHtml(label)}" aria-haspopup="menu">⋯</button></article>`
}

function locationMarkup(world: WorldRecord): string {
  if (!world.locations.length) return '<p class="empty-note">No locations yet.</p>'
  const names = new Map(world.locations.map((location) => [location.id, location.name]))
  return world.locations.map((location) => contextCard('location', location.id, `<div><p class="eyebrow">${escapeHtml(location.kind)}${location.parentLocationId ? ` · INSIDE ${escapeHtml(names.get(location.parentLocationId) || 'Unknown')}` : ''}</p><strong>${escapeHtml(location.name)}</strong><p>${escapeHtml(location.description || 'No description.')}</p></div>`, location.name)).join('')
}

function societyMarkup(world: WorldRecord): string {
  if (!world.societies.length) return '<p class="empty-note">No peoples or societies yet.</p>'
  const names = new Map(world.societies.map((society) => [society.id, society.name]))
  return world.societies.map((society) => contextCard('society', society.id, `<div><p class="eyebrow">${escapeHtml(society.type.replaceAll('_', ' '))}${society.parentSocietyId ? ` · WITHIN ${escapeHtml(names.get(society.parentSocietyId) || 'Unknown')}` : ''}</p><strong>${escapeHtml(society.name)}</strong><p>${escapeHtml(society.description || 'No description.')}</p><div class="tag-row"><span>${escapeHtml(society.lifestyle)}</span><span>${escapeHtml(society.canonStatus)}</span>${society.familyIds.length ? `<span>${society.familyIds.length} families</span>` : ''}${society.territoryLocationIds.length ? `<span>${society.territoryLocationIds.length} territories</span>` : ''}</div></div>`, society.name)).join('')
}

function societyOptionLabel(type: string): string {
  return type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function openEntityPicker(root: HTMLElement, config: { title: string; label: string; options: Array<{ id: string; label: string }>; selected: string[]; multiple?: boolean; allowNone?: boolean; onSave: (ids: string[]) => void | Promise<void> }): void {
  const dialog = document.createElement('dialog')
  dialog.className = 'entity-picker-dialog'
  dialog.innerHTML = `<form method="dialog"><header><p class="eyebrow">UPDATE RELATIONSHIP</p><h2>${escapeHtml(config.title)}</h2></header><label class="field-control"><span class="field-head">${escapeHtml(config.label)}</span><select data-picker ${config.multiple ? 'multiple' : ''}>${config.allowNone ? '<option value="">No parent</option>' : ''}${config.options.map((item) => `<option value="${escapeHtml(item.id)}" ${config.selected.includes(item.id) ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label><div class="dialog-actions"><button class="machine-button" value="cancel">CANCEL</button><button class="machine-button primary" value="save">SAVE</button></div></form>`
  root.append(dialog)
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue === 'save') {
      const picker = dialog.querySelector<HTMLSelectElement>('[data-picker]')!
      await config.onSave([...picker.selectedOptions].map((item) => item.value).filter(Boolean))
    }
    dialog.remove()
  }, { once: true })
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close('cancel') })
  dialog.showModal()
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
    <div class="world-preview-counts"><span><b>${world.species.length}</b>Species</span><span><b>${world.locations.length}</b>Places</span><span><b>${world.societies.length}</b>Societies</span><span><b>${world.families.length}</b>Families</span><span><b>${world.factions.length}</b>Factions</span><span><b>${world.memories.length}</b>Memories</span></div>`
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
      <button type="button" data-world-tab="people" aria-selected="false">SPECIES & FACTIONS</button>
      <button type="button" data-world-tab="societies" aria-selected="false">PEOPLES & SOCIETIES</button>
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
          <div class="entity-composer" id="location-composer"><header class="composer-heading"><div><h3 id="location-composer-title">Add location</h3><p id="location-composer-mode">Create a place inside this world.</p></div><button type="button" class="text-link" id="cancel-location-edit" hidden>CANCEL</button></header><div class="field-grid compact-grid">${field('location-name', 'Name', '', 'Whispering Woods')}<label class="field-control"><span class="field-head">Kind</span><select name="location-kind">${(['region','town','building','landmark','other'] as const).map((kind) => option(kind, kind)).join('')}</select></label><label class="field-control"><span class="field-head">Inside location</span><select name="location-parent"><option value="">No parent</option>${world.locations.map((location) => option(location.id, location.name)).join('')}</select></label></div>${field('location-description', 'Description', '', 'What is important about this place?', 3)}<button type="button" class="machine-button primary" data-add="location" id="location-submit">ADD LOCATION</button></div>
          <div class="entity-list" id="location-list">${locationMarkup(world)}</div>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="people" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 04</p><h2>People of the world</h2></div><small>SPECIES · FACTIONS</small></header>
          <div class="split-composers">
            <div class="entity-composer"><h3>Species</h3>${field('species-name', 'Name', '', 'Fox')}${field('species-description', 'World definition', '', 'How this species exists in this reality...', 3)}<button type="button" class="machine-button primary" data-add="species">ADD SPECIES</button></div>
            <div class="entity-composer"><h3>Faction</h3>${field('faction-name', 'Name', '', 'River Watch')}${field('faction-description', 'Purpose and influence', '', 'What they want and where they hold power...', 3)}<button type="button" class="machine-button primary" data-add="faction">ADD FACTION</button></div>
          </div>
          <div class="entity-columns"><div><p class="eyebrow">SPECIES INDEX</p>${world.species.map((item) => compactItem('species', item.id, item.name, 'species', item.description)).join('') || '<p class="empty-note">No species defined.</p>'}</div><div><p class="eyebrow">FACTION INDEX</p>${world.factions.map((item) => compactItem('faction', item.id, item.name, 'faction', item.description)).join('') || '<p class="empty-note">No factions defined.</p>'}</div></div>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="societies" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 05</p><h2>Peoples & Societies</h2></div><small>KINSHIP · CULTURE · SOCIAL STRUCTURE</small></header>
          <p class="module-intro">Model clans, tribes, packs, nations and other living social structures separately from purpose-driven factions. Leadership, settlement and belief fields may be left open or describe distributed systems.</p>
          <div class="entity-composer society-composer" id="society-composer">
            <header class="composer-heading"><div><h3 id="society-composer-title">Add society</h3><p id="society-composer-mode">Create a people or social structure.</p></div><button type="button" class="text-link" id="cancel-society-edit" hidden>CANCEL</button></header>
            <section class="society-form-section"><p class="eyebrow">IDENTITY & STRUCTURE</p><div class="field-grid">${field('society-name', 'Name', '', 'Brackenjaw')}<label class="field-control"><span class="field-head">Type</span><select name="society-type">${societyTypes.map((type) => option(type, societyOptionLabel(type))).join('')}</select></label><label class="field-control"><span class="field-head">Parent society</span><select name="society-parent"><option value="">No parent society</option>${world.societies.map((society) => option(society.id, society.name)).join('')}</select></label></div>${field('society-description', 'Description', '', 'Who this people are in the world...', 4)}${field('society-origin', 'Founding or origin', '', 'How the society formed, if known...', 3)}</section>
            <section class="society-form-section"><p class="eyebrow">TERRITORY & MEMBERSHIP</p><div class="field-grid"><label class="field-control"><span class="field-head">Lifestyle</span><select name="society-lifestyle">${(['nomadic','settled','mixed'] as WorldSocietyLifestyle[]).map((value) => option(value, societyOptionLabel(value))).join('')}</select></label><label class="field-control"><span class="field-head">Primary territory / homeland</span><select name="society-territories" multiple>${world.locations.map((location) => option(location.id, location.name)).join('')}</select></label><label class="field-control"><span class="field-head">Known settlements</span><select name="society-settlements" multiple>${world.locations.map((location) => option(location.id, location.name)).join('')}</select></label><label class="field-control"><span class="field-head">Species composition</span><select name="society-species" multiple>${world.species.map((species) => option(species.id, species.name)).join('')}</select></label><label class="field-control"><span class="field-head">Related families</span><select name="society-families" multiple>${world.families.map((family) => option(family.id, family.name)).join('')}</select></label></div>${field('society-territory-notes', 'Territory, sharing, or disputes', '', 'Shared ranges, disputed ground, porous borders...', 3)}${field('society-seasonal-movement', 'Seasonal movement', '', 'Routes, seasons, or no regular movement...', 3)}${field('society-kinship', 'Kinship basis', '', 'Descent, adoption, oath-bonds, affinity, or another basis...', 3)}${field('society-membership', 'Membership rules', '', 'How someone belongs, joins, leaves, or holds several ties...', 3)}</section>
            <section class="society-form-section"><p class="eyebrow">GOVERNANCE & LIFE</p>${field('society-leadership', 'Leadership structure', '', 'Several leaders, rotating roles, no permanent leader, or another structure...', 3)}${field('society-decisions', 'Council or decision-making', '', 'How collective decisions are made...', 3)}${field('society-customs', 'Customs', '', 'Practices, obligations, hospitality, rites...', 3)}${field('society-beliefs', 'Beliefs', '', 'Shared, varied, private, or disputed beliefs...', 3)}${field('society-language', 'Language or dialect', '', 'Spoken, signed, unwritten, multilingual, or other...', 3)}${field('society-livelihood', 'Livelihood', '', 'Hunting, herding, farming, trade, craft, mixed work...', 3)}</section>
            <section class="society-form-section"><p class="eyebrow">RELATIONS & CANON</p><div class="field-grid"><label class="field-control"><span class="field-head">Allies</span><select name="society-allies" multiple>${world.societies.map((society) => option(society.id, society.name)).join('')}</select></label><label class="field-control"><span class="field-head">Rivals</span><select name="society-rivals" multiple>${world.societies.map((society) => option(society.id, society.name)).join('')}</select></label><label class="field-control"><span class="field-head">Related factions</span><select name="society-factions" multiple>${world.factions.map((faction) => option(faction.id, faction.name)).join('')}</select></label><label class="field-control"><span class="field-head">Canon status</span><select name="society-canon">${(['canon','draft','disputed','historical'] as WorldSocietyCanonStatus[]).map((value) => option(value, societyOptionLabel(value))).join('')}</select></label></div>${field('society-status', 'Current status', '', 'Active, scattered, migrating, divided, extinct, rebuilding...', 3)}</section>
            <button type="button" class="machine-button primary" data-add="society" id="society-submit">ADD SOCIETY</button>
          </div>
          <div class="entity-list society-list" id="society-list">${societyMarkup(world)}</div>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="families" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 06</p><h2>Families & trees</h2></div><small>FIRST-CLASS RELATIONSHIPS</small></header>
          <div class="family-composers">
            <div class="entity-composer"><h3>Create family</h3>${field('family-name', 'Family name', '', 'Whiteclaw')}${field('family-description', 'Family identity', '', 'History, reputation or role...', 3)}<button type="button" class="machine-button primary" data-add="family">ADD FAMILY</button></div>
            <div class="entity-composer"><h3>Add person</h3><label class="field-control"><span class="field-head">Family</span><select name="person-family"><option value="">Select family</option>${world.families.map((family) => option(family.id, family.name)).join('')}</select></label>${field('person-name', 'Name', '', 'Heather Whiteclaw')}${field('person-description', 'Place in family', '', 'Parent, founder, missing relative...', 2)}<button type="button" class="machine-button primary" data-add="person">ADD PERSON</button></div>
            <div class="entity-composer relationship-composer"><h3>Connect people</h3><label class="field-control"><span class="field-head">Family</span><select name="link-family" id="link-family"><option value="">Select family</option>${world.families.map((family) => option(family.id, family.name)).join('')}</select></label><div class="field-grid compact-grid"><label class="field-control"><span class="field-head">First person</span><select name="link-from"><option value="">Select person</option>${world.families.flatMap((family) => family.people.map((person) => option(`${family.id}:${person.id}`, `${family.name} · ${person.name}`))).join('')}</select></label><label class="field-control"><span class="field-head">Relationship</span><select name="link-kind">${(['parent','partner','sibling','guardian'] as FamilyRelationshipKind[]).map((kind) => option(kind, kind)).join('')}</select></label><label class="field-control"><span class="field-head">Second person</span><select name="link-to"><option value="">Select person</option>${world.families.flatMap((family) => family.people.map((person) => option(`${family.id}:${person.id}`, `${family.name} · ${person.name}`))).join('')}</select></label></div>${field('link-notes', 'Relationship notes', '', 'Optional history or nuance')}<button type="button" class="machine-button primary" data-add="relationship">CONNECT PEOPLE</button></div>
          </div>
          <div class="family-list">${familyMarkup(world)}</div>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="memory" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 07</p><h2>World memory</h2></div><small>EVENTS THAT REMAIN TRUE</small></header>
          <div class="entity-composer"><div class="field-grid compact-grid">${field('memory-title', 'Event', '', 'The bridge burned down')}<label class="field-control"><span class="field-head">Kind</span><select name="memory-kind">${(['event','discovery','death','conflict','persistent_change'] as WorldMemoryKind[]).map((kind) => option(kind, kind.replaceAll('_',' '))).join('')}</select></label>${field('memory-date', 'World date', '', 'Year 17, first winter')}<label class="field-control"><span class="field-head">Visibility</span><select name="memory-visibility">${(['common','regional','faction','family','private','disputed'] as WorldMemoryVisibility[]).map((visibility) => option(visibility, visibility)).join('')}</select></label></div>${field('memory-description', 'What happened', '', 'Record the event as a durable world fact...', 4)}<div class="world-reference-grid memory-scope"><label class="field-control"><span class="field-head">Affected locations</span><select name="memory-locations" multiple>${world.locations.map((location) => option(location.id, location.name)).join('')}</select></label><label class="field-control"><span class="field-head">Affected factions</span><select name="memory-factions" multiple>${world.factions.map((faction) => option(faction.id, faction.name)).join('')}</select></label><label class="field-control"><span class="field-head">Affected families</span><select name="memory-families" multiple>${world.families.map((family) => option(family.id, family.name)).join('')}</select></label><label class="field-control"><span class="field-head">Affected characters</span><select name="memory-characters" multiple>${characters.map((character) => option(character.id, character.cardV2.data.name || 'Untitled character')).join('')}</select></label></div>${field('memory-effects', 'Persistent effects', '', 'One lasting consequence per line...', 3)}<button type="button" class="machine-button primary" data-add="memory">RECORD WORLD MEMORY</button></div>
          <div class="timeline-list">${memoryMarkup(world)}</div>
        </section>

        <section class="editor-panel instrument-panel" data-world-panel="rules" hidden>
          <header class="module-title"><div><p class="eyebrow">WORLD MODULE 08</p><h2>Rules</h2></div><small>THE CONSTRAINTS OF REALITY</small></header>
          ${field('rule-technology', 'Technology', world.rules.technology, 'Pre-industrial tools, transport and medicine...', 5)}${field('rule-magic', 'Magic / physics', world.rules.magicPhysics, 'What is possible, impossible or costly...', 5)}${field('rule-society', 'Society', world.rules.society, 'Law, hierarchy, economy and social structure...', 5)}${field('rule-constraints', 'Other constraints', world.rules.constraints.join('\n'), 'One authoritative rule per line...', 5)}
        </section>
      </form>

      <aside class="preview-rail instrument-panel world-preview" aria-label="World context preview"><header class="panel-heading"><div><p class="eyebrow">INHERITANCE VIEW</p><h2>World context</h2></div><div class="status-cluster"><i class="lamp live"></i>ROOT</div></header><div id="world-preview">${previewMarkup(world)}</div></aside>
    </div>
  `, id ? (world.identity.name || 'Edit World') : 'Create World', 'WORLD FORGE · ROOT OBJECT')

  const form = root.querySelector<HTMLFormElement>('#world-form')!
  let editingLocationId: string | undefined
  let editingSocietyId: string | undefined
  const input = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
  const lines = (name: string) => input(name).split('\n').map((line) => line.trim()).filter(Boolean)
  const selected = (name: string) => [...(form.elements.namedItem(name) as HTMLSelectElement).selectedOptions].map((item) => item.value)
  const setValue = (name: string, value: string) => { (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = value }
  const setSelected = (name: string, values: string[]) => {
    const select = form.elements.namedItem(name) as HTMLSelectElement
    ;[...select.options].forEach((item) => { item.selected = values.includes(item.value) })
  }

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

  function focusComposer(id: string, fieldName: string): void {
    const composer = root.querySelector<HTMLElement>(id)
    composer?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => (form.elements.namedItem(fieldName) as HTMLElement)?.focus(), 220)
  }

  function resetLocationForm(): void {
    editingLocationId = undefined
    setValue('location-name', '')
    setValue('location-kind', 'region')
    setValue('location-parent', '')
    setValue('location-description', '')
    root.querySelector('#location-composer-title')!.textContent = 'Add location'
    root.querySelector('#location-composer-mode')!.textContent = 'Create a place inside this world.'
    root.querySelector('#location-submit')!.textContent = 'ADD LOCATION'
    ;(root.querySelector('#cancel-location-edit') as HTMLButtonElement).hidden = true
  }

  function populateLocationForm(location: WorldLocation, mode: 'edit' | 'duplicate' | 'child'): void {
    editingLocationId = mode === 'edit' ? location.id : undefined
    setValue('location-name', mode === 'duplicate' ? `${location.name} copy` : mode === 'child' ? '' : location.name)
    setValue('location-kind', mode === 'child' ? 'building' : location.kind)
    setValue('location-parent', mode === 'child' ? location.id : location.parentLocationId ?? '')
    setValue('location-description', mode === 'child' ? '' : location.description)
    root.querySelector('#location-composer-title')!.textContent = mode === 'edit' ? `Edit ${location.name}` : mode === 'child' ? `Add a place inside ${location.name}` : `Duplicate ${location.name}`
    root.querySelector('#location-composer-mode')!.textContent = mode === 'edit' ? 'The location ID and all references will be preserved.' : mode === 'child' ? 'The parent location is already selected.' : 'Review the copy before saving it as a new location.'
    root.querySelector('#location-submit')!.textContent = mode === 'edit' ? 'SAVE LOCATION' : 'ADD LOCATION'
    ;(root.querySelector('#cancel-location-edit') as HTMLButtonElement).hidden = false
    focusComposer('#location-composer', 'location-name')
  }

  function emptySociety(overrides: Partial<WorldSociety> = {}): WorldSociety {
    return { id: uid('society'), name: '', type: 'clan', description: '', origin: '', territoryLocationIds: [], territoryNotes: '', seasonalMovement: '', lifestyle: 'mixed', speciesIds: [], kinshipBasis: '', membershipRules: '', leadershipStructure: '', decisionMaking: '', customs: '', beliefs: '', languageDialect: '', livelihood: '', allySocietyIds: [], rivalSocietyIds: [], familyIds: [], factionIds: [], settlementLocationIds: [], currentStatus: '', canonStatus: 'canon', ...overrides }
  }

  function societyFromForm(id: string): WorldSociety {
    return { id, name: input('society-name').trim(), type: input('society-type') as WorldSociety['type'], parentSocietyId: input('society-parent') || undefined, description: input('society-description'), origin: input('society-origin'), territoryLocationIds: selected('society-territories'), territoryNotes: input('society-territory-notes'), seasonalMovement: input('society-seasonal-movement'), lifestyle: input('society-lifestyle') as WorldSocietyLifestyle, speciesIds: selected('society-species'), kinshipBasis: input('society-kinship'), membershipRules: input('society-membership'), leadershipStructure: input('society-leadership'), decisionMaking: input('society-decisions'), customs: input('society-customs'), beliefs: input('society-beliefs'), languageDialect: input('society-language'), livelihood: input('society-livelihood'), allySocietyIds: selected('society-allies').filter((value) => value !== id), rivalSocietyIds: selected('society-rivals').filter((value) => value !== id), familyIds: selected('society-families'), factionIds: selected('society-factions'), settlementLocationIds: selected('society-settlements'), currentStatus: input('society-status'), canonStatus: input('society-canon') as WorldSocietyCanonStatus }
  }

  function populateSocietyForm(society: WorldSociety, mode: 'edit' | 'duplicate' | 'child'): void {
    editingSocietyId = mode === 'edit' ? society.id : undefined
    setValue('society-name', mode === 'duplicate' ? `${society.name} copy` : mode === 'child' ? '' : society.name)
    setValue('society-type', mode === 'child' ? 'clan' : society.type)
    setValue('society-parent', mode === 'child' ? society.id : society.parentSocietyId ?? '')
    setValue('society-description', mode === 'child' ? '' : society.description)
    setValue('society-origin', mode === 'child' ? '' : society.origin)
    setValue('society-territory-notes', mode === 'child' ? '' : society.territoryNotes)
    setValue('society-seasonal-movement', mode === 'child' ? '' : society.seasonalMovement)
    setValue('society-lifestyle', society.lifestyle)
    setValue('society-kinship', mode === 'child' ? '' : society.kinshipBasis)
    setValue('society-membership', mode === 'child' ? '' : society.membershipRules)
    setValue('society-leadership', mode === 'child' ? '' : society.leadershipStructure)
    setValue('society-decisions', mode === 'child' ? '' : society.decisionMaking)
    setValue('society-customs', mode === 'child' ? '' : society.customs)
    setValue('society-beliefs', mode === 'child' ? '' : society.beliefs)
    setValue('society-language', mode === 'child' ? '' : society.languageDialect)
    setValue('society-livelihood', mode === 'child' ? '' : society.livelihood)
    setValue('society-status', mode === 'child' ? '' : society.currentStatus)
    setValue('society-canon', society.canonStatus)
    setSelected('society-territories', mode === 'child' ? [] : society.territoryLocationIds)
    setSelected('society-settlements', mode === 'child' ? [] : society.settlementLocationIds)
    setSelected('society-species', mode === 'child' ? society.speciesIds : society.speciesIds)
    setSelected('society-families', mode === 'child' ? [] : society.familyIds)
    setSelected('society-allies', mode === 'child' ? [] : society.allySocietyIds)
    setSelected('society-rivals', mode === 'child' ? [] : society.rivalSocietyIds)
    setSelected('society-factions', mode === 'child' ? [] : society.factionIds)
    root.querySelector('#society-composer-title')!.textContent = mode === 'edit' ? `Edit ${society.name}` : mode === 'child' ? `Add a society within ${society.name}` : `Duplicate ${society.name}`
    root.querySelector('#society-composer-mode')!.textContent = mode === 'edit' ? 'The society ID and every existing link will be preserved.' : mode === 'child' ? 'The parent society is already selected.' : 'Review the copy before saving it as a new society.'
    root.querySelector('#society-submit')!.textContent = mode === 'edit' ? 'SAVE SOCIETY' : 'ADD SOCIETY'
    ;(root.querySelector('#cancel-society-edit') as HTMLButtonElement).hidden = false
    focusComposer('#society-composer', 'society-name')
  }

  function resetSocietyForm(): void {
    populateSocietyForm(emptySociety(), 'duplicate')
    setValue('society-name', '')
    editingSocietyId = undefined
    root.querySelector('#society-composer-title')!.textContent = 'Add society'
    root.querySelector('#society-composer-mode')!.textContent = 'Create a people or social structure.'
    ;(root.querySelector('#cancel-society-edit') as HTMLButtonElement).hidden = true
  }

  function activateTab(name: string): void {
    root.querySelectorAll<HTMLButtonElement>('[data-world-tab]').forEach((button) => { const active = button.dataset.worldTab === name; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)) })
    root.querySelectorAll<HTMLElement>('[data-world-panel]').forEach((panel) => { panel.hidden = panel.dataset.worldPanel !== name })
  }
  root.querySelectorAll<HTMLButtonElement>('[data-world-tab]').forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.worldTab!)))
  const requestedTab = new URLSearchParams(location.search).get('tab')
  if (requestedTab) activateTab(requestedTab)
  root.querySelector('#cancel-location-edit')?.addEventListener('click', resetLocationForm)
  root.querySelector('#cancel-society-edit')?.addEventListener('click', resetSocietyForm)

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
      const locationId = editingLocationId ?? uid('location')
      const parentLocationId = input('location-parent') || undefined
      if (wouldCreateHierarchyCycle(world.locations, locationId, parentLocationId)) return toast(root, 'A location cannot be moved inside itself or one of its children.', 'error')
      const nextLocation: WorldLocation = { id: locationId, name, kind: input('location-kind') as WorldLocation['kind'], parentLocationId, description: input('location-description') }
      const index = world.locations.findIndex((item) => item.id === locationId)
      if (index >= 0) world.locations[index] = nextLocation
      else world.locations.push(nextLocation)
    } else if (kind === 'society') {
      const societyId = editingSocietyId ?? uid('society')
      const nextSociety = societyFromForm(societyId)
      if (!nextSociety.name) return toast(root, 'Society name is required.', 'error')
      if (wouldCreateHierarchyCycle(world.societies, societyId, nextSociety.parentSocietyId)) return toast(root, 'A society cannot be moved beneath itself or one of its descendants.', 'error')
      const index = world.societies.findIndex((item) => item.id === societyId)
      if (index >= 0) world.societies[index] = nextSociety
      else world.societies.push(nextSociety)
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
    await persistAndReopen(kind === 'memory' ? 'memory' : kind === 'location' ? 'places' : kind === 'society' ? 'societies' : ['family','person','relationship'].includes(kind || '') ? 'families' : 'people')
  }))

  const locationActions: EntityMenuAction[] = [
    { id: 'edit', label: 'Edit' }, { id: 'add-child', label: 'Add child location' }, { id: 'move', label: 'Move to' }, { id: 'duplicate', label: 'Duplicate' }, { id: 'delete', label: 'Delete', danger: true, separated: true },
  ]
  const societyActions: EntityMenuAction[] = [
    { id: 'edit', label: 'Edit' }, { id: 'add-child', label: 'Add child society' }, { id: 'move', label: 'Move beneath another society' }, { id: 'link-family', label: 'Link family' }, { id: 'link-location', label: 'Link location' }, { id: 'link-faction', label: 'Link faction' }, { id: 'duplicate', label: 'Duplicate' }, { id: 'delete', label: 'Delete', danger: true, separated: true },
  ]

  bindEntityContextMenus(root, {
    actions: ({ entityKind }) => entityKind === 'location' ? locationActions : entityKind === 'society' ? societyActions : [],
    onAction: async (action, request) => {
      if (request.entityKind === 'location') {
        const location = world.locations.find((item) => item.id === request.entityId)
        if (!location) return
        if (action === 'edit') populateLocationForm(location, 'edit')
        else if (action === 'add-child') populateLocationForm(location, 'child')
        else if (action === 'duplicate') populateLocationForm(location, 'duplicate')
        else if (action === 'move') {
          const choices = world.locations.filter((item) => item.id !== location.id && !wouldCreateHierarchyCycle(world.locations, location.id, item.id)).map((item) => ({ id: item.id, label: item.name }))
          openEntityPicker(root, { title: `Move ${location.name}`, label: 'New parent location', options: choices, selected: location.parentLocationId ? [location.parentLocationId] : [], allowNone: true, onSave: async ([parentId]) => {
            if (wouldCreateHierarchyCycle(world.locations, location.id, parentId)) return toast(root, 'That move would create a circular location hierarchy.', 'error')
            location.parentLocationId = parentId || undefined
            await persistAndReopen('places')
          } })
        } else if (action === 'delete') {
          if (world.memories.some((memory) => memory.locationIds.includes(location.id)) || characters.some((character) => character.homeLocationId === location.id) || world.societies.some((society) => [...society.territoryLocationIds, ...society.settlementLocationIds].includes(location.id))) return toast(root, 'This location is still referenced by memory, a society, or a character.', 'error')
          const children = world.locations.filter((item) => item.parentLocationId === location.id)
          const prompt = children.length ? `${location.name} contains ${children.length} child location${children.length === 1 ? '' : 's'}. Delete it and move those children up one level?` : `Delete ${location.name}?`
          if (!window.confirm(prompt)) return
          children.forEach((child) => { child.parentLocationId = location.parentLocationId })
          world.locations = world.locations.filter((item) => item.id !== location.id)
          await persistAndReopen('places')
        }
        return
      }

      const society = world.societies.find((item) => item.id === request.entityId)
      if (!society) return
      if (action === 'edit') populateSocietyForm(society, 'edit')
      else if (action === 'add-child') populateSocietyForm(society, 'child')
      else if (action === 'duplicate') populateSocietyForm(society, 'duplicate')
      else if (action === 'move') {
        const choices = world.societies.filter((item) => item.id !== society.id && !wouldCreateHierarchyCycle(world.societies, society.id, item.id)).map((item) => ({ id: item.id, label: item.name }))
        openEntityPicker(root, { title: `Move ${society.name}`, label: 'Parent society', options: choices, selected: society.parentSocietyId ? [society.parentSocietyId] : [], allowNone: true, onSave: async ([parentId]) => {
          if (wouldCreateHierarchyCycle(world.societies, society.id, parentId)) return toast(root, 'That move would create a circular society hierarchy.', 'error')
          society.parentSocietyId = parentId || undefined
          await persistAndReopen('societies')
        } })
      } else if (action === 'link-family') {
        openEntityPicker(root, { title: `Families linked to ${society.name}`, label: 'Related families', options: world.families.map((item) => ({ id: item.id, label: item.name })), selected: society.familyIds, multiple: true, onSave: async (ids) => { society.familyIds = ids; await persistAndReopen('societies') } })
      } else if (action === 'link-location') {
        openEntityPicker(root, { title: `Territory linked to ${society.name}`, label: 'Territories or homelands', options: world.locations.map((item) => ({ id: item.id, label: item.name })), selected: society.territoryLocationIds, multiple: true, onSave: async (ids) => { society.territoryLocationIds = ids; await persistAndReopen('societies') } })
      } else if (action === 'link-faction') {
        openEntityPicker(root, { title: `Factions linked to ${society.name}`, label: 'Related purpose-driven factions', options: world.factions.map((item) => ({ id: item.id, label: item.name })), selected: society.factionIds, multiple: true, onSave: async (ids) => { society.factionIds = ids; await persistAndReopen('societies') } })
      } else if (action === 'delete') {
        const children = world.societies.filter((item) => item.parentSocietyId === society.id)
        const prompt = children.length ? `${society.name} contains ${children.length} child societ${children.length === 1 ? 'y' : 'ies'}. Delete it and move them up one level?` : `Delete ${society.name}?`
        if (!window.confirm(prompt)) return
        children.forEach((child) => { child.parentSocietyId = society.parentSocietyId })
        world.societies.forEach((item) => { item.allySocietyIds = item.allySocietyIds.filter((id) => id !== society.id); item.rivalSocietyIds = item.rivalSocietyIds.filter((id) => id !== society.id) })
        world.societies = world.societies.filter((item) => item.id !== society.id)
        await persistAndReopen('societies')
      }
    },
  })

  root.querySelectorAll<HTMLButtonElement>('[data-remove-kind]').forEach((button) => button.addEventListener('click', async () => {
    const id = button.dataset.removeId; const kind = button.dataset.removeKind
    if (kind === 'species' && characters.some((character) => character.speciesId === id)) return toast(root, 'This species is still referenced by a character.', 'error')
    if (kind === 'faction' && (world.memories.some((memory) => memory.factionIds.includes(id!)) || characters.some((character) => character.factionIds.includes(id!)))) return toast(root, 'This faction is still referenced by world memory or a character.', 'error')
    if (kind === 'family') {
      const family = world.families.find((item) => item.id === id)
      const personIds = new Set(family?.people.map((person) => person.id) || [])
      if (world.memories.some((memory) => memory.familyIds.includes(id!)) || characters.some((character) => character.familyPersonIds.some((personId) => personIds.has(personId)))) return toast(root, 'This family is still referenced by world memory or a character.', 'error')
    }
    if (kind === 'memory' && characters.some((character) => character.knownWorldMemoryIds.includes(id!))) return toast(root, 'This memory is still referenced by a character.', 'error')
    if (kind === 'species') world.species = world.species.filter((item) => item.id !== id)
    if (kind === 'faction') world.factions = world.factions.filter((item) => item.id !== id)
    if (kind === 'family') world.families = world.families.filter((item) => item.id !== id)
    if (kind === 'memory') world.memories = world.memories.filter((item) => item.id !== id)
    await persistAndReopen(kind === 'memory' ? 'memory' : kind === 'family' ? 'families' : 'people')
  }))
}
