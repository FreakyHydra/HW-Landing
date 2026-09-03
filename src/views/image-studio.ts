import type { AppContext } from '../app/router'
import { escapeHtml, uid } from '../app/html'
import { shell, toast } from '../app/shell'
import { LocalImageAssetRepository } from '../data/image-assets'
import { buildWorldImagePrompt, createFreeNovelAiRequest, estimateNovelAiCost, type ImageAspect } from '../image/image-generation'
import { NovelAiImageProvider } from '../image/novelai'

const imageAssets = new LocalImageAssetRepository()
const provider = new NovelAiImageProvider()

function aspectButton(value: ImageAspect, current: ImageAspect, label: string): string {
  return `<button type="button" class="machine-button ${current === value ? 'primary' : ''}" data-image-aspect="${value}">${label}</button>`
}

export async function renderImageStudio(root: HTMLElement, context: AppContext): Promise<void> {
  const worlds = await context.worlds.list()
  const selectedId = new URLSearchParams(location.search).get('world') || worlds[0]?.id || ''
  const selectedWorld = selectedId ? await context.worlds.get(selectedId) : undefined
  const initialAspect: ImageAspect = 'landscape'
  const initialPrompt = selectedWorld ? buildWorldImagePrompt(selectedWorld) : ''
  const request = createFreeNovelAiRequest('world', selectedId || 'world', initialPrompt, '', initialAspect)
  const estimate = estimateNovelAiCost(request)
  const previous = selectedWorld ? await imageAssets.listForEntity('world', selectedWorld.id) : []
  const latest = previous[0]
  const previewUrl = latest ? URL.createObjectURL(latest.blob) : ''

  root.innerHTML = shell('/forge/images/', `
    <section class="editor-toolbar instrument-panel">
      <a href="/forge/" data-nav class="text-link">← FORGE</a>
      <div class="editor-status"><i class="lamp live"></i><span>NAI IMAGEGEN V5 · LOCAL ASSETS</span></div>
    </section>
    <div class="dashboard-grid">
      <section class="editor-panel instrument-panel">
        <header class="module-title"><div><p class="eyebrow">IMAGE STUDIO</p><h2>World cover</h2></div><small>FREE-FIRST NOVELAI V5</small></header>
        ${worlds.length ? `
          <label class="field-control"><span class="field-head">World</span><select id="image-world">${worlds.map((world) => `<option value="${escapeHtml(world.id)}" ${world.id === selectedId ? 'selected' : ''}>${escapeHtml(world.identity.name || 'Untitled world')}</option>`).join('')}</select></label>
          <label class="field-control"><span class="field-head">NovelAI Persistent API token</span><input id="nai-token" type="password" autocomplete="off" placeholder="Token is used for this request only" /></label>
          <p class="empty-note">The token is not written to Forge storage. NovelAI requires third-party applications to use a user's Persistent API token.</p>
          <label class="field-control"><span class="field-head">Prompt</span><textarea id="image-prompt" rows="10">${escapeHtml(initialPrompt)}</textarea></label>
          <label class="field-control"><span class="field-head">Undesired content / negative prompt</span><textarea id="image-negative" rows="4" placeholder="Optional"></textarea></label>
          <div class="action-row" aria-label="Aspect ratio">${aspectButton('landscape', initialAspect, 'LANDSCAPE 1216×832')}${aspectButton('portrait', initialAspect, 'PORTRAIT 832×1216')}${aspectButton('square', initialAspect, 'SQUARE 1024×1024')}</div>
          <section class="inheritance-callout"><i class="lamp live"></i><div><strong id="image-cost">${estimate.label}</strong><p id="image-cost-detail">1 image · Normal resolution · 28 steps · text-to-image</p></div></section>
          <div class="action-row"><button type="button" class="machine-button primary" id="generate-world-cover">GENERATE COVER</button><button type="button" class="machine-button" id="rebuild-image-prompt">REBUILD PROMPT FROM WORLD</button></div>
        ` : '<div class="empty-state"><h3>Create a world first</h3><p>Image Studio builds covers from World Forge context.</p><a class="machine-button primary" href="/forge/worlds/create/" data-nav>CREATE WORLD</a></div>'}
      </section>
      <aside class="editor-panel instrument-panel">
        <header class="module-title"><div><p class="eyebrow">PREVIEW</p><h2>Cover asset</h2></div><small>STAYS ON THIS DEVICE</small></header>
        <div id="image-preview" style="min-height:360px;display:grid;place-items:center;overflow:hidden;border-radius:var(--radius-card);background:var(--surface-inset);border:1px solid var(--border-subtle)">${previewUrl ? `<img src="${previewUrl}" alt="Latest generated world cover" style="display:block;width:100%;height:auto;object-fit:contain" />` : '<p class="empty-note">Your generated cover will appear here.</p>'}</div>
        <p class="empty-note" id="image-save-note">${latest ? `Latest local asset: ${new Date(latest.createdAt).toLocaleString()}` : 'Generated images are stored in IndexedDB, not localStorage or cloud storage.'}</p>
      </aside>
    </div>
  `, 'Image Studio', 'FORGE VISUALS')

  if (!worlds.length || !selectedWorld) return

  let aspect: ImageAspect = initialAspect
  const prompt = root.querySelector<HTMLTextAreaElement>('#image-prompt')!
  const negative = root.querySelector<HTMLTextAreaElement>('#image-negative')!
  const token = root.querySelector<HTMLInputElement>('#nai-token')!
  const generate = root.querySelector<HTMLButtonElement>('#generate-world-cover')!
  const preview = root.querySelector<HTMLElement>('#image-preview')!
  const saveNote = root.querySelector<HTMLElement>('#image-save-note')!

  const refreshCost = () => {
    const next = createFreeNovelAiRequest('world', selectedWorld.id, prompt.value, negative.value, aspect)
    const nextEstimate = estimateNovelAiCost(next)
    const cost = root.querySelector<HTMLElement>('#image-cost')
    if (cost) cost.textContent = nextEstimate.label
  }

  root.querySelector<HTMLSelectElement>('#image-world')?.addEventListener('change', (event) => {
    const worldId = (event.currentTarget as HTMLSelectElement).value
    history.replaceState({}, '', `/forge/images/?world=${encodeURIComponent(worldId)}`)
    void renderImageStudio(root, context)
  })

  root.querySelectorAll<HTMLButtonElement>('[data-image-aspect]').forEach((button) => button.addEventListener('click', () => {
    aspect = button.dataset.imageAspect as ImageAspect
    root.querySelectorAll<HTMLButtonElement>('[data-image-aspect]').forEach((item) => item.classList.toggle('primary', item === button))
    refreshCost()
  }))

  root.querySelector<HTMLButtonElement>('#rebuild-image-prompt')?.addEventListener('click', () => {
    prompt.value = buildWorldImagePrompt(selectedWorld)
    toast(root, 'Prompt rebuilt from current world canon.')
  })

  generate.addEventListener('click', async () => {
    const apiToken = token.value.trim()
    if (!apiToken) return toast(root, 'Enter your NovelAI Persistent API token.', 'error')
    if (!prompt.value.trim()) return toast(root, 'The image prompt is empty.', 'error')
    const next = createFreeNovelAiRequest('world', selectedWorld.id, prompt.value, negative.value, aspect)
    const nextEstimate = estimateNovelAiCost(next)
    if (!nextEstimate.freeEligible) return toast(root, 'These settings are outside the free-first preset.', 'error')

    generate.disabled = true
    generate.textContent = 'GENERATING…'
    try {
      const result = await provider.generate(next, apiToken)
      const asset = {
        id: uid('image'),
        entityType: 'world' as const,
        entityId: selectedWorld.id,
        provider: 'novelai' as const,
        model: next.model,
        prompt: next.prompt,
        negativePrompt: next.negativePrompt,
        aspect: next.aspect,
        width: next.dimensions.width,
        height: next.dimensions.height,
        steps: next.steps,
        createdAt: new Date().toISOString(),
        mimeType: result.mimeType,
        blob: result.blob,
      }
      await imageAssets.save(asset)
      const url = URL.createObjectURL(result.blob)
      preview.innerHTML = `<img src="${url}" alt="Generated world cover" style="display:block;width:100%;height:auto;object-fit:contain" />`
      saveNote.textContent = 'Saved locally to Forge image storage. Nothing was uploaded to cloud storage.'
      toast(root, 'World cover generated and saved locally.')
    } catch (error) {
      toast(root, error instanceof Error ? error.message : 'Image generation failed.', 'error')
    } finally {
      generate.disabled = false
      generate.textContent = 'GENERATE COVER'
    }
  })
}
