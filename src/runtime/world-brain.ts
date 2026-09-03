import type { CharacterRecord } from '../domain/character-record.ts'
import type { Persona } from '../domain/persona.ts'
import type { FamilyPerson, WorldLocation, WorldRecord, WorldSociety } from '../domain/world.ts'
import type { RelationshipRecord } from './relationship-v2.ts'
import { relationshipTier } from './relationship-v2.ts'

export type WorldRuntimeMessage = {
  id: string
  sender: 'player' | 'world' | 'system'
  text: string
  createdAt: string
}

export type WorldRuntimeSession = {
  worldId: string
  personaId?: string
  currentLocationId?: string
  history: WorldRuntimeMessage[]
  createdAt: string
  updatedAt: string
}

export type RuntimeInhabitant = {
  id: string
  name: string
  description: string
  familyId?: string
  character?: CharacterRecord
}

function locationAncestors(world: WorldRecord, id?: string): string[] {
  if (!id) return []
  const locations = new Map(world.locations.map((location) => [location.id, location]))
  const result: string[] = []
  let cursor = locations.get(id)
  const seen = new Set<string>()
  while (cursor && !seen.has(cursor.id)) {
    result.push(cursor.id)
    seen.add(cursor.id)
    cursor = cursor.parentLocationId ? locations.get(cursor.parentLocationId) : undefined
  }
  return result
}

export function chooseInitialLocation(world: WorldRecord): WorldLocation | undefined {
  const preferred = ['settlement', 'town', 'village', 'district', 'building', 'region', 'subregion', 'major region', 'continent']
  for (const kind of preferred) {
    const location = world.locations.find((item) => item.kind === kind)
    if (location) return location
  }
  return world.locations[0]
}

export function relevantSocieties(world: WorldRecord, currentLocationId?: string): WorldSociety[] {
  const ancestry = new Set(locationAncestors(world, currentLocationId))
  return world.societies.filter((society) =>
    [...society.settlementLocationIds, ...society.territoryLocationIds].some((id) => ancestry.has(id)),
  )
}

export function resolveRuntimeInhabitants(
  world: WorldRecord,
  characters: CharacterRecord[],
  currentLocationId?: string,
): RuntimeInhabitant[] {
  const societies = relevantSocieties(world, currentLocationId)
  const familyIds = new Set(societies.flatMap((society) => society.familyIds))
  const ancestry = new Set(locationAncestors(world, currentLocationId))
  const characterById = new Map(characters.map((character) => [character.id, character]))
  const inhabitants = new Map<string, RuntimeInhabitant>()

  const addPerson = (person: FamilyPerson, familyId: string) => {
    const character = person.characterId ? characterById.get(person.characterId) : undefined
    const id = person.characterId || person.id
    inhabitants.set(id, { id, name: person.name, description: person.description, familyId, character })
  }

  for (const family of world.families) {
    if (!familyIds.has(family.id)) continue
    for (const person of family.people) addPerson(person, family.id)
  }

  for (const character of characters) {
    if (character.worldId !== world.id) continue
    const homeRelevant = character.homeLocationId ? ancestry.has(character.homeLocationId) : false
    const familyRelevant = world.families.some((family) => familyIds.has(family.id) && character.familyPersonIds.some((id) => family.people.some((person) => person.id === id)))
    const factionRelevant = societies.some((society) => character.factionIds.some((id) => society.factionIds.includes(id)))
    if (!homeRelevant && !familyRelevant && !factionRelevant) continue
    inhabitants.set(character.id, {
      id: character.id,
      name: character.cardV2.data.name || character.id,
      description: character.cardV2.data.description,
      character,
    })
  }

  return [...inhabitants.values()]
}

function locationTrail(world: WorldRecord, currentLocationId?: string): WorldLocation[] {
  const ids = locationAncestors(world, currentLocationId)
  const map = new Map(world.locations.map((location) => [location.id, location]))
  return ids.map((id) => map.get(id)).filter((item): item is WorldLocation => Boolean(item)).reverse()
}

function compactCharacter(inhabitant: RuntimeInhabitant): string {
  const record = inhabitant.character
  if (!record) return `${inhabitant.name}: ${inhabitant.description}`
  const data = record.cardV2.data
  return [
    `${inhabitant.name}: ${data.description || inhabitant.description}`,
    data.personality && `Personality: ${data.personality}`,
    data.scenario && `Current framing: ${data.scenario}`,
    record.memories.length && `Personal memory: ${record.memories.slice(-5).join(' | ')}`,
    record.developedCanon.length && `Developed canon: ${record.developedCanon.slice(-5).join(' | ')}`,
    data.system_prompt && `Character instruction: ${data.system_prompt}`,
  ].filter(Boolean).join('\n')
}

function relationshipText(inhabitant: RuntimeInhabitant, relationship?: RelationshipRecord): string {
  if (!relationship) return `${inhabitant.name}: Stranger, no accumulated runtime relationship yet.`
  const significant = Object.entries(relationship.dimensions)
    .filter(([, value]) => Math.abs(value) >= 2)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 6)
    .map(([key, value]) => `${key} ${value >= 0 ? '+' : ''}${value}`)
  const aftereffects = relationship.events.slice(-3).flatMap((event) => event.causalMemory.aftereffects).slice(-5)
  return `${inhabitant.name}: ${relationshipTier(relationship.score)} (${relationship.score}).${significant.length ? ` Dimensions: ${significant.join(', ')}.` : ''}${aftereffects.length ? ` Recent relational aftereffects: ${aftereffects.join(', ')}.` : ''}`
}

function continuityText(session: WorldRuntimeSession): string {
  return session.history.slice(-18).map((message) => {
    if (message.sender === 'player') return `Recent player input\n${message.text}`
    if (message.sender === 'world') return `Resulting world prose\n${message.text}`
    return ''
  }).filter(Boolean).join('\n\n')
}

function sandboxProsePolicy(): string {
  return `PROSE QUALITY POLICY
- Write polished fiction with precise vocabulary, varied sentence structure, controlled description, natural scene rhythm, subtext, and character-specific dialogue.
- Character voice is authoritative. Preserve each character's vocabulary, education, dialect, slang, rhythm, temperament, and established speech habits. Do not homogenize voices.
- Do not reduce characters to stereotypes based on role, species, occupation, traits, or archetype.
- Prefer concrete detail, natural progression, individual voices, meaningful dialogue, and implication over explanation.
- Avoid generic AI filler, canned emotional shorthand, repetitive sentence structures, excessive summarization, obvious emotional over-explanation, forced slang, stock sensory reactions, meta commentary, moral summaries, and thematic closing summaries.
- Show emotion through dialogue, posture, timing, choices, hesitation, and behavior. Never append labels such as Emotion:, Mood:, State:, Thoughts:, or Relationship:.
- Keep knowledge limited. A character knows only what they witnessed, were told, discovered, remember, or can reasonably infer.
- Preserve established history, relationships, injuries, possessions, promises, unfinished events, and current mood. Do not reset familiarity or repeat introductions without cause.
- Characters remain autonomous. They may hesitate, disagree, conceal information, misunderstand, make mistakes, refuse, or pursue their own goals.`
}

export function compileWorldRuntimePrompt(input: {
  world: WorldRecord
  session: WorldRuntimeSession
  playerTurn: string
  inhabitants: RuntimeInhabitant[]
  persona?: Persona
  relationships?: Record<string, RelationshipRecord | undefined>
}): string {
  const { world, session, playerTurn, inhabitants, persona } = input
  const trail = locationTrail(world, session.currentLocationId)
  const current = trail.at(-1)
  const societies = relevantSocieties(world, session.currentLocationId)
  const factionIds = new Set(societies.flatMap((society) => society.factionIds))
  const factions = world.factions.filter((faction) => factionIds.has(faction.id))
  const familyIds = new Set(societies.flatMap((society) => society.familyIds))
  const relevantMemories = world.memories.filter((memory) =>
    memory.visibility === 'common'
    || memory.locationIds.some((id) => trail.some((location) => location.id === id))
    || memory.familyIds.some((id) => familyIds.has(id))
    || memory.factionIds.some((id) => factionIds.has(id)),
  ).slice(-12)
  const history = continuityText(session)
  const allowedPlaceNames = trail.map((location) => location.name)
  const allowedProperNouns = [
    world.identity.name,
    ...allowedPlaceNames,
    ...societies.map((society) => society.name),
    ...factions.map((faction) => faction.name),
    ...inhabitants.map((inhabitant) => inhabitant.name),
    ...world.species.map((species) => species.name),
  ].filter(Boolean)

  return `You are the living world runtime for ${world.identity.name}. You are not a selected character and you are not an assistant inside the fiction.

OUTPUT CONTRACT
Return only finished roleplay prose suitable for direct display to the player.
Never output speaker labels such as "Ragna Holt:", "Pip Holt:", "Narrator:", "Player:", or any Name: prefix.
Never use square brackets for actions.
Never produce screenplay, chat transcript, RPG log, cast list, metadata, or stage directions.
Write narration as ordinary prose and dialogue inside quotation marks.
Treat the player's latest input as already completed. Do not restate it, paraphrase it, narrate it back, or complete it for them.
Never begin by saying the player moves, walks, looks, feels, notices, decides, reaches, follows, turns, approaches, or otherwise performs the action they just supplied.
Never decide the player's dialogue, thoughts, feelings, intentions, reactions, perceptions, or future actions.
Do not output hidden reasoning, analysis, think tags, instructions, generation notes, control text, or commentary about the generation.

${sandboxProsePolicy()}

CORE RUNTIME RULES
- Continue the world as an ongoing reality. There is no mandatory scene and no mandatory primary character.
- The inhabitant list is a list of people who could plausibly matter here. It does NOT mean they are automatically standing beside the player. Do not materialize everyone just because they are listed.
- A short casual player line should normally receive a short natural answer. Default to 1-3 paragraphs and roughly 60-180 words unless the action genuinely needs more.
- Multiple inhabitants may participate when the situation warrants it, but do not force everyone to speak.
- Preserve each inhabitant's personality, knowledge, authority, family ties, boundaries, memories, and relationship state independently.
- The world exists even when no named inhabitant is present. Silence, ordinary activity, distance, weather, work, wildlife, and environment are valid responses.
- Do not invent new named NPCs, families, settlements, rivers, landmarks, factions, roads, clans, passes, mountains, or geographic features.
- Do not invent specific geography, buildings, occupations, family facts, local history, trade routes, landmarks, destinations, equipment, scars, clothing details, insignia, or physical traits merely to enrich the prose unless they are supplied by canon.
- Unnamed background people may exist when ordinary life requires them, but keep them generic until canon gives them a name.
- Never invent modern technology that contradicts the world rules.
- Treat supplied canon as fact. Do not overwrite it merely to make a scene easier.

GROUNDING
The only named places allowed in this turn are: ${allowedPlaceNames.join(', ') || 'none supplied'}.
Other allowed canon names: ${allowedProperNouns.filter((name) => !allowedPlaceNames.includes(name)).join(', ') || 'none supplied'}.
If a name or place is not listed above or established verbatim in recent continuity, do not create it.
When uncertain, stay generic instead of inventing a name.

WORLD ROOT
Name: ${world.identity.name}
Genre: ${world.identity.genre}
Tone: ${world.identity.tone}
Description: ${world.identity.description}
Technology: ${world.rules.technology}
Magic / physics: ${world.rules.magicPhysics}
Society: ${world.rules.society}
Constraints: ${world.rules.constraints.join(' | ')}
History: ${world.lore.history}
Cultures: ${world.lore.cultures}
Customs: ${world.lore.customs}
Important facts: ${world.lore.importantFacts.join(' | ')}

CURRENT PLACE
${current ? `${current.name} (${current.kind}): ${current.description}` : 'No exact location has been established yet.'}
Location path: ${trail.map((location) => location.name).join(' > ') || 'Unspecified'}

RELEVANT PEOPLES AND POWER
${societies.length ? societies.map((society) => `${society.name} (${society.type}): ${society.description} Status: ${society.currentStatus}`).join('\n') : 'No specific society is currently resolved.'}
${factions.length ? `Relevant factions:\n${factions.map((faction) => `${faction.name}: ${faction.description}`).join('\n')}` : ''}

POTENTIALLY RELEVANT INHABITANTS, NOT AUTOMATICALLY PRESENT
${inhabitants.length ? inhabitants.map(compactCharacter).join('\n\n') : 'No named inhabitant is required to be present. Let the world itself carry the moment until someone plausibly appears.'}

RELATIONSHIP V2 STATE
${inhabitants.length ? inhabitants.map((inhabitant) => relationshipText(inhabitant, input.relationships?.[inhabitant.id])).join('\n') : 'No active character relationship state.'}

PLAYER PERSONA
${persona ? `Name: ${persona.name}\nPronouns: ${persona.pronouns}\nDescription: ${persona.description}\nAppearance: ${persona.appearance}\nPersonality: ${persona.personality}\nBackground: ${persona.background}\nNotes: ${persona.notes}` : 'No persona selected. Do not invent a player identity.'}

RELEVANT WORLD MEMORY
${relevantMemories.length ? relevantMemories.map((memory) => `${memory.title} (${memory.occurredAt}): ${memory.description}${memory.persistentEffects.length ? ` Effects: ${memory.persistentEffects.join(' | ')}` : ''}`).join('\n') : 'No additional world memory is relevant.'}

RECENT CONTINUITY
${history || 'This is the beginning of this world session.'}

CURRENT PLAYER INPUT
${playerTurn}

The player's input above has already happened. Begin with what the world or its inhabitants do next. Continue naturally as finished prose only. No labels. No brackets. No metadata. No unsupported names or details.`
}

export class LocalWorldRuntimeSessionRepository {
  private key(worldId: string): string { return `hw.runtime.world.${worldId}.v1` }

  has(worldId: string): boolean {
    return localStorage.getItem(this.key(worldId)) !== null
  }

  get(worldId: string): WorldRuntimeSession | undefined {
    try {
      const value = localStorage.getItem(this.key(worldId))
      return value ? JSON.parse(value) as WorldRuntimeSession : undefined
    } catch { return undefined }
  }

  save(session: WorldRuntimeSession): void {
    localStorage.setItem(this.key(session.worldId), JSON.stringify(session))
  }

  clear(worldId: string): void {
    localStorage.removeItem(this.key(worldId))
  }

  create(world: WorldRecord, now = new Date().toISOString()): WorldRuntimeSession {
    const session: WorldRuntimeSession = {
      worldId: world.id,
      currentLocationId: chooseInitialLocation(world)?.id,
      history: [],
      createdAt: now,
      updatedAt: now,
    }
    this.save(session)
    return session
  }

  reset(world: WorldRecord, now = new Date().toISOString()): WorldRuntimeSession {
    this.clear(world.id)
    return this.create(world, now)
  }
}