import { shell } from '../app/shell'

export async function renderHome(root: HTMLElement): Promise<void> {
  root.innerHTML = shell('/', `
    <section class="threshold instrument-panel">
      <div class="threshold-copy">
        <p class="eyebrow">A NEW FOUNDATION</p>
        <h2>Build the people.<br />Then build the worlds.</h2>
        <p>The Forge begins with portable Character Card V2 identity and keeps story growth beside it, visible and deliberate.</p>
        <div class="action-row">
          <a class="machine-button primary" href="/forge/characters/create/" data-nav>CREATE A CHARACTER</a>
          <a class="machine-button" href="/forge/" data-nav>ENTER THE FORGE</a>
        </div>
      </div>
      <div class="canon-orbit" aria-hidden="true"><span>V2</span><i></i><i></i><i></i></div>
    </section>
    <section class="signal-grid" aria-label="Platform foundations">
      <article class="signal-card"><span>01</span><p class="eyebrow">PORTABLE IDENTITY</p><h3>Character Card V2</h3><p>Import, author, validate, preview and export a standard card without trapping it in platform-only state.</p></article>
      <article class="signal-card"><span>02</span><p class="eyebrow">DEVELOPED STATE</p><h3>Growth with consent</h3><p>Observations become proposals. Canon changes only when the author accepts the exact change.</p></article>
      <article class="signal-card muted-card"><span>03</span><p class="eyebrow">NEXT SIGNAL</p><h3>Coda Core</h3><p>A provider-neutral integration boundary is ready for assisted authoring and story analysis.</p></article>
    </section>
  `, 'The New Threshold')
}
