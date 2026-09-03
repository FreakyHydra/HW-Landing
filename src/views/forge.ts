import { shell } from '../app/shell'

export async function renderForge(root: HTMLElement): Promise<void> {
  root.innerHTML = shell('/forge/', `
    <section class="module-intro-bar"><div><i class="lamp live"></i><span>FORGE FOUNDATION ACTIVE</span></div><p>Portable identity stays separate from developed story state.</p></section>
    <section class="forge-grid">
      <a class="forge-module instrument-panel" href="/forge/characters/" data-nav><span class="module-index">01</span><div><p class="eyebrow">STANDARD V2</p><h2>Characters</h2><p>Author portable cards and review the runtime state that grows around them.</p></div><b>OPEN MODULE ↗</b></a>
      <a class="forge-module instrument-panel" href="/forge/personas/" data-nav><span class="module-index">02</span><div><p class="eyebrow">PLAYER IDENTITY</p><h2>Personas</h2><p>Create the player’s place in the fiction without disguising it as a character card.</p></div><b>OPEN MODULE ↗</b></a>
      <a class="forge-module instrument-panel secondary" href="/forge/lore/" data-nav><span class="module-index">03</span><div><p class="eyebrow">RESERVED</p><h2>Lore</h2><p>Character books and shared world knowledge will be composed here.</p></div><b>VIEW SHELL ↗</b></a>
      <a class="forge-module instrument-panel secondary" href="/forge/worlds/" data-nav><span class="module-index">04</span><div><p class="eyebrow">RESERVED</p><h2>Worlds</h2><p>World identity, rules and connected lore remain a separate domain.</p></div><b>VIEW SHELL ↗</b></a>
    </section>
    <section class="coda-dock instrument-panel"><div class="status-cluster"><i class="lamp"></i><span>CODA CORE · NOT CONNECTED</span></div><div><h3>Integration rail prepared</h3><p>Generation, expansion, story analysis, observations, proposals, canon comparison, lore and persona assistance have typed event boundaries. No Discord dependency is present.</p></div><button class="machine-button" disabled>COMING LATER</button></section>
  `, 'The Forge', 'AUTHORING WORKBENCH')
}
