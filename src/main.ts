import './style.css'
import { AppRouter } from './app/router'
import { LocalCharacterRepository, LocalPersonaRepository, LocalWorldRepository } from './data/repositories'
import { CanonicalPublicWorldRepository } from './data/canonical-public-worlds'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Application root is missing')

const router = new AppRouter(app, {
  characters: new LocalCharacterRepository(),
  personas: new LocalPersonaRepository(),
  worlds: new LocalWorldRepository(),
  publicWorlds: new CanonicalPublicWorldRepository(),
})

router.start()
