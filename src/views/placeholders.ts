import { html } from '../app/html'

export function placeholderView(title: string, description: string): HTMLElement {
  return html(`
    <section class="placeholder-view">
      <h1>${title}</h1>
      <p>${description}</p>
    </section>
  `)
}
