import { escapeHtml } from './html'
import { getThemePreference, setThemePreference, type ThemePreference } from './theme'

const searchRoutes = [
  ['home', '/forge/'], ['forge', '/forge/'], ['worlds', '/forge/worlds/'], ['create world', '/forge/worlds/create/'],
  ['characters', '/forge/characters/'], ['personas', '/forge/personas/'], ['families', '/forge/worlds/?section=families'],
  ['peoples', '/forge/worlds/?section=societies'], ['societies', '/forge/worlds/?section=societies'], ['clans', '/forge/worlds/?section=societies'], ['tribes', '/forge/worlds/?section=societies'],
  ['factions', '/forge/worlds/?section=people'], ['locations', '/forge/worlds/?section=places'], ['lore', '/forge/worlds/?section=lore'],
  ['timeline', '/forge/worlds/?section=memory'], ['world memory', '/forge/worlds/?section=memory'], ['images', '/forge/images/'],
  ['image studio', '/forge/images/'], ['project whispers', '/experimental/project-whispers/'], ['experimental', '/experimental/project-whispers/'], ['settings', '/settings/'],
] as const

function navLink(path: string, href: string, label: string, icon: string): string {
  const hrefPath = href.split('?')[0]
  const active = href.includes('?') ? false
    : hrefPath === '/forge/' ? path === '/forge/'
      : hrefPath === '/forge/worlds/' ? path === '/forge/worlds/' || path.startsWith('/forge/worlds/edit/')
        : path === hrefPath
  return `<a href="${href}" data-nav ${active ? 'aria-current="page"' : ''}><i aria-hidden="true">${icon}</i><span>${label}</span></a>`
}

export function shell(path: string, content: string, title: string, eyebrow = 'THE HOWLING WHISPERS'): string {
  document.title = `${title} · The Howling Whispers`
  const theme = getThemePreference()
  return `
    <div class="app-frame">
      <aside class="app-rail" id="primary-nav" aria-label="Platform navigation">
        <a class="brand" href="/" data-nav aria-label="The Howling Whispers home">
          <img src="/hw-logo.png" alt="" />
          <span><small>HOWLING WHISPERS</small><strong>WORLD FORGE</strong></span>
        </a>
        <nav class="rail-navigation">
          <div class="nav-group nav-home">${navLink(path, '/forge/', 'Home', '⌂')}</div>
          <div class="nav-group"><p>WORLD</p>${navLink(path, '/forge/worlds/', 'Worlds', '◎')}${navLink(path, '/forge/worlds/create/', 'Create World', '+')}${navLink(path, '/forge/worlds/', 'Recent Worlds', '◷')}</div>
          <div class="nav-group"><p>LIBRARY</p>${navLink(path, '/forge/characters/', 'Characters', '◇')}${navLink(path, '/forge/personas/', 'Personas', '◉')}${navLink(path, '/forge/worlds/?section=societies', 'Peoples & Societies', '◌')}${navLink(path, '/forge/worlds/?section=families', 'Families', '⌘')}${navLink(path, '/forge/worlds/?section=people', 'Factions', '△')}${navLink(path, '/forge/worlds/?section=places', 'Locations', '⌖')}${navLink(path, '/forge/worlds/?section=lore', 'Lore', '≡')}${navLink(path, '/forge/worlds/?section=memory', 'Timeline', '↝')}${navLink(path, '/forge/worlds/?section=memory', 'World Memory', '◫')}</div>
          <div class="nav-group"><p>TOOLS</p>${navLink(path, '/forge/images/', 'Image Studio', '▧')}${navLink(path, '/forge/characters/', 'Import / Export', '⇄')}${navLink(path, '/settings/', 'Settings', '⚙')}</div>
          <div class="nav-group"><p>EXPERIMENTAL</p>${navLink(path, '/experimental/project-whispers/', 'Project Whispers', '◈')}</div>
        </nav>
        <div class="rail-footer"><p>APPEARANCE</p><div class="quick-theme" aria-label="Quick theme selection">${(['system','light','dark'] as ThemePreference[]).map((choice) => `<button type="button" data-quick-theme="${choice}" class="${theme === choice ? 'active' : ''}" aria-pressed="${theme === choice}" title="${choice} theme">${choice === 'system' ? 'S' : choice === 'light' ? '☀' : '☾'}</button>`).join('')}</div><div class="rail-status"><i class="lamp live"></i><span>LOCAL FORGE</span></div></div>
      </aside>
      <button class="rail-backdrop" type="button" aria-label="Close navigation" hidden></button>
      <section class="app-content">
        <header class="app-header">
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav"><span></span><span></span><span></span><b>Menu</b></button>
          <div class="topbar-identity"><small>${escapeHtml(eyebrow)}</small><strong>${escapeHtml(title)}</strong></div>
          <form class="app-search" role="search"><span aria-hidden="true">⌕</span><input type="search" name="query" placeholder="Jump to worlds, characters, lore..." aria-label="Search platform navigation" /></form>
          <div class="topbar-status"><i class="lamp live"></i><span>WORLD ROOT ACTIVE</span></div>
        </header>
        <main class="app-main">
          <header class="page-head"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1></div></header>
          ${content}
        </main>
        <footer class="app-footer"><span>HOWLING WHISPERS · REBRAND V2</span><span>WORLD ROOT · PORTABLE CHARACTER CANON</span></footer>
      </section>
    </div>
    <div class="toast" role="status" aria-live="polite" hidden></div>
  `
}

export function bindShell(root: HTMLElement, navigate: (path: string) => void): void {
  const toggle = root.querySelector<HTMLButtonElement>('.menu-toggle')
  const rail = root.querySelector<HTMLElement>('.app-rail')
  const backdrop = root.querySelector<HTMLButtonElement>('.rail-backdrop')
  const setOpen = (open: boolean) => {
    toggle?.setAttribute('aria-expanded', String(open))
    rail?.classList.toggle('open', open)
    if (backdrop) backdrop.hidden = !open
  }
  toggle?.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'))
  backdrop?.addEventListener('click', () => setOpen(false))
  window.onkeydown = (event) => { if (event.key === 'Escape') setOpen(false) }

  root.querySelector<HTMLFormElement>('.app-search')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const query = String(new FormData(event.currentTarget as HTMLFormElement).get('query') || '').trim().toLowerCase()
    const match = searchRoutes.find(([label]) => label.includes(query) || query.includes(label))
    if (match && query) navigate(match[1])
  })

  root.querySelectorAll<HTMLButtonElement>('[data-quick-theme]').forEach((button) => button.addEventListener('click', () => {
    const choice = button.dataset.quickTheme as ThemePreference
    setThemePreference(choice)
    root.querySelectorAll<HTMLButtonElement>('[data-quick-theme]').forEach((item) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)) })
  }))
}

export function toast(root: HTMLElement, message: string, tone: 'normal' | 'error' = 'normal'): void {
  const element = root.querySelector<HTMLElement>('.toast')
  if (!element) return
  element.textContent = message
  element.dataset.tone = tone
  element.hidden = false
  window.setTimeout(() => { element.hidden = true }, 2800)
}
