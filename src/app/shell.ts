import { escapeHtml } from './html'

const nav = [
  ['/', 'Threshold'],
  ['/forge/', 'Forge'],
  ['/roleplay/', 'Roleplay'],
  ['/archive/', 'Archive'],
  ['/settings/', 'Settings'],
] as const

export function shell(path: string, content: string, title: string, eyebrow = 'THE HOWLING WHISPERS'): string {
  const active = path.startsWith('/forge') ? '/forge/' : nav.find(([href]) => href === path)?.[0] || ''
  document.title = `${title} · The Howling Whispers`
  return `
    <div class="app-frame">
      <header class="app-header">
        <a class="brand" href="/" data-nav aria-label="The Howling Whispers home">
          <img src="/hw-logo.png" alt="" />
          <span><small>THE HOWLING WHISPERS</small><strong>RP PLATFORM</strong></span>
        </a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav"><span></span><span></span><span></span><b>Menu</b></button>
        <nav class="primary-nav" id="primary-nav" aria-label="Primary navigation">
          ${nav.map(([href, label]) => `<a href="${href}" data-nav ${active === href ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
        </nav>
        <div class="system-status"><i class="lamp live"></i><span>LOCAL FORGE</span></div>
      </header>
      <main class="app-main">
        <header class="page-head">
          <div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1></div>
        </header>
        ${content}
      </main>
      <footer class="app-footer"><span>HOWLING WHISPERS · REBRAND V2</span><span>PORTABLE CANON · LOCAL WORKING STATE</span></footer>
    </div>
    <div class="toast" role="status" aria-live="polite" hidden></div>
  `
}

export function bindShell(root: HTMLElement): void {
  const toggle = root.querySelector<HTMLButtonElement>('.menu-toggle')
  const nav = root.querySelector<HTMLElement>('.primary-nav')
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!open))
    nav?.classList.toggle('open', !open)
  })
}

export function toast(root: HTMLElement, message: string, tone: 'normal' | 'error' = 'normal'): void {
  const element = root.querySelector<HTMLElement>('.toast')
  if (!element) return
  element.textContent = message
  element.dataset.tone = tone
  element.hidden = false
  window.setTimeout(() => { element.hidden = true }, 2800)
}
