import type { AppContext } from '../app/router'
import { escapeHtml } from '../app/html'
import { shell } from '../app/shell'

export async function renderForge(root: HTMLElement, context: AppContext): Promise<void> {
  const [worlds, characters, personas] = await Promise.all([
    context.worlds.list(), context.characters.list(), context.personas.list(),
  ])
  const recentWorlds = [...worlds].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const families = worlds.reduce((total, world) => total + world.families.length, 0)
  const memories = worlds.reduce((total, world) => total + world.memories.length, 0)
  const locations = worlds.reduce((total, world) => total + world.locations.length, 0)

  root.innerHTML = shell('/forge/', `
    <section class="forge-welcome-grid">
      <article class="forge-welcome-card">
        <div class="forge-welcome-copy">
          <p class="eyebrow">WORLD FORGE</p>
          <h2>Welcome back, explorer.</h2>
          <p>Shape living worlds, build their history, and let every character grow from the reality around them.</p>
          <div class="action-row">
            <a class="machine-button primary" href="/forge/worlds/create/" data-nav>CREATE NEW WORLD</a>
            <a class="machine-button" href="/forge/worlds/" data-nav>OPEN LIBRARY</a>
          </div>
        </div>
        <div class="forge-world-orbit" aria-hidden="true">
          <span>◎</span>
          <i></i><i></i><i></i>
        </div>
      </article>

      <aside class="forge-overview-card">
        <header>
          <div><p class="eyebrow">WORLD OVERVIEW</p><h3>At a glance</h3></div>
          <a href="/forge/worlds/" data-nav>VIEW ALL</a>
        </header>
        <div class="overview-metrics">
          <div><b>${worlds.length}</b><span>Worlds</span></div>
          <div><b>${characters.length}</b><span>Characters</span></div>
          <div><b>${families}</b><span>Families</span></div>
          <div><b>${locations}</b><span>Locations</span></div>
        </div>
      </aside>
    </section>

    <section class="forge-section-block">
      <header class="section-heading clean-heading">
        <div><p class="eyebrow">YOUR WORLDS</p><h2>Recent worlds</h2></div>
        <a href="/forge/worlds/" data-nav>VIEW ALL</a>
      </header>
      <div class="world-card-grid">
        ${recentWorlds.length ? recentWorlds.map((world) => `
          <a class="world-preview-card" href="/forge/worlds/edit/${encodeURIComponent(world.id)}/" data-nav>
            <div class="world-preview-mark">${escapeHtml(world.identity.name.slice(0, 1).toUpperCase())}</div>
            <div class="world-preview-body">
              <strong>${escapeHtml(world.identity.name)}</strong>
              <p>${escapeHtml(world.identity.description || 'A living world waiting to be developed.')}</p>
              <small>${world.locations.length} locations · ${world.families.length} families · ${world.memories.length} memories</small>
            </div>
            <span class="world-preview-open">OPEN</span>
          </a>
        `).join('') : `
          <a class="world-preview-card world-preview-empty" href="/forge/worlds/create/" data-nav>
            <div class="world-preview-mark">+</div>
            <div class="world-preview-body"><strong>Create your first world</strong><p>Worlds are the root of characters, lore, families, memory and future roleplay.</p><small>START BUILDING</small></div>
          </a>
        `}
      </div>
    </section>

    <section class="forge-bottom-grid">
      <article class="forge-soft-panel">
        <header class="section-heading clean-heading"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>What changed</h2></div></header>
        <div class="activity-list clean-activity">
          ${recentWorlds.length ? recentWorlds.slice(0, 3).map((world) => `<p><strong>${escapeHtml(world.identity.name)}</strong><span>Updated ${new Date(world.updatedAt).toLocaleDateString()}</span></p>`).join('') : '<p><strong>No world activity yet</strong><span>Your recent changes will appear here.</span></p>'}
          <p><strong>${personas.length} ${personas.length === 1 ? 'persona' : 'personas'}</strong><span>Player identity remains separate from Character Card V2.</span></p>
        </div>
      </article>

      <article class="forge-soft-panel forge-notes-panel">
        <header class="section-heading clean-heading"><div><p class="eyebrow">WORLD MEMORY</p><h2>Persistent canon</h2></div></header>
        <p>World memory stores facts that become true for the shared reality. Private chats and story transcripts remain local.</p>
        <div class="memory-summary"><b>${memories}</b><span>world memories recorded</span></div>
      </article>
    </section>
  `, 'The Forge', 'CREATIVE CONTROL CENTER')
}
