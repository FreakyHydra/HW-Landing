import type { AppContext, Navigate } from '../app/router'
import { escapeHtml, uid } from '../app/html'
import { shell, toast } from '../app/shell'
import type { Persona } from '../domain/persona'

function createPersona(): Persona {
  const now = new Date().toISOString()
  return { id: uid('persona'), name: '', pronouns: '', description: '', appearance: '', personality: '', background: '', notes: '', createdAt: now, updatedAt: now }
}

const fields: Array<[keyof Persona, string, string]> = [
  ['name', 'Name', 'Persona name'], ['pronouns', 'Pronouns', 'How characters refer to this persona'],
  ['description', 'Description', 'The player identity in the fiction...'], ['appearance', 'Appearance', 'Visible appearance and presentation...'],
  ['personality', 'Personality', 'Signals other characters may understand...'], ['background', 'Background', 'History relevant to the world...'],
  ['notes', 'Private notes', 'Player-facing or engine notes...'],
]

export async function renderPersonas(root: HTMLElement, context: AppContext, navigate: Navigate, editing = false, id?: string): Promise<void> {
  if (!editing) {
    const personas = await context.personas.list()
    root.innerHTML = shell('/forge/personas/', `
      <section class="library-toolbar"><p>${personas.length} ${personas.length === 1 ? 'persona' : 'personas'} in this local repository</p><a class="machine-button primary" href="/forge/personas/create/" data-nav>NEW PERSONA</a></section>
      <section class="library-grid">${personas.length ? personas.map((persona) => `<article class="library-card instrument-panel"><div class="card-monogram persona-mark">${escapeHtml(persona.name.slice(0, 2).toUpperCase() || 'ME')}</div><div class="library-card-copy"><p class="eyebrow">PLAYER IDENTITY</p><h2>${escapeHtml(persona.name || 'Untitled persona')}</h2><p>${escapeHtml(persona.description || 'No description yet.')}</p></div><div class="card-actions"><a class="machine-button primary" href="/forge/personas/edit/${persona.id}/" data-nav>EDIT</a></div></article>`).join('') : '<div class="empty-state instrument-panel"><span>◇</span><h2>No personas yet</h2><p>Personas define the player inside the fiction and remain separate from character cards.</p></div>'}</section>
    `, 'Persona Library', 'FORGE · PLAYER IDENTITY')
    return
  }

  let persona = id ? await context.personas.get(id) : undefined
  persona ||= createPersona()
  root.innerHTML = shell(location.pathname, `
    <section class="editor-toolbar instrument-panel"><a href="/forge/personas/" data-nav class="text-link">← PERSONA LIBRARY</a><div class="editor-status"><i class="lamp live"></i><span>SEPARATE PLAYER MODEL</span></div><button class="machine-button primary" id="save-persona">SAVE PERSONA</button></section>
    <div class="persona-workbench">
      <form class="editor-panel instrument-panel" id="persona-form">
        <header class="module-title"><div><p class="eyebrow">PERSONA MODULE</p><h2>Player mirror</h2></div><small>NOT A CHARACTER CARD</small></header>
        <div class="field-grid">${fields.slice(0, 2).map(([key, label, hint]) => `<label class="field-control"><span class="field-head">${label}</span><input name="${key}" value="${escapeHtml(persona[key])}" placeholder="${hint}" /></label>`).join('')}</div>
        ${fields.slice(2).map(([key, label, hint]) => `<label class="field-control"><span class="field-head">${label}</span><textarea name="${key}" rows="5" placeholder="${hint}">${escapeHtml(persona[key])}</textarea></label>`).join('')}
      </form>
      <aside class="preview-rail instrument-panel"><header class="panel-heading"><div><p class="eyebrow">PERSONA MIRROR</p><h2>Visible identity</h2></div><div class="status-cluster"><i class="lamp live"></i>LOCAL</div></header><p class="interpretation" id="persona-preview">${escapeHtml(persona.description || 'The authored player identity will appear here.')}</p><p class="panel-footnote">Persona data is stored separately. It is never exported as Character Card V2.</p></aside>
    </div>
  `, id ? (persona.name || 'Edit Persona') : 'Create Persona', 'PERSONA FORGE')

  const form = root.querySelector<HTMLFormElement>('#persona-form')!
  form.addEventListener('input', () => {
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value
    root.querySelector('#persona-preview')!.textContent = description || 'The authored player identity will appear here.'
  })
  root.querySelector('#save-persona')?.addEventListener('click', async () => {
    fields.forEach(([key]) => { persona[key] = (form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement).value })
    persona.updatedAt = new Date().toISOString()
    if (!persona.name.trim()) return toast(root, 'Persona name is required.', 'error')
    await context.personas.save(persona)
    toast(root, 'Persona saved')
    navigate(`/forge/personas/edit/${persona.id}/`)
  })
}
