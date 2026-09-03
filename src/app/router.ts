import type { CharacterRepository, PersonaRepository } from '../data/repositories'
import { renderCharacterEditor } from '../views/character-editor'
import { renderCharacterLibrary } from '../views/character-library'
import { renderForge } from '../views/forge'
import { renderHome } from '../views/home'
import { renderPersonas } from '../views/personas'
import { renderPlaceholder } from '../views/placeholders'
import { bindShell } from './shell'

export type AppContext = { characters: CharacterRepository; personas: PersonaRepository }
export type Navigate = (path: string) => void

export class AppRouter {
  constructor(private root: HTMLElement, private context: AppContext) {}

  start(): void {
    window.addEventListener('popstate', () => void this.render())
    document.addEventListener('click', (event) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-nav]')
      if (!anchor || anchor.origin !== location.origin || event.defaultPrevented) return
      event.preventDefault()
      this.navigate(anchor.pathname)
    })
    void this.render()
  }

  navigate(path: string): void {
    history.pushState({}, '', path)
    void this.render()
  }

  private async render(): Promise<void> {
    const path = location.pathname.replace(/\/+/g, '/')
    const navigate = (next: string) => this.navigate(next)
    if (path === '/') await renderHome(this.root)
    else if (path === '/forge/' || path === '/forge') await renderForge(this.root)
    else if (path === '/forge/characters/' || path === '/forge/characters') await renderCharacterLibrary(this.root, this.context, navigate)
    else if (path === '/forge/characters/create/' || path === '/forge/characters/create') await renderCharacterEditor(this.root, this.context, navigate)
    else if (/^\/forge\/characters\/edit\/[^/]+\/?$/.test(path)) {
      await renderCharacterEditor(this.root, this.context, navigate, decodeURIComponent(path.split('/')[4]))
    }
    else if (path === '/forge/personas/' || path === '/forge/personas' || path === '/forge/personas/create/' || path === '/forge/personas/create') {
      await renderPersonas(this.root, this.context, navigate, path.includes('/create'))
    }
    else if (path.startsWith('/forge/personas/edit/')) await renderPersonas(this.root, this.context, navigate, true, decodeURIComponent(path.split('/')[4]))
    else if (path === '/forge/lore/' || path === '/forge/worlds/') await renderPlaceholder(this.root, path.includes('lore') ? 'Lore Workshop' : 'World Workshop', 'Forge module reserved', 'The repository boundary is ready. Authoring arrives after the core character and persona flow is proven.')
    else if (path.startsWith('/roleplay')) await renderPlaceholder(this.root, 'Roleplay', 'Arena migration', 'The current roleplay environment remains available during migration. This route is reserved for the new arena, but no imitation or partial chat has been placed here.')
    else if (path.startsWith('/archive')) await renderPlaceholder(this.root, 'Archive', 'History without loss', 'Conversation branches, revisions and exported records will gather here in a later phase.')
    else if (path.startsWith('/settings')) await renderPlaceholder(this.root, 'Settings', 'Platform controls', 'Provider, account and persistence controls will live here. This phase keeps storage local behind repository interfaces.')
    else await renderPlaceholder(this.root, 'Path not found', '404', 'This route has not been forged yet.')
    bindShell(this.root)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
}
