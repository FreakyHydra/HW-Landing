import './style.css'
import './styles/world-runtime-visuals.css'
import './styles/roleplay-visual-settings.css'
import './styles/roleplay-layouts.css'
import './styles/recent-worlds.css'
import './styles/world-command-palette.css'
import './views/world-time-weather-editor'
import { AppRouter } from './app/router'
import { LocalCharacterRepository, LocalPersonaRepository, LocalWorldRepository } from './data/repositories'
import { CanonicalPublicWorldRepository } from './data/canonical-public-worlds'
import { installPlayerMessageColors } from './runtime/player-message-colors'
import { installRoleplayLengthControls } from './runtime/roleplay-length-controls'
import { installWorldCommandPalette } from './runtime/world-command-palette'
import { installForceCharacterTurn } from './runtime/force-character-turn'
import { installWorldMessageControls } from './runtime/world-message-controls'
import { installRoleplayLayoutSettings } from './runtime/roleplay-layout-settings'
import { installFramedRoleplayLayout } from './runtime/framed-roleplay-layout'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Application root is missing')

installPlayerMessageColors()
installRoleplayLengthControls()
installWorldCommandPalette()
installForceCharacterTurn()
installWorldMessageControls()
installRoleplayLayoutSettings()
installFramedRoleplayLayout()

const router = new AppRouter(app, {
  characters: new LocalCharacterRepository(),
  personas: new LocalPersonaRepository(),
  worlds: new LocalWorldRepository(),
  publicWorlds: new CanonicalPublicWorldRepository(),
})

router.start()