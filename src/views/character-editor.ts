import type { AppContext, Navigate } from '../app/router'
import { downloadJson, escapeHtml, pathForName, uid } from '../app/html'
import { shell, toast } from '../app/shell'
import { createEmptyCharacterCardV2, exportCharacterCardV2, validateCharacterCardV2, type CharacterBook, type CharacterCardV2 } from '../domain/character-card-v2'
import { transitionProposal, type CharacterRecord, type EvolutionProposal, type EvolutionStatus } from '../domain/character-record'

const textFields = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes', 'system_prompt', 'post_history_instructions', 'creator', 'character_version'] as const

function newRecord(): CharacterRecord {
  const now = new Date().toISOString()
  return { id: uid('char'), cardV2: createEmptyCharacterCardV2(), developedCanon: [], memories: [], relationships: {}, sceneState: {}, observations: [], evolutionProposals: [], createdAt: now, updatedAt: now }
}

function field(name: string, label: string, value: string, hint = '', rows = 0): string {
  const control = rows
    ? `<textarea id="field-${name}" name="${name}" rows="${rows}" placeholder="${escapeHtml(hint)}">${escapeHtml(value)}</textarea>`
    : `<input id="field-${name}" name="${name}" value="${escapeHtml(value)}" placeholder="${escapeHtml(hint)}" />`
  return `<label class="field-control"><span class="field-head">${escapeHtml(label)}</span>${control}</label>`
}

function proposalMarkup(proposal: EvolutionProposal): string {
  return `<article class="proposal-card" data-proposal="${proposal.id}">
    <header><div><p class="eyebrow">${escapeHtml(proposal.targetField.replaceAll('_', ' '))}</p><strong>${escapeHtml(proposal.source)}</strong></div><span class="proposal-status ${proposal.status}">${proposal.status}</span></header>
    <textarea class="proposal-value" rows="3" ${proposal.status !== 'pending' ? 'disabled' : ''}>${escapeHtml(proposal.proposedValue)}</textarea>
    <div class="proposal-meta"><span>${Math.round(proposal.confidence * 100)}% confidence</span><span>${proposal.evidenceCount} evidence</span><span>${new Date(proposal.timestamp).toLocaleDateString()}</span></div>
    ${proposal.status === 'pending' ? `<div class="proposal-actions"><button type="button" class="machine-button primary" data-transition="accepted">ACCEPT INTO V2</button><button type="button" class="machine-button" data-transition="memory">KEEP AS MEMORY</button><button type="button" class="machine-button" data-edit-proposal>EDIT</button><button type="button" class="machine-button danger" data-transition="rejected">REJECT</button></div>` : ''}
  </article>`
}

function previewMarkup(card: CharacterCardV2): string {
  const data = card.data
  return `<div class="preview-card">
    <div class="preview-monogram">${escapeHtml(data.name.slice(0, 2).toUpperCase() || 'V2')}</div>
    <p class="eyebrow">CHARACTER CARD V2 · ${escapeHtml(data.character_version)}</p>
    <h2 data-preview-name>${escapeHtml(data.name || 'Untitled character')}</h2>
    <p data-preview-description>${escapeHtml(data.description || 'The character description will appear here.')}</p>
    <dl><div><dt>Personality</dt><dd data-preview-personality>${escapeHtml(data.personality || 'Not authored')}</dd></div><div><dt>Scenario</dt><dd data-preview-scenario>${escapeHtml(data.scenario || 'Not authored')}</dd></div></dl>
    <div class="tag-row" data-preview-tags>${data.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
  </div>
  <details class="json-preview"><summary>Inspect portable JSON</summary><pre>${escapeHtml(JSON.stringify(card, null, 2))}</pre></details>`
}

export async function renderCharacterEditor(root: HTMLElement, context: AppContext, navigate: Navigate, id?: string): Promise<void> {
  const existingRecord = id ? await context.characters.get(id) : undefined
  if (id && !existingRecord) {
    root.innerHTML = shell(location.pathname, '<section class="empty-state instrument-panel"><h2>Character not found</h2><a class="machine-button" href="/forge/characters/" data-nav>RETURN TO LIBRARY</a></section>', 'Character not found')
    return
  }
  let record: CharacterRecord = existingRecord ?? newRecord()
  const card = record.cardV2
  const bookJson = card.data.character_book ? JSON.stringify(card.data.character_book, null, 2) : ''

  root.innerHTML = shell(location.pathname, `
    <section class="editor-toolbar instrument-panel">
      <a href="/forge/characters/" data-nav class="text-link">← CHARACTER LIBRARY</a>
      <div class="editor-status"><i class="lamp live"></i><span id="save-status">LOCAL WORKING COPY</span></div>
      <div class="action-row"><button class="machine-button" id="export-card">EXPORT V2</button><button class="machine-button primary" id="save-card">SAVE CHARACTER</button></div>
    </section>
    <nav class="editor-tabs" aria-label="Character editor sections" role="tablist">
      <button type="button" class="active" data-tab="identity" aria-selected="true">IDENTITY</button>
      <button type="button" data-tab="dialogue" aria-selected="false">DIALOGUE</button>
      <button type="button" data-tab="instructions" aria-selected="false">INSTRUCTIONS</button>
      <button type="button" data-tab="lore" aria-selected="false">LOREBOOK</button>
      <button type="button" data-tab="evolution" aria-selected="false">EVOLUTION <span>${record.evolutionProposals.filter((p) => p.status === 'pending').length}</span></button>
    </nav>
    <div class="character-workbench">
      <form class="editor-stack" id="character-form" novalidate>
        <section class="editor-panel instrument-panel" data-panel="identity">
          <header class="module-title"><div><p class="eyebrow">MODULE 01</p><h2>Portable identity</h2></div><small>STANDARD CHARACTER CARD V2</small></header>
          <div class="field-grid">${field('name', 'Name', card.data.name, 'Character name')}${field('character_version', 'Card version', card.data.character_version, '1.0')}${field('creator', 'Creator', card.data.creator, 'Creator name')}</div>
          ${field('description', 'Description', card.data.description, 'Who they are, appearance, identity and enduring details...', 7)}
          ${field('personality', 'Personality', card.data.personality, 'Core behavior, temperament and contradictions...', 6)}
          ${field('scenario', 'Scenario', card.data.scenario, 'The starting situation or shared premise...', 5)}
          ${field('tags', 'Tags', card.data.tags.join(', '), 'fantasy, ranger, original')}
        </section>
        <section class="editor-panel instrument-panel" data-panel="dialogue" hidden>
          <header class="module-title"><div><p class="eyebrow">MODULE 02</p><h2>Voice at the threshold</h2></div><small>OPENING · EXAMPLES · ALTERNATES</small></header>
          ${field('first_mes', 'First message', card.data.first_mes, 'The primary opening message...', 8)}
          ${field('mes_example', 'Example dialogue', card.data.mes_example, 'Example exchanges using the V2 dialogue format...', 8)}
          ${field('alternate_greetings', 'Alternate greetings', card.data.alternate_greetings.join('\n---\n'), 'Separate complete greetings with a line containing ---', 8)}
          <p class="field-note">Each section separated by a line containing <code>---</code> exports as one alternate greeting.</p>
        </section>
        <section class="editor-panel instrument-panel" data-panel="instructions" hidden>
          <header class="module-title"><div><p class="eyebrow">MODULE 03</p><h2>Card instructions</h2></div><small>PORTABLE V2 FIELDS</small></header>
          ${field('creator_notes', 'Creator notes', card.data.creator_notes, 'Notes shown to people using the card. Not prompt content.', 5)}
          ${field('system_prompt', 'System prompt', card.data.system_prompt, 'Optional V2 system prompt...', 6)}
          ${field('post_history_instructions', 'Post-history instructions', card.data.post_history_instructions, 'Optional V2 post-history instructions...', 6)}
        </section>
        <section class="editor-panel instrument-panel" data-panel="lore" hidden>
          <header class="module-title"><div><p class="eyebrow">MODULE 04</p><h2>Character book</h2></div><small>STANDARD V2 LOREBOOK</small></header>
          <p class="module-intro">The character-specific lorebook stays inside the portable card. Empty means no character book.</p>
          ${field('character_book', 'Character book JSON', bookJson, '{ "extensions": {}, "entries": [] }', 16)}
        </section>
        <section class="editor-panel instrument-panel evolution-panel" data-panel="evolution" hidden>
          <header class="module-title"><div><p class="eyebrow">MODULE 05</p><h2>Evolution proposals</h2></div><small>OBSERVE · PROPOSE · DECIDE</small></header>
          <p class="module-intro">Story-derived changes wait here. Nothing rewrites the portable card until you explicitly accept it.</p>
          <div class="proposal-composer">
            ${field('observation', 'Observation', '', 'What repeatedly happened in the story?', 3)}
            ${field('proposal', 'Proposed canon', '', 'The exact long-term wording to propose...', 3)}
            <div class="field-grid compact-grid">
              <label class="field-control"><span class="field-head">Target V2 field</span><select id="proposal-target"><option value="personality">Personality</option><option value="description">Description</option><option value="scenario">Scenario</option><option value="mes_example">Example dialogue</option><option value="creator_notes">Creator notes</option></select></label>
              ${field('source', 'Source', '', 'Scene, session or chapter')}
              ${field('evidence', 'Evidence count', '1', '1')}
              <label class="field-control"><span class="field-head">Confidence <output id="confidence-output">70%</output></span><input id="proposal-confidence" type="range" min="0" max="100" value="70" /></label>
            </div>
            <button type="button" class="machine-button primary" id="add-proposal">ADD PROPOSAL</button>
          </div>
          <div class="proposal-list" id="proposal-list">${record.evolutionProposals.length ? record.evolutionProposals.map(proposalMarkup).join('') : '<p class="empty-note">No evolution proposals yet.</p>'}</div>
        </section>
      </form>
      <aside class="preview-rail instrument-panel" aria-label="Final Character Card V2 preview">
        <header class="panel-heading"><div><p class="eyebrow">LIVE PORTABLE VIEW</p><h2>Final card</h2></div><div class="status-cluster"><i class="lamp live"></i>VALID</div></header>
        <div id="card-preview">${previewMarkup(card)}</div>
      </aside>
    </div>
  `, id ? (card.data.name || 'Edit Character') : 'Create Character', 'CHARACTER FORGE')

  const form = root.querySelector<HTMLFormElement>('#character-form')!

  function syncFromForm(): void {
    for (const key of textFields) {
      const input = form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement | null
      if (input) card.data[key] = input.value
    }
    card.data.tags = ((form.elements.namedItem('tags') as HTMLInputElement)?.value || '').split(',').map((item) => item.trim()).filter(Boolean)
    card.data.alternate_greetings = ((form.elements.namedItem('alternate_greetings') as HTMLTextAreaElement)?.value || '').split(/\n\s*---\s*\n/).map((item) => item.trim()).filter(Boolean)
    const rawBook = (form.elements.namedItem('character_book') as HTMLTextAreaElement)?.value.trim()
    if (!rawBook) delete card.data.character_book
    else card.data.character_book = JSON.parse(rawBook) as CharacterBook
    record.updatedAt = new Date().toISOString()
  }

  function refreshPreview(): void {
    try {
      syncFromForm()
      const result = validateCharacterCardV2(card)
      root.querySelector<HTMLElement>('#card-preview')!.innerHTML = previewMarkup(card)
      const status = root.querySelector<HTMLElement>('.preview-rail .status-cluster')!
      status.innerHTML = `<i class="lamp ${result.success ? 'live' : ''}"></i>${result.success ? 'VALID' : `${result.errors.length} ISSUES`}`
    } catch {
      const status = root.querySelector<HTMLElement>('.preview-rail .status-cluster')!
      status.innerHTML = '<i class="lamp"></i>LORE JSON ERROR'
    }
  }

  form.addEventListener('input', (event) => {
    if ((event.target as HTMLElement).closest('.proposal-composer')) return
    root.querySelector('#save-status')!.textContent = 'UNSAVED LOCAL CHANGES'
    refreshPreview()
  })

  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((tab) => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-selected', String(tab === button)) })
    root.querySelectorAll<HTMLElement>('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== button.dataset.tab })
  }))

  root.querySelector<HTMLInputElement>('#proposal-confidence')?.addEventListener('input', (event) => {
    root.querySelector('#confidence-output')!.textContent = `${(event.currentTarget as HTMLInputElement).value}%`
  })

  const persist = async (): Promise<boolean> => {
    try {
      syncFromForm()
      const result = validateCharacterCardV2(card)
      if (!result.success) throw new Error(result.errors[0])
      await context.characters.save(record)
      root.querySelector('#save-status')!.textContent = 'LOCAL CHECKPOINT SAVED'
      return true
    } catch (error) {
      toast(root, error instanceof Error ? error.message : 'Unable to save', 'error')
      return false
    }
  }

  root.querySelector('#save-card')?.addEventListener('click', async () => {
    if (await persist()) {
      toast(root, 'Character saved')
      if (!id) navigate(`/forge/characters/edit/${record.id}/`)
    }
  })
  root.querySelector('#export-card')?.addEventListener('click', () => {
    try { syncFromForm(); downloadJson(`${pathForName(card.data.name)}.v2.json`, exportCharacterCardV2(card)) }
    catch (error) { toast(root, error instanceof Error ? error.message.split('\n')[0] : 'Export failed', 'error') }
  })

  const bindProposalActions = (): void => {
    root.querySelectorAll<HTMLElement>('[data-proposal]').forEach((element) => {
      const proposalId = element.dataset.proposal!
      element.querySelector('[data-edit-proposal]')?.addEventListener('click', () => element.querySelector<HTMLTextAreaElement>('.proposal-value')?.focus())
      element.querySelectorAll<HTMLButtonElement>('[data-transition]').forEach((button) => button.addEventListener('click', async () => {
        const proposal = record.evolutionProposals.find((item) => item.id === proposalId)
        const edited = element.querySelector<HTMLTextAreaElement>('.proposal-value')?.value.trim()
        if (!proposal || !edited) return
        proposal.proposedValue = edited
        try {
          record = transitionProposal(record, proposalId, button.dataset.transition as EvolutionStatus)
          await context.characters.save(record)
          navigate(`/forge/characters/edit/${record.id}/`)
        } catch (error) { toast(root, error instanceof Error ? error.message : 'Proposal action failed', 'error') }
      }))
    })
  }
  bindProposalActions()

  root.querySelector('#add-proposal')?.addEventListener('click', async () => {
    const observationText = (form.elements.namedItem('observation') as HTMLTextAreaElement).value.trim()
    const proposedValue = (form.elements.namedItem('proposal') as HTMLTextAreaElement).value.trim()
    const source = (form.elements.namedItem('source') as HTMLInputElement).value.trim() || 'Manual observation'
    if (!observationText || !proposedValue) return toast(root, 'Add both an observation and proposed canon.', 'error')
    const observation = { id: uid('obs'), text: observationText, source, createdAt: new Date().toISOString() }
    record.observations.push(observation)
    record.evolutionProposals.push({
      id: uid('proposal'), observationId: observation.id, source, timestamp: new Date().toISOString(),
      confidence: Number(root.querySelector<HTMLInputElement>('#proposal-confidence')!.value) / 100,
      evidenceCount: Math.max(1, Number((form.elements.namedItem('evidence') as HTMLInputElement).value) || 1),
      targetField: root.querySelector<HTMLSelectElement>('#proposal-target')!.value as EvolutionProposal['targetField'],
      proposedValue, status: 'pending',
    })
    await context.characters.save(record)
    navigate(`/forge/characters/edit/${record.id}/`)
  })
}
