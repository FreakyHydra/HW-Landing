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
  const codaRequested = new URLSearchParams(location.search).get('tool') === 'coda'

  root.innerHTML = shell('/forge/', `
    <section class="dashboard-hero instrument-panel">
      <div><p class="eyebrow">WORLD-FIRST CREATIVE SYSTEM</p><h2>Build the reality. Let every story grow inside it.</h2><p>Worlds hold rules, places, people and persistent history. Portable V2 characters connect to that context without duplicating or silently rewriting it.</p><div class="action-row"><a class="machine-button primary" href="/forge/worlds/create/" data-nav>CREATE NEW WORLD</a><a class="machine-button" href="/forge/worlds/" data-nav>VIEW WORLD LIBRARY</a></div></div>
      <aside class="dashboard-note"><strong>FOUNDATION ORDER</strong><p>World canon comes first. Characters inherit only the context that is relevant to them.</p></aside>
    </section>
    <section class="stat-grid" aria-label="Forge overview">
      <article class="stat-card"><b>${worlds.length}</b><span>Worlds</span></article>
      <article class="stat-card"><b>${characters.length}</b><span>World-bound characters</span></article>
      <article class="stat-card"><b>${families}</b><span>Families</span></article>
      <article class="stat-card"><b>${memories}</b><span>World memories</span></article>
    </section>
    <section class="dashboard-grid">
      <article class="dashboard-section instrument-panel"><header class="section-heading"><div><p class="eyebrow">RETURN TO A REALITY</p><h2>Recent worlds</h2></div><a href="/forge/worlds/" data-nav>VIEW ALL</a></header><div class="recent-world-list">
        ${recentWorlds.length ? recentWorlds.map((world) => `<a class="recent-world-item" href="/forge/worlds/edit/${encodeURIComponent(world.id)}/" data-nav><span>${escapeHtml(world.identity.name.slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(world.identity.name)}</strong><small>${world.locations.length} places · ${world.families.length} families · ${world.memories.length} memories</small></div><b>OPEN →</b></a>`).join('') : '<div class="empty-note">No worlds yet. Create the first reality container to begin.</div>'}
      </div></article>
      <article class="dashboard-section instrument-panel"><header class="section-heading"><div><p class="eyebrow">CURRENT STATE</p><h2>Activity</h2></div></header><div class="activity-list">
        ${recentWorlds.length ? recentWorlds.slice(0, 3).map((world) => `<p><strong>${escapeHtml(world.identity.name)}</strong><br />Updated ${new Date(world.updatedAt).toLocaleDateString()}</p>`).join('') : '<p>World activity will appear here as realities are created and developed.</p>'}
        <p><strong>${personas.length} ${personas.length === 1 ? 'persona' : 'personas'}</strong><br />Player identity remains separate from Character Card V2.</p>
      </div></article>
    </section>
    <section class="coda-dock instrument-panel" ${codaRequested ? 'tabindex="-1"' : ''}><div class="status-cluster"><i class="lamp"></i><span>CODA CORE · PHASE 4</span></div><div><h3>Provider-neutral integration boundary ready</h3><p>Coda will receive world context before future character generation, lore work, memory analysis or development proposals. No disconnected mock assistant has been added.</p></div><button class="machine-button" disabled>COMING LATER</button></section>
  `, 'The Forge', 'CREATIVE CONTROL CENTER')

  if (codaRequested) root.querySelector<HTMLElement>('.coda-dock')?.focus()
}
