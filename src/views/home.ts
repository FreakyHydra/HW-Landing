import { shell } from '../app/shell'

export async function renderHome(root: HTMLElement): Promise<void> {
  root.innerHTML = shell('/', `
    <section class="threshold instrument-panel">
      <div class="threshold-copy">
        <p class="eyebrow">A NEW FOUNDATION</p>
        <h2>Build the world.<br />Then let it live.</h2>
        <p>Rules, places, families and remembered history come first. Characters are forged inside that reality, not dropped into it afterward.</p>
        <div class="action-row">
          <a class="machine-button primary" href="/forge/worlds/create/" data-nav>CREATE A WORLD</a>
          <a class="machine-button" href="/forge/" data-nav>ENTER THE FORGE</a>
        </div>
      </div>
      <div class="canon-orbit" aria-hidden="true"><span>V2</span><i></i><i></i><i></i></div>
    </section>
    <section class="signal-grid" aria-label="Platform foundations">
      <article class="signal-card"><span>01</span><p class="eyebrow">ROOT REALITY</p><h3>World Forge</h3><p>A small living container for lore, locations, families, factions, rules, timeline and persistent world memory.</p></article>
      <article class="signal-card"><span>02</span><p class="eyebrow">INHERITED CONTEXT</p><h3>World-bound characters</h3><p>Standard V2 identity stays portable while references connect a character to the reality that shaped them.</p></article>
      <article class="signal-card muted-card"><span>03</span><p class="eyebrow">LIVING HISTORY</p><h3>The world remembers</h3><p>Deaths, discoveries, conflicts and persistent changes become shared facts that relevant characters can inherit.</p></article>
    </section>
  `, 'The New Threshold')
}
