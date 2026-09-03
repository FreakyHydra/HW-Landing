import type { Persona } from '../domain/persona.ts'
import type { WorldRecord } from '../domain/world.ts'
import type { RelationshipDimension, RelationshipRecord, RelationshipState } from './relationship-v2.ts'
import type { RuntimeInhabitant, WorldRuntimeSession } from './world-brain.ts'

const RELATIONSHIP_STORAGE_KEY = 'hw.runtime.relationships.v2'

function continuity(session: WorldRuntimeSession): string {
  return session.history.slice(-14).map((message) => {
    if (message.sender === 'player') return `Player turn\n${message.text}`
    if (message.sender === 'world') return `World reply\n${message.text}`
    return ''
  }).filter(Boolean).join('\n\n')
}

export function compileWorldImpersonationPrompt(input: {
  world: WorldRecord
  session: WorldRuntimeSession
  persona?: Persona
  inhabitants: RuntimeInhabitant[]
  direction?: string
}): string {
  const { world, session, persona, inhabitants } = input
  const location = world.locations.find((item) => item.id === session.currentLocationId)
  return `Write exactly one plausible next PLAYER turn for an ongoing roleplay in ${world.identity.name}.

You are writing only the player's side. Do not write any NPC response, narrator response, consequence, or follow-up after the player's turn.
Preserve the player's established voice, vocabulary, simplicity, slang, rhythm, and level of detail. Do not make the player more literary, formal, emotionally articulate, or knowledgeable than their established persona and recent turns support.
The turn may contain dialogue, action, or both. Return plain text only. No Player: label. No markdown wrappers. No analysis. No notes. No Emotion: or metadata.
Do not invent decisions beyond what is needed for one coherent next turn. Do not force trust, romance, aggression, fear, or other intent unless recent continuity or the optional direction clearly supports it.
Keep knowledge limited to what the player could know from persona, recent continuity, and visible world context.

WORLD
${world.identity.name}: ${world.identity.description}
Technology: ${world.rules.technology}
Current place: ${location ? `${location.name}: ${location.description}` : 'Not exactly established'}
Locally relevant inhabitants: ${inhabitants.map((item) => item.name).join(', ') || 'none named'}

PLAYER PERSONA
${persona ? `Name: ${persona.name}\nPronouns: ${persona.pronouns}\nDescription: ${persona.description}\nAppearance: ${persona.appearance}\nPersonality: ${persona.personality}\nBackground: ${persona.background}\nNotes: ${persona.notes}` : 'No persona is selected. Infer only from recent player turns and do not invent a fixed identity.'}

RECENT CONTINUITY
${continuity(session) || 'No prior turns yet.'}

OPTIONAL PLAYER DIRECTION
${input.direction?.trim() || 'No special direction. Continue naturally from the current situation.'}

Write one player turn only.`
}

export function cleanImpersonatedPlayerTurn(raw: string, characterNames: string[] = []): string {
  let text = raw.trim()
  const lastThinkClose = text.toLowerCase().lastIndexOf('</think>')
  if (lastThinkClose >= 0) text = text.slice(lastThinkClose + '</think>'.length).trim()
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim()
  text = text.replace(/^\s*```(?:text|markdown)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  text = text.replace(/^\s*(?:player user message|player message|user message|player|user)\s*[:：]\s*/i, '').trim()
  text = text.replace(/<\s*\|?(?:user|player|system|assistant)\|?\s*>/gi, '').trim()
  const labels = characterNames.filter(Boolean).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (labels.length) {
    const npcStart = new RegExp(`(?:^|\\n)\\s*(?:${labels.join('|')}|Narrator)\\s*:\\s*`, 'i')
    const match = npcStart.exec(text)
    if (match?.index !== undefined) text = text.slice(0, match.index).trim()
  }
  text = text.replace(/(?:^|\n)\s*(?:Emotion|Mood|State|Analysis|Notes?|Metadata)\s*:\s*[^\n]*\s*$/gi, '').trim()
  return text
}

export function removeRelationshipTurn(turnId: string): void {
  let state: RelationshipState
  try { state = JSON.parse(localStorage.getItem(RELATIONSHIP_STORAGE_KEY) || '{}') as RelationshipState } catch { return }
  let changed = false
  for (const [key, record] of Object.entries(state)) {
    const prior = record.events.filter((event) => event.turnId === turnId)
    if (!prior.length) continue
    const next: RelationshipRecord = structuredClone(record)
    for (const event of prior) {
      next.score -= event.delta
      for (const [dimension, value] of Object.entries(event.dimensionDeltas)) {
        next.dimensions[dimension as RelationshipDimension] -= Number(value)
      }
    }
    next.events = next.events.filter((event) => event.turnId !== turnId)
    next.updatedAt = Date.now()
    state[key] = next
    changed = true
  }
  if (changed) localStorage.setItem(RELATIONSHIP_STORAGE_KEY, JSON.stringify(state))
}
