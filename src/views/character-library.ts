import { downloadJson, escapeHtml, pathForName, uid } from '../app/html'
import { shell, toast } from '../app/shell'
import { importCharacterCardV2, exportCharacterCardV2 } from '../domain/character-card-v2'
import type { CharacterRecord } from '../domain/character-record'
import type { AppContext, Navigate } from '../app/router'

function recordForImport(card: CharacterRecord['cardV2']): CharacterRecord {
  const now = new Date().toISOString()
  return { id: uid('char'), cardV2: card, developedCanon: [], memories: [], relationships: {}, sceneState: {}, observations: [], evolutionProposals: [], createdAt: now, updatedAt: now }
}

export async function renderCharacterLibrary(root: HTMLElement, context: AppContext, navigate: Navigate): Promise<void> {
  const records = await context.characters.list()
  const cards = records.length ? records.map((record) => `
    <article class="library-card instrument-panel">
      <div class="card-monogram">${escapeHtml(record.cardV2.data.name.slice(0, 2).toUpperCase() || '??')}</div>
      <div class="library-card-copy"><p class="eyebrow">V2 · ${escapeHtml(record.cardV2.data.character_version)}</p><h2>${escapeHtml(record.cardV2.data.name || 'Untitled character')}</h2><p>${escapeHtml(record.cardV2.data.description || 'No description yet.')}</p><div class="tag-row">${record.cardV2.data.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div></div>
      <div class="card-actions"><a class="machine-button primary" href="/forge/characters/edit/${encodeURIComponent(record.id)}/" data-nav>EDIT</a><button class="machine-button" data-export="${escapeHtml(record.id)}">EXPORT</button></div>
    </article>`).join('') : `
    <div class="empty-state instrument-panel"><span>◇</span><h2>No characters yet</h2><p>Create a clean V2 card or import an existing V2 JSON file.</p></div>`

  root.innerHTML = shell('/forge/characters/', `
    <section class="library-toolbar">
      <div><p>${records.length} ${records.length === 1 ? 'character' : 'characters'} in this local repository</p></div>
      <div class="action-row"><label class="machine-button file-button">IMPORT V2 JSON<input id="card-import" type="file" accept="application/json,.json" /></label><a class="machine-button primary" href="/forge/characters/create/" data-nav>NEW CHARACTER</a></div>
    </section>
    <section class="library-grid">${cards}</section>
  `, 'Character Library', 'FORGE · PORTABLE CANON')

  root.querySelector<HTMLInputElement>('#card-import')?.addEventListener('change', async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const card = importCharacterCardV2(await file.text())
      const record = recordForImport(card)
      await context.characters.save(record)
      navigate(`/forge/characters/edit/${record.id}/`)
    } catch (error) {
      toast(root, error instanceof Error ? error.message.split('\n')[0] : 'Import failed', 'error')
    }
  })

  root.querySelectorAll<HTMLButtonElement>('[data-export]').forEach((button) => button.addEventListener('click', async () => {
    const record = await context.characters.get(button.dataset.export!)
    if (!record) return
    downloadJson(`${pathForName(record.cardV2.data.name)}.v2.json`, exportCharacterCardV2(record.cardV2))
  }))
}
