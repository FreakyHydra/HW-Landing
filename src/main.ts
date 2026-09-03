import './style.css'
import { AppRouter } from './app/router'
import { LocalCharacterRepository, LocalPersonaRepository } from './data/repositories'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Application root is missing')

const router = new AppRouter(app, {
  characters: new LocalCharacterRepository(),
  personas: new LocalPersonaRepository(),
})

router.start()
