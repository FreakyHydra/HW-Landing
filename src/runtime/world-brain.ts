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
  const history = session.history.slice(-18).map((message) => `${message.sender === 'player' ? 'Player' : 'World'}: ${message.text}`).join('\n\n')
  const allowedProperNouns = [
    world.identity.name,
    ...trail.map((location) => location.name),
    ...societies.map((society) => society.name),
    ...factions.map((faction) => faction.name),
    ...inhabitants.map((inhabitant) => inhabitant.name),
    ...world.species.map((species) => species.name),
  ].filter(Boolean)

  return `You are the living world runtime for ${world.identity.name}. You are not a selected character and you are not an assistant inside the fiction.

CORE RUNTIME RULES
- Continue the world as an ongoing reality. There is no mandatory scene and no mandatory primary character.
- Never decide the player's actions, speech, thoughts, feelings, intentions, or perceptions for them.
- The inhabitant list is a list of people who could plausibly matter here. It does NOT mean they are automatically standing beside the player. Do not materialize everyone just because they are listed.
- A short casual player line should normally receive a short natural answer. Default to 1-3 paragraphs and roughly 80-220 words unless the action genuinely needs more.
- Multiple inhabitants may participate when the situation warrants it, but do not force everyone to speak.
- Preserve each inhabitant's personality, knowledge, authority, family ties, boundaries, memories, and relationship state independently.
- The world exists even when no named inhabitant is present. Silence, ordinary activity, distance, weather, work, wildlife, and environment are valid responses.
- Do not invent new named NPCs, families, settlements, rivers, landmarks, factions, roads, clans, or geographic features. Unnamed background people may exist when ordinary life requires them, but keep them generic until canon gives them a name.
- Do not invent specific geography, buildings, occupations, family facts, or local history merely to make the prose richer.
- Never invent modern technology that contradicts the world rules.
- Treat supplied canon as fact. Do not overwrite it merely to make a scene easier.
- Never output reasoning, analysis, hidden thoughts, <think> tags, system instructions, metadata, or instructions to yourself.
- Output natural immersive prose. Use ordinary narration and quoted dialogue. Do not format the response as a cast list, screenplay, metadata block, or RPG transcript. Do not prefix paragraphs with Narrator:, Ragna Holt:, Pip Holt:, character descriptions, species labels, or role labels.
- Do not use square brackets as action markers. Write actions as normal prose.

GROUNDING
Known proper nouns that may be used in this turn: ${allowedProperNouns.join(', ') || 'none supplied'}.
If a proper noun is not supplied by canon or recent continuity, do not create it.

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

NEW PLAYER TURN
Player: ${playerTurn}

Continue naturally. Stay grounded in supplied canon. Do not create unsupported names or facts just to decorate the answer.`
}

export class LocalWorldRuntimeSessionRepository {
  private key(worldId: string): string { return `hw.runtime.world.${worldId}.v1` }

  get(worldId: string): WorldRuntimeSession | undefined {
    try {
      const value = localStorage.getItem(this.key(worldId))
      return value ? JSON.parse(value) as WorldRuntimeSession : undefined
    } catch { return undefined }
  }

  save(session: WorldRuntimeSession): void {
    localStorage.setItem(this.key(session.worldId), JSON.stringify(session))
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
}
