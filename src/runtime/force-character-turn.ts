import { CanonicalPublicWorldRepository } from '../data/canonical-public-worlds.ts'
import { LocalCharacterRepository, LocalPersonaRepository, LocalWorldRepository } from '../data/repositories.ts'
import { getNovelAiRuntimeSettings } from './novelai-settings.ts'
import { WorldRuntimeNovelAiProvider } from './novelai.ts'
import { getRoleplayTextColors } from './roleplay-visual-settings.ts'
import { LocalRelationshipRepository, DEFAULT_PERSONA_ID } from './relationship-v2.ts'
import { compileWorldRuntimePrompt, LocalWorldRuntimeSessionRepository, resolveRuntimeInhabitants, type RuntimeInhabitant, type WorldRuntimeMessage } from './world-brain.ts'

function appendColoredText(target: HTMLElement, text: string): void {
  const colors = getRoleplayTextColors()
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|“[^”\n]+”|"[^"\n]+")/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      const narration = document.createElement('span')
      narration.className = 'world-runtime-narration'
      narration.style.color = colors.narration
      narration.textContent = text.slice(cursor, index)
      target.append(narration)
    }
    const token = match[0]
    const span = document.createElement('span')
    if (token.startsWith('**')) {
      span.className = 'world-runtime-dialogue'
      span.style.color = colors.dialogue
      span.textContent = token.slice(2, -2)
    } else if (token.startsWith('*')) {
      span.className = 'world-runtime-action'
      span.style.color = colors.action
      span.textContent = token.slice(1, -1)
    } else {
      span.className = 'world-runtime-dialogue'
      span.style.color = colors.dialogue
      span.textContent = token
    }
    target.append(span)
    cursor = index + token.length
  }
  if (cursor < text.length) {
    const narration = document.createElement('span')
    narration.className = 'world-runtime-narration'
    narration.style.color = colors.narration
    narration.textContent = text.slice(cursor)
    target.append(narration)
  }
}

function appendSystem(text: string): void {
  const story = document.querySelector<HTMLElement>('.world-runtime-story')
  if (!story) return
  const article = document.createElement('article')
  article.className = 'world-runtime-message system'
  const body = document.createElement('div')
  body.className = 'world-runtime-message-body'
  body.textContent = text
  article.append(body)
  story.append(article)
  story.scrollTop = story.scrollHeight
}

function appendWorldMessage(message: WorldRuntimeMessage): void {
  const story = document.querySelector<HTMLElement>('.world-runtime-story')
  if (!story) return
  const article = document.createElement('article')
  article.className = 'world-runtime-message world'
  article.dataset.messageId = message.id
  const body = document.createElement('div')
  body.className = 'world-runtime-message-body'
  appendColoredText(body, message.text)
  article.append(body)
  story.append(article)
  story.scrollTop = story.scrollHeight
}

function findTarget(name: string, inhabitants: RuntimeInhabitant[]): RuntimeInhabitant | undefined {
  const query = name.trim().toLowerCase()
  if (!query) return undefined
  const exact = inhabitants.find((item) => item.name.toLowerCase() === query)
  if (exact) return exact
  const firstMatches = inhabitants.filter((item) => item.name.trim().split(/\s+/)[0]?.toLowerCase() === query)
  if (firstMatches.length === 1) return firstMatches[0]
  const partial = inhabitants.filter((item) => item.name.toLowerCase().includes(query))
  return partial.length === 1 ? partial[0] : undefined
}

function contextTarget(inhabitants: RuntimeInhabitant[], history: WorldRuntimeMessage[]): RuntimeInhabitant | undefined {
  for (const message of [...history].reverse()) {
    const text = message.text.toLowerCase()
    const exact = inhabitants.filter((item) => text.includes(item.name.toLowerCase()))
    if (exact.length === 1) return exact[0]
    const first = inhabitants.filter((item) => {
      const name = item.name.trim().split(/\s+/)[0]?.toLowerCase()
      return name ? new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text) : false
    })
    if (first.length === 1) return first[0]
  }
  return inhabitants.length === 1 ? inhabitants[0] : undefined
}

export async function forceCharacterTurn(name = ''): Promise<void> {
  const runtime = document.querySelector<HTMLElement>('.world-runtime[data-world-id]')
  const form = document.querySelector<HTMLFormElement>('.world-runtime-prompt')
  const input = form?.querySelector<HTMLTextAreaElement>('textarea')
  if (!runtime || !form || !input || input.disabled) return
  const worldId = runtime.dataset.worldId
  if (!worldId) return

  const localWorlds = new LocalWorldRepository()
  const publicWorlds = new CanonicalPublicWorldRepository()
  const world = (await localWorlds.get(worldId)) ?? (await publicWorlds.get(worldId))
  if (!world) return appendSystem('Could not resolve the current world.')

  const [characters, personas] = await Promise.all([new LocalCharacterRepository().list(), new LocalPersonaRepository().list()])
  const sessionRepository = new LocalWorldRuntimeSessionRepository()
  const session = sessionRepository.get(worldId)
  if (!session) return appendSystem('No active world session was found.')
  const inhabitants = resolveRuntimeInhabitants(world, characters, session.currentLocationId)
  if (!inhabitants.length) return appendSystem('No named character is currently resolved here.')

  const explicitTarget = name.trim() ? findTarget(name, inhabitants) : undefined
  if (name.trim() && !explicitTarget) {
    appendSystem(`Could not uniquely resolve “${name}”. Available here: ${inhabitants.map((item) => item.name).join(', ')}`)
    return
  }
  const inferredTarget = explicitTarget ?? contextTarget(inhabitants, session.history)
  const turnCandidates = inferredTarget ? [inferredTarget] : inhabitants

  const persona = session.personaId ? personas.find((item) => item.id === session.personaId) : personas[0]
  const personaId = persona?.id || DEFAULT_PERSONA_ID
  const relationshipRepository = new LocalRelationshipRepository()
  const relationships = Object.fromEntries(turnCandidates.map((item) => [item.id, relationshipRepository.get(item.id, personaId)]))
  const lastPlayer = [...session.history].reverse().find((message) => message.sender === 'player')
  const playerTurn = lastPlayer?.text || 'Continue from the established scene without adding a new player action.'
  const basePrompt = compileWorldRuntimePrompt({
    world,
    session,
    playerTurn,
    inhabitants: turnCandidates,
    persona,
    relationships,
  })
  const prompt = inferredTarget
    ? `${basePrompt}\n\nNEXT CHARACTER TURN\n${inferredTarget.name} is the character whose turn is contextually due. Continue naturally from the existing scene. Do not require another player action first.`
    : `${basePrompt}\n\nNEXT CHARACTER TURN\nChoose whichever currently relevant character is most naturally due to respond next from the recent context. Continue the scene without requiring another player action first. Do not explain the selection.`

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  const impersonate = form.querySelector<HTMLButtonElement>('.world-runtime-impersonate')
  input.disabled = true
  if (submit) submit.disabled = true
  if (impersonate) impersonate.disabled = true
  try {
    const nai = getNovelAiRuntimeSettings()
    const reply = await new WorldRuntimeNovelAiProvider().generate({
      prompt,
      model: nai.model,
      maxTokens: nai.maxTokens,
      temperature: nai.temperature,
      characterNames: inhabitants.map((item) => item.name),
    }, nai.token)
    const message: WorldRuntimeMessage = { id: crypto.randomUUID(), sender: 'world', text: reply, createdAt: new Date().toISOString() }
    session.history.push(message)
    session.updatedAt = message.createdAt
    sessionRepository.save(session)
    appendWorldMessage(message)
  } catch (error) {
    appendSystem(error instanceof Error ? error.message : 'Could not generate the next character turn.')
  } finally {
    input.disabled = false
    if (submit) submit.disabled = false
    if (impersonate) impersonate.disabled = false
    input.focus()
  }
}

function handleSubmit(event: Event): void {
  const form = event.target as HTMLFormElement
  if (!form.matches('.world-runtime-prompt')) return
  const input = form.querySelector<HTMLTextAreaElement>('textarea')
  if (!input || input.disabled) return
  const value = input.value.trim()

  if (!value) {
    event.preventDefault()
    event.stopImmediatePropagation()
    void forceCharacterTurn()
    return
  }

  const match = value.match(/^\/(?:character|char|force)(?:\s+(.*))?$/i)
  if (!match) return
  event.preventDefault()
  event.stopImmediatePropagation()
  input.value = ''
  input.style.height = 'auto'
  void forceCharacterTurn(match[1] || '')
}

document.addEventListener('submit', handleSubmit, true)

export function installForceCharacterTurn(): void {}
