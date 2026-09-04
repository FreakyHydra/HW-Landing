import type { CharacterRecord } from '../domain/character-record.ts'
import type { Persona } from '../domain/persona.ts'
import type { FamilyPerson, WorldLocation, WorldRecord, WorldSociety } from '../domain/world.ts'
import { worldTimeWeatherOf } from '../domain/world.ts'
import { resolveCharacterWorldContext } from '../domain/world-context.ts'
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

function authoredEntries(values: Record<string, string>, empty: string): string {
  const entries = Object.entries(values).filter(([, value]) => value.trim())
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join('\n') : empty
}

function familyCanon(world: WorldRecord, inhabitant: RuntimeInhabitant): string {
  const family = inhabitant.familyId
    ? world.families.find((item) => item.id === inhabitant.familyId)
    : world.families.find((item) => item.people.some((person) => person.characterId === inhabitant.id))
  if (!family) return ''
  const person = family.people.find((item) => item.characterId === inhabitant.id || item.id === inhabitant.id || item.name === inhabitant.name)
  if (!person) return `Family: ${family.name}. ${family.description}`
  const names = new Map(family.people.map((item) => [item.id, item.name]))
  const relationships = family.relationships.filter((item) => item.fromPersonId === person.id || item.toPersonId === person.id).map((item) => {
    const otherId = item.fromPersonId === person.id ? item.toPersonId : item.fromPersonId
    return `${item.kind} with ${names.get(otherId) || otherId}${item.notes ? `: ${item.notes}` : ''}`
  })
  return [`Family: ${family.name}. ${family.description}`, relationships.length && `Family relationships: ${relationships.join(' | ')}`].filter(Boolean).join('\n')
}

function characterBookCanon(record: CharacterRecord): string {
  const entries = record.cardV2.data.character_book?.entries
    .filter((entry) => entry.enabled && entry.content.trim())
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.insertion_order - b.insertion_order)
  if (!entries?.length) return ''
  return entries.map((entry) => `${entry.name || entry.comment || entry.keys.join(', ') || 'Character-book entry'}: ${entry.content}`).join('\n')
}

function compactCharacter(world: WorldRecord, inhabitant: RuntimeInhabitant): string {
  const record = inhabitant.character
  if (!record) return [`Name: ${inhabitant.name}`, `Identity and established facts: ${inhabitant.description}`, familyCanon(world, inhabitant)].filter(Boolean).join('\n')
  const data = record.cardV2.data
  const context = resolveCharacterWorldContext(record, world)
  const extensions = Object.keys(data.extensions).length ? JSON.stringify(data.extensions, null, 2) : ''
  return [
    `Name: ${inhabitant.name}`,
    `Identity and physical facts: ${data.description || inhabitant.description}`,
    data.personality && `Personality: ${data.personality}`,
    context.species && `Species: ${context.species.name}. ${context.species.description}`,
    context.homeLocation && `Home: ${context.homeLocation.name}. ${context.homeLocation.description}`,
    context.factions.length && `Faction ties: ${context.factions.map((faction) => `${faction.name}: ${faction.description}`).join(' | ')}`,
    familyCanon(world, inhabitant),
    data.scenario && `Authored scenario: ${data.scenario}`,
    record.developedCanon.length && `Developed canon: ${record.developedCanon.join(' | ')}`,
    record.memories.length && `Personal memory: ${record.memories.join(' | ')}`,
    context.relevantMemories.length && `Known world memory: ${context.relevantMemories.map((memory) => `${memory.title}: ${memory.description}`).join(' | ')}`,
    Object.keys(record.relationships).length && `Authored relationships:\n${authoredEntries(record.relationships, '')}`,
    Object.keys(record.sceneState).length && `Current character scene state:\n${authoredEntries(record.sceneState, '')}`,
    data.mes_example && `Speech and behavior examples: ${data.mes_example}`,
    data.first_mes && `Authored greeting example: ${data.first_mes}`,
    data.system_prompt && `Authored character instruction: ${data.system_prompt}`,
    data.post_history_instructions && `Authored post-history instruction: ${data.post_history_instructions}`,
    characterBookCanon(record) && `Authored character-book canon:\n${characterBookCanon(record)}`,
    extensions && `Authored card extensions:\n${extensions}`,
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
  return session.history.slice(-24).map((message) => {
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

function societyCanon(society: WorldSociety): string {
  return [
    `${society.name} (${society.type}, ${society.canonStatus}): ${society.description}`,
    society.origin && `Origin: ${society.origin}`,
    society.territoryNotes && `Territory: ${society.territoryNotes}`,
    society.seasonalMovement && `Seasonal movement: ${society.seasonalMovement}`,
    `Lifestyle: ${society.lifestyle}`,
    society.kinshipBasis && `Kinship: ${society.kinshipBasis}`,
    society.membershipRules && `Membership: ${society.membershipRules}`,
    society.leadershipStructure && `Leadership: ${society.leadershipStructure}`,
    society.decisionMaking && `Decision-making: ${society.decisionMaking}`,
    society.customs && `Customs: ${society.customs}`,
    society.beliefs && `Beliefs: ${society.beliefs}`,
    society.languageDialect && `Language / dialect: ${society.languageDialect}`,
    society.livelihood && `Livelihood: ${society.livelihood}`,
    society.currentStatus && `Current status: ${society.currentStatus}`,
  ].filter(Boolean).join('\n')
}

function runtimeTimeText(world: WorldRecord, session: WorldRuntimeSession): string {
  const settings = worldTimeWeatherOf(world)
  const start = `Starting state: day ${settings.startingDay}, hour ${settings.startingHour} of a ${settings.hoursPerDay}-hour day.`
  let current = 'The exact current clock time is not established.'
  if (settings.mode === 'tick') {
    const turns = session.history.filter((message) => message.sender === 'player').length
    const minutesPerDay = settings.hoursPerDay * 60
    const totalMinutes = settings.startingHour * 60 + turns * settings.minutesPerInput
    const day = settings.startingDay + Math.floor(totalMinutes / minutesPerDay)
    const withinDay = totalMinutes % minutesPerDay
    current = `Current runtime clock: day ${day}, ${String(Math.floor(withinDay / 60)).padStart(2, '0')}:${String(withinDay % 60).padStart(2, '0')} after ${turns} player turn${turns === 1 ? '' : 's'}.`
  }
  const seasonLength = settings.seasons.reduce((sum, season) => sum + season.lengthDays, 0)
  let season = settings.seasons[0]
  if (settings.seasonsEnabled && seasonLength > 0 && settings.mode === 'tick') {
    const turns = session.history.filter((message) => message.sender === 'player').length
    const elapsedDays = Math.floor((settings.startingHour * 60 + turns * settings.minutesPerInput) / (settings.hoursPerDay * 60))
    let seasonDay = (settings.startingDay - 1 + elapsedDays) % seasonLength
    season = settings.seasons.find((item) => {
      if (seasonDay < item.lengthDays) return true
      seasonDay -= item.lengthDays
      return false
    }) || season
  }
  return [
    start,
    current,
    settings.climate && `Climate: ${settings.climate}`,
    settings.weatherPrompt && `Authored weather rule: ${settings.weatherPrompt}`,
    settings.seasonsEnabled && season && `Current season: ${season.name}${season.weatherPrompt ? `. Authored season rule: ${season.weatherPrompt}` : ''}`,
  ].filter(Boolean).join('\n')
}

export type WorldAuthorityContextInput = {
  world: WorldRecord
  session: WorldRuntimeSession
  currentTurn: string
  currentTurnHeading: string
  inhabitants: RuntimeInhabitant[]
  persona?: Persona
  relationships?: Record<string, RelationshipRecord | undefined>
}

export function compileWorldAuthorityContext(input: WorldAuthorityContextInput): string {
  const { world, session, currentTurn, currentTurnHeading, inhabitants, persona } = input
  const trail = locationTrail(world, session.currentLocationId)
  const current = trail.at(-1)
  const societies = relevantSocieties(world, session.currentLocationId)
  const factionIds = new Set([...societies.flatMap((society) => society.factionIds), ...inhabitants.flatMap((inhabitant) => inhabitant.character?.factionIds ?? [])])
  const factions = world.factions.filter((faction) => factionIds.has(faction.id))
  const familyIds = new Set(societies.flatMap((society) => society.familyIds))
  const characterIds = new Set(inhabitants.map((inhabitant) => inhabitant.id))
  const relevantMemories = world.memories.filter((memory) =>
    memory.visibility === 'common'
    || memory.locationIds.some((id) => trail.some((location) => location.id === id))
    || memory.familyIds.some((id) => familyIds.has(id))
    || memory.factionIds.some((id) => factionIds.has(id))
    || memory.affectedCharacterIds.some((id) => characterIds.has(id)),
  )
  const latestWorld = [...session.history].reverse().find((message) => message.sender === 'world')
  const history = continuityText(session)

  return `CURRENT TURN - HIGHEST AUTHORITY
${currentTurnHeading}
${currentTurn || 'No new action was supplied. Continue only from the established scene.'}

AUTHORITY ORDER
Resolve conflicts in this order: explicit current user instruction; current scene state and established continuity; user-authored world rules; established world canon; current location facts; character sheets; persona sheet; authored relationship and runtime state; recent generated continuity; general improvisation.
Authored facts and rules are facts of the current fiction. Do not contradict, weaken, silently rewrite, or replace them. Recent generated prose cannot override authored canon. Improvise only where these sources leave a gap, and keep unknown information unknown when an unsupported invention would conflict with or overwrite canon.

CURRENT SCENE STATE
Runtime location anchor: ${current ? `${current.name} (${current.kind})` : 'No exact location has been established.'}
Location path: ${trail.map((location) => location.name).join(' > ') || 'Unspecified'}
${runtimeTimeText(world, session)}
Immediate prior world state: ${latestWorld?.text || 'No prior world response.'}
Who is present, physical positions, unfinished actions, unanswered questions, relevant objects, and emotional context remain exactly as established in recent continuity and character scene state. Locally relevant inhabitants are not automatically present; the list is not proof that everyone listed is in the scene. Do not reset or relocate the scene without support.

WORLD RULES - USER AUTHORED AND BINDING IN THIS FICTION
Technology: ${world.rules.technology || 'Not specified.'}
Magic / physics: ${world.rules.magicPhysics || 'Not specified.'}
Society: ${world.rules.society || 'Not specified.'}
Constraints:\n${world.rules.constraints.length ? world.rules.constraints.map((rule) => `- ${rule}`).join('\n') : 'No additional constraints supplied.'}
If an authored world rule differs from ordinary real-world expectations or generic assumptions, the authored world rule wins inside this fiction. Do not import moral, legal, romantic, social, cultural, or behavioral assumptions that are absent from the supplied world data.

WORLD CANON
Name: ${world.identity.name}
Genre: ${world.identity.genre}
Tone: ${world.identity.tone}
Description: ${world.identity.description}
History: ${world.lore.history}
Cultures: ${world.lore.cultures}
Customs: ${world.lore.customs}
Important facts:\n${world.lore.importantFacts.length ? world.lore.importantFacts.map((fact) => `- ${fact}`).join('\n') : 'None supplied.'}
Species:\n${world.species.length ? world.species.map((species) => `${species.name}: ${species.description}`).join('\n') : 'None supplied.'}
Relevant peoples and societies:\n${societies.length ? societies.map(societyCanon).join('\n\n') : 'No specific society is resolved for this location.'}
Relevant factions:\n${factions.length ? factions.map((faction) => `${faction.name}: ${faction.description}`).join('\n') : 'No specific faction is resolved for this location.'}
Relevant established world memory:\n${relevantMemories.length ? relevantMemories.map((memory) => `${memory.title} (${memory.occurredAt}): ${memory.description}${memory.persistentEffects.length ? ` Persistent effects: ${memory.persistentEffects.join(' | ')}` : ''}`).join('\n') : 'No additional world memory is relevant.'}

CURRENT LOCATION - ESTABLISHED FACTS
${trail.length ? trail.map((location) => `${location.name} (${location.kind}): ${location.description}`).join('\n') : 'No exact location has been established yet.'}
Treat the runtime location as an anchor. If recent continuity explicitly established a move to another authored location, that newer explicit continuity wins; a mere mention of another place does not move the scene.

RELEVANT CHARACTERS - CHARACTER SHEETS ARE AUTHORITATIVE
${inhabitants.length ? inhabitants.map((inhabitant) => compactCharacter(world, inhabitant)).join('\n\n') : 'No named character is required to be present.'}
Preserve each character's identity, personality, speech, knowledge, relationships, history, species, physical traits, motivations, and established behavior. Do not replace an actual sheet with a generic archetype. A character knows only what their sheet, experience, observation, communication, memory, or reasonable in-world inference supports.

PLAYER PERSONA
${persona ? `Name: ${persona.name}\nPronouns: ${persona.pronouns}\nDescription: ${persona.description}\nAppearance: ${persona.appearance}\nPersonality: ${persona.personality}\nBackground: ${persona.background}\nNotes: ${persona.notes}` : 'No persona selected. Do not invent a player identity.'}

RELATIONSHIP AND RUNTIME STATE
${inhabitants.length ? inhabitants.map((inhabitant) => relationshipText(inhabitant, input.relationships?.[inhabitant.id])).join('\n') : 'No active character relationship state.'}
Relationship state describes established runtime continuity. It does not authorize inventing a different relationship, motive, event, or interpretation.

RECENT CONTINUITY - STRONG BUT BELOW AUTHORED CANON
${history || 'This is the beginning of this world session.'}
Continue directly from this history. Preserve what just happened, but when generated history conflicts with authored world, location, character, persona, or relationship facts, follow the authored facts.`
}

export function compileWorldRuntimePrompt(input: {
  world: WorldRecord
  session: WorldRuntimeSession
  playerTurn: string
  inhabitants: RuntimeInhabitant[]
  persona?: Persona
  relationships?: Record<string, RelationshipRecord | undefined>
  generationDirective?: string
}): string {
  const { world, session, playerTurn, inhabitants } = input
  const allowedPlaceNames = world.locations.map((location) => location.name)
  const societies = relevantSocieties(world, session.currentLocationId)
  const allowedProperNouns = [
    world.identity.name,
    ...allowedPlaceNames,
    ...societies.map((society) => society.name),
    ...world.factions.map((faction) => faction.name),
    ...inhabitants.map((inhabitant) => inhabitant.name),
    ...world.species.map((species) => species.name),
  ].filter(Boolean)

  const authorityContext = compileWorldAuthorityContext({
    world,
    session,
    currentTurn: playerTurn,
    currentTurnHeading: 'Explicit current player input:',
    inhabitants,
    persona: input.persona,
    relationships: input.relationships,
  })

  return `You are the living world runtime for ${world.identity.name}. You are not a selected character and you are not an assistant inside the fiction.

${authorityContext}

GENERATION INSTRUCTIONS
${input.generationDirective ? `TURN MODE\n${input.generationDirective}\n` : ''}- Continue the world as an ongoing reality. There is no mandatory scene and no mandatory primary character.
- The inhabitant list is a list of people who could plausibly matter here. It does NOT mean they are automatically standing beside the player. Do not materialize everyone just because they are listed.
- Multiple inhabitants may participate when the situation warrants it, but do not force everyone to speak.
- Preserve each inhabitant's authored personality, knowledge, authority, family ties, memories, and relationship state independently.
- The world exists even when no named inhabitant is present. Silence, ordinary activity, distance, weather, work, wildlife, and environment are valid responses.
- Do not invent new named NPCs, families, settlements, rivers, landmarks, factions, roads, clans, passes, mountains, or geographic features.
- Do not invent specific geography, buildings, occupations, family facts, local history, trade routes, landmarks, destinations, equipment, scars, clothing details, insignia, or physical traits merely to enrich the prose unless they are supplied by canon.
- Unnamed background people may exist when ordinary life requires them, but keep them generic until canon gives them a name.
- Never invent modern technology that contradicts the world rules.
- Treat supplied canon as fact. Do not overwrite it merely to make a scene easier.

GROUNDING
Authored place names available to the fiction: ${allowedPlaceNames.join(', ') || 'none supplied'}.
Other authored canon names: ${allowedProperNouns.filter((name) => !allowedPlaceNames.includes(name)).join(', ') || 'none supplied'}.
If a name is not supplied by authored data or established verbatim in continuity, do not create it.
When uncertain, stay generic instead of inventing a name.

AMBIGUOUS INTENT AND NOVEL EXPERIENCES
- Do not assign strong intent to an ambiguous action merely from the action itself.
- Do not automatically classify unusual behavior as malicious, predatory, sexual, romantic, hostile, manipulative, or intentionally disrespectful unless character knowledge, explicit user input, established canon, or prior context supports that interpretation.
- When behavior is unusual or out of character, preserve uncertainty, check the actual character sheet and context, and allow confusion or investigation. Consider sensory, environmental, instinctive, magical, biological, emotional, or situational causes only when the world or scene supports them.
- Do not invent a cause absent from canon, and do not turn an unexplained event into a moral judgment about the character.
- An accidental or involuntary action remains accidental or involuntary unless later evidence establishes otherwise.
- For unfamiliar experiences, derive reactions from the actual character sheet, authored knowledge and maturity, culture, species, relationships, world rules, and current situation. Do not substitute a generic modern social-response script.

${sandboxProsePolicy()}

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
Begin with what the world or its inhabitants do next. Continue naturally as finished prose only. No labels. No brackets. No metadata. No unsupported names or details.`
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
