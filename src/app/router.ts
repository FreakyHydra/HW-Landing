import type { CharacterRepository, PersonaRepository, WorldRepository } from '../data/repositories'
import { renderCharacterEditor } from '../views/character-editor'
import { renderCharacterLibrary } from '../views/character-library'
import { renderForge } from '../views/forge'
import { renderHome } from '../views/home'
import { renderImageStudio } from '../views/image-studio'
import { renderPersonas } from '../views/personas'
import { renderPlaceholder } from '../views/placeholders'
import { renderProjectWhispers } from '../views/project-whispers'
import { renderSupport } from '../views/support'
import { renderWorldEditor } from '../views/world-editor'
import { renderWorldLibrary, renderWorldSelectionForCharacter } from '../views/world-library'
import { renderWorldRuntime } from '../views/world-runtime'
import { renderSettings } from '../views/settings'
import { bindShell } from './shell'

export type AppContext = { characters: CharacterRepository; personas: PersonaRepository; worlds: WorldRepository; publicWorlds: WorldRepository }
export type Navigate = (path: string) => void

export class AppRouter {
  constructor(private root: HTMLElement, private context: AppContext) {}

  start(): void {
    window.addEventListener('popstate', () => void this.render())
    document.addEventListener('click', (event) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-nav]')
      if (!anchor || anchor.origin !== location.origin || event.defaultPrevented) return
      event.preventDefault()
      this.navigate(`${anchor.pathname}${anchor.search}`)
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
    let usesShell = true
    if (path === '/') await renderHome(this.root)
    else if (path === '/forge/' || path === '/forge') await renderForge(this.root, this.context)
    else if (path === '/forge/images/' || path === '/forge/images') await renderImageStudio(this.root, this.context)
    else if (path === '/forge/characters/' || path === '/forge/characters') await renderCharacterLibrary(this.root, this.context, navigate)
    else if (path === '/forge/characters/create/' || path === '/forge/characters/create') {
      const worldId = new URLSearchParams(location.search).get('world') || undefined
      if (worldId) await renderCharacterEditor(this.root, this.context, navigate, undefined, worldId)
      else await renderWorldSelectionForCharacter(this.root, this.context)
    }
    else if (/^\/forge\/characters\/edit\/[^/]+\/?$/.test(path)) {
      await renderCharacterEditor(this.root, this.context, navigate, decodeURIComponent(path.split('/')[4]))
    }
    else if (path === '/forge/personas/' || path === '/forge/personas' || path === '/forge/personas/create/' || path === '/forge/personas/create') {
      await renderPersonas(this.root, this.context, navigate, path.includes('/create'))
    }
    else if (path.startsWith('/forge/personas/edit/')) await renderPersonas(this.root, this.context, navigate, true, decodeURIComponent(path.split('/')[4]))
    else if (path === '/forge/worlds/' || path === '/forge/worlds') await renderWorldLibrary(this.root, this.context, navigate)
    else if (path === '/forge/worlds/create/' || path === '/forge/worlds/create') await renderWorldEditor(this.root, this.context, navigate)
    else if (/^\/forge\/worlds\/edit\/[^/]+\/?$/.test(path)) await renderWorldEditor(this.root, this.context, navigate, decodeURIComponent(path.split('/')[4]))
    else if (path === '/support/' || path === '/support') await renderSupport(this.root)
    else if (path === '/experimental/project-whispers/' || path === '/experimental/project-whispers') {
      usesShell = false
      await renderProjectWhispers(this.root)
    }
    else if (/^\/roleplay\/world\/[^/]+\/?$/.test(path)) {
      usesShell = false
      await renderWorldRuntime(this.root, this.context, navigate, decodeURIComponent(path.split('/')[3]))
    }
    else if (path === '/forge/lore/') await renderPlaceholder(this.root, 'Lore Workshop', 'WORLD-ROOTED LORE', 'Lore is authored inside a world so its cultures, locations, families and history remain connected. Open a world to continue.')
    else if (path.startsWith('/roleplay')) await renderPlaceholder(this.root, 'Roleplay', 'Choose a world', 'Enter roleplay from a world in the World Library.')
    else if (path.startsWith('/archive')) await renderPlaceholder(this.root, 'Archive', 'History without loss', 'Conversation branches, revisions and exported records will gather here in a later phase.')
    else if (path.startsWith('/settings')) await renderSettings(this.root)
    else await renderPlaceholder(this.root, 'Path not found', '404', 'This route has not been forged yet.')
    if (usesShell) bindShell(this.root, navigate)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
}
