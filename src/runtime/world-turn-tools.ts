import type { Persona } from '../domain/persona.ts'
import type { WorldRecord } from '../domain/world.ts'
import type { RelationshipDimension, RelationshipRecord, RelationshipState } from './relationship-v2.ts'
import { compileWorldAuthorityContext, type RuntimeInhabitant, type WorldRuntimeSession } from './world-brain.ts'

const RELATIONSHIP_STORAGE_KEY = 'hw.runtime.relationships.v2'

export function compileWorldImpersonationPrompt(input: {
  world: WorldRecord
  session: WorldRuntimeSession
  persona?: Persona
  inhabitants: RuntimeInhabitant[]
  relationships?: Record<string, RelationshipRecord | undefined>
  direction?: string
}): string {
  const { world, session, persona, inhabitants } = input
  const direction = input.direction?.trim() || 'Continue from the current situation using the established rules and persona.'
  const authorityContext = compileWorldAuthorityContext({
    world,
    session,
    currentTurn: direction,
    currentTurnHeading: 'Explicit user direction for the player-side turn:',
    inhabitants,
    persona,
    relationships: input.relationships,
  })
  return `Write one plausible next PLAYER turn for the ongoing roleplay in ${world.identity.name}.

${authorityContext}

IMPERSONATION OUTPUT CONTRACT
You are only filling the player's turn slot. The world response is generated separately. This generator does not change canon, relationship state, scene state, or any character sheet.
The creator's world rules and established canon are authoritative.
Follow the supplied persona and explicit user direction. Do not add behavioral, moral, relationship, romance, aggression, affection, or scene restrictions of your own.
Do not write any NPC response, narrator response, world reaction, outcome, or continuation beyond the player's own dialogue and actions.
Do not decide that an ambiguous player action has a strong intent unless the user direction or established context supplies that intent.

USER DIRECTION
${direction}

Return only the playable player turn itself without a label, analysis, instructions, metadata, or generation commentary.`
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
