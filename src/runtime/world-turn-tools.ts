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
  return `Write the next PLAYER turn for the ongoing roleplay in ${world.identity.name}.

Do not add behavioral, moral, relationship, romance, aggression, affection, or scene restrictions of your own. The creator's world rules, persona definition, character definitions, current continuity, and the user's direction are authoritative. Preserve those rules and continue from them rather than replacing them with generic defaults.

This generator is only filling the player's turn slot. Return the playable player turn itself without labels, analysis, instructions, or generation commentary. The world response is generated separately.

WORLD
${world.identity.name}: ${world.identity.description}
Technology: ${world.rules.technology}
World rules: ${world.rules.constraints.join(' | ') || 'No additional explicit constraints supplied.'}
Current place: ${location ? `${location.name}: ${location.description}` : 'Not exactly established'}
Locally relevant inhabitants: ${inhabitants.map((item) => item.name).join(', ') || 'none named'}

PLAYER PERSONA
${persona ? `Name: ${persona.name}\nPronouns: ${persona.pronouns}\nDescription: ${persona.description}\nAppearance: ${persona.appearance}\nPersonality: ${persona.personality}\nBackground: ${persona.background}\nNotes: ${persona.notes}` : 'No persona is selected. Use recent player turns and current world context.'}

RECENT CONTINUITY
${continuity(session) || 'No prior turns yet.'}

USER DIRECTION
${input.direction?.trim() || 'Continue from the current situation using the established rules and persona.'}

Write the next player turn.`
}

function stripLeakedImpersonationDirective(text: string): string {
  const lines = text.split(/\r?\n/)
  const directive = /^(?:do not|don't|only write|write only|return only|stop before|do not finish|do not continue|the world runtime|npc response|narrator response|player-turn format|instructions?\b)/i
  while (lines.length && directive.test(lines[0].trim())) lines.shift()
  return lines.join('\n').trim()
}

export function cleanImpersonatedPlayerTurn(raw: string, characterNames: string[] = []): string {
  let text = raw.trim()
  const lastThinkClose = text.toLowerCase().lastIndexOf('</think>')
  if (lastThinkClose >= 0) text = text.slice(lastThinkClose + '</think>'.length).trim()
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim()
  text = text.replace(/^\s*```(?:text|markdown)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  text = text.replace(/^\s*(?:player user message|player message|user message|player|user)\s*[:：]\s*/i, '').trim()
  text = text.replace(/<\s*\|?(?:user|player|system|assistant)\|?\s*>/gi, '').trim()
  text = stripLeakedImpersonationDirective(text)
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
