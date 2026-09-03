import type { CharacterRecord } from './character-record'
import type { FamilyPerson, WorldFaction, WorldLocation, WorldMemory, WorldRecord, WorldSpecies } from './world'

export type ResolvedCharacterWorldContext = {
  worldId: string
  worldName: string
  identity: WorldRecord['identity']
  rules: WorldRecord['rules']
  lore: WorldRecord['lore']
  species?: WorldSpecies
  homeLocation?: WorldLocation
  factions: WorldFaction[]
  familyPeople: Array<FamilyPerson & { familyId: string; familyName: string }>
  relevantMemories: WorldMemory[]
}

export function resolveCharacterWorldContext(record: CharacterRecord, world: WorldRecord): ResolvedCharacterWorldContext {
  if (record.worldId !== world.id) throw new Error('Character does not belong to this world')
  const factionIds = new Set(record.factionIds)
  const personIds = new Set(record.familyPersonIds)
  const knownMemoryIds = new Set(record.knownWorldMemoryIds)
  const familyPeople = world.families.flatMap((family) => family.people
    .filter((person) => personIds.has(person.id))
    .map((person) => ({ ...person, familyId: family.id, familyName: family.name })))
  const familyIds = new Set(familyPeople.map((person) => person.familyId))

  const relevantMemories = world.memories.filter((memory) =>
    memory.visibility === 'common'
    || knownMemoryIds.has(memory.id)
    || memory.affectedCharacterIds.includes(record.id)
    || (record.homeLocationId !== undefined && memory.locationIds.includes(record.homeLocationId))
    || memory.factionIds.some((id) => factionIds.has(id))
    || memory.familyIds.some((id) => familyIds.has(id)))

  return {
    worldId: world.id,
    worldName: world.identity.name,
    identity: structuredClone(world.identity),
    rules: structuredClone(world.rules),
    lore: structuredClone(world.lore),
    species: world.species.find((item) => item.id === record.speciesId),
    homeLocation: world.locations.find((item) => item.id === record.homeLocationId),
    factions: world.factions.filter((item) => factionIds.has(item.id)),
    familyPeople,
    relevantMemories,
  }
}
