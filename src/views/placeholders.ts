import { shell } from '../app/shell'

export async function renderPlaceholder(root: HTMLElement, title: string, eyebrow: string, message: string): Promise<void> {
  root.innerHTML = shell(location.pathname, `
    <section class="placeholder-panel instrument-panel">
      <span class="placeholder-mark">◇</span>
      <p class="eyebrow">${eyebrow}</p>
      <h2>${title}</h2>
      <p>${message}</p>
      <a class="machine-button" href="/forge/" data-nav>RETURN TO FORGE</a>
    </section>
  `, title)
}
