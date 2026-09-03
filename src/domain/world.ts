export type WorldIdentity = {
  name: string
  description: string
  genre: string
  tone: string
}

export type WorldRules = {
  technology: string
  magicPhysics: string
  society: string
  constraints: string[]
}

export type WorldLore = {
  history: string
  cultures: string
  customs: string
  importantFacts: string[]
}

export type WorldSpecies = { id: string; name: string; description: string }
export type WorldLocation = {
  id: string
  name: string
  kind: 'region' | 'town' | 'building' | 'landmark' | 'other'
  parentLocationId?: string
  description: string
}
export type WorldFaction = { id: string; name: string; description: string }

export const societyTypes = ['clan', 'tribe', 'band', 'nation', 'confederacy', 'chiefdom', 'village_community', 'nomadic_people', 'pack', 'pride', 'herd', 'flock', 'colony', 'house', 'lineage', 'other'] as const
export type WorldSocietyType = typeof societyTypes[number]
export type WorldSocietyLifestyle = 'nomadic' | 'settled' | 'mixed'
export type WorldSocietyCanonStatus = 'canon' | 'draft' | 'disputed' | 'historical'
export type WorldSociety = {
  id: string
  name: string
  type: WorldSocietyType
  parentSocietyId?: string
  description: string
  origin: string
  territoryLocationIds: string[]
  territoryNotes: string
  seasonalMovement: string
  lifestyle: WorldSocietyLifestyle
  speciesIds: string[]
  kinshipBasis: string
  membershipRules: string
  leadershipStructure: string
  decisionMaking: string
  customs: string
  beliefs: string
  languageDialect: string
  livelihood: string
  allySocietyIds: string[]
  rivalSocietyIds: string[]
  familyIds: string[]
  factionIds: string[]
  settlementLocationIds: string[]
  currentStatus: string
  canonStatus: WorldSocietyCanonStatus
}

export type FamilyPerson = {
  id: string
  name: string
  characterId?: string
  description: string
}

export type FamilyRelationshipKind = 'parent' | 'partner' | 'sibling' | 'guardian'
export type FamilyRelationship = {
  id: string
  fromPersonId: string
  toPersonId: string
  kind: FamilyRelationshipKind
  notes: string
}

export type WorldFamily = {
  id: string
  name: string
  description: string
  people: FamilyPerson[]
  relationships: FamilyRelationship[]
}

export type WorldMemoryKind = 'event' | 'discovery' | 'death' | 'conflict' | 'persistent_change'
export type WorldMemoryVisibility = 'common' | 'regional' | 'faction' | 'family' | 'private' | 'disputed'
export type WorldMemory = {
  id: string
  title: string
  description: string
  kind: WorldMemoryKind
  occurredAt: string
  visibility: WorldMemoryVisibility
  locationIds: string[]
  factionIds: string[]
  familyIds: string[]
  affectedCharacterIds: string[]
  persistentEffects: string[]
  createdAt: string
}

export type WorldRecord = {
  id: string
  identity: WorldIdentity
  rules: WorldRules
  lore: WorldLore
  species: WorldSpecies[]
  locations: WorldLocation[]
  factions: WorldFaction[]
  societies: WorldSociety[]
  families: WorldFamily[]
  memories: WorldMemory[]
  createdAt: string
  updatedAt: string
}

export type WorldValidation = { success: true } | { success: false; errors: string[] }

export function createEmptyWorld(id: string, now = new Date().toISOString()): WorldRecord {
  return {
    id,
    identity: { name: '', description: '', genre: '', tone: '' },
    rules: { technology: '', magicPhysics: '', society: '', constraints: [] },
    lore: { history: '', cultures: '', customs: '', importantFacts: [] },
    species: [], locations: [], factions: [], societies: [], families: [], memories: [],
    createdAt: now, updatedAt: now,
  }
}

export function validateWorld(world: WorldRecord): WorldValidation {
  const errors: string[] = []
  if (!world.id.trim()) errors.push('World id is required')
  if (!world.identity.name.trim()) errors.push('World name is required')
  const unique = (values: { id: string }[], label: string) => {
    const ids = values.map((item) => item.id)
    if (new Set(ids).size !== ids.length) errors.push(`${label} ids must be unique`)
  }
  unique(world.species, 'Species')
  unique(world.locations, 'Location')
  unique(world.factions, 'Faction')
  unique(world.societies, 'Society')
  unique(world.families, 'Family')
  unique(world.memories, 'Memory')
  unique(world.families.flatMap((family) => family.people), 'Family person')
  const locationIds = new Set(world.locations.map((location) => location.id))
  const factionIds = new Set(world.factions.map((faction) => faction.id))
  const familyIds = new Set(world.families.map((family) => family.id))
  const speciesIds = new Set(world.species.map((species) => species.id))
  const societyIds = new Set(world.societies.map((society) => society.id))
  world.locations.forEach((location) => {
    if (location.parentLocationId && !locationIds.has(location.parentLocationId)) errors.push(`Location ${location.name || location.id} has a missing parent location`)
    if (location.parentLocationId === location.id) errors.push('A location cannot contain itself')
  })
  world.locations.forEach((location) => {
    if (wouldCreateHierarchyCycle(world.locations, location.id, location.parentLocationId)) errors.push(`Location ${location.name || location.id} has a circular parent relationship`)
  })
  world.societies.forEach((society) => {
    if (!society.name.trim()) errors.push(`Society ${society.id} requires a name`)
    if (society.parentSocietyId && !societyIds.has(society.parentSocietyId)) errors.push(`Society ${society.name || society.id} has a missing parent society`)
    if (wouldCreateHierarchyCycle(world.societies, society.id, society.parentSocietyId)) errors.push(`Society ${society.name || society.id} has a circular parent relationship`)
    if (society.speciesIds.some((id) => !speciesIds.has(id))) errors.push(`Society ${society.name || society.id} references a missing species`)
    if ([...society.territoryLocationIds, ...society.settlementLocationIds].some((id) => !locationIds.has(id))) errors.push(`Society ${society.name || society.id} references a missing location`)
    if (society.familyIds.some((id) => !familyIds.has(id))) errors.push(`Society ${society.name || society.id} references a missing family`)
    if (society.factionIds.some((id) => !factionIds.has(id))) errors.push(`Society ${society.name || society.id} references a missing faction`)
    if ([...society.allySocietyIds, ...society.rivalSocietyIds].some((id) => !societyIds.has(id) || id === society.id)) errors.push(`Society ${society.name || society.id} has an invalid society relationship`)
  })
  for (const family of world.families) {
    unique(family.people, `Family ${family.name || family.id} person`)
    const people = new Set(family.people.map((person) => person.id))
    family.relationships.forEach((relationship) => {
      if (!people.has(relationship.fromPersonId) || !people.has(relationship.toPersonId)) errors.push(`Family ${family.name || family.id} contains a relationship with a missing person`)
      if (relationship.fromPersonId === relationship.toPersonId) errors.push('A family relationship cannot point to the same person')
    })
  }
  world.memories.forEach((memory) => {
    if (memory.locationIds.some((id) => !locationIds.has(id))) errors.push(`Memory ${memory.title || memory.id} references a missing location`)
    if (memory.factionIds.some((id) => !factionIds.has(id))) errors.push(`Memory ${memory.title || memory.id} references a missing faction`)
    if (memory.familyIds.some((id) => !familyIds.has(id))) errors.push(`Memory ${memory.title || memory.id} references a missing family`)
  })
  return errors.length ? { success: false, errors } : { success: true }
}

export function worldContextSummary(world: WorldRecord): string[] {
  return [
    world.identity.genre && `Genre: ${world.identity.genre}`,
    world.identity.tone && `Tone: ${world.identity.tone}`,
    world.rules.technology && `Technology: ${world.rules.technology}`,
    world.rules.magicPhysics && `Magic / physics: ${world.rules.magicPhysics}`,
    world.species.length && `Species: ${world.species.map((item) => item.name).join(', ')}`,
    world.locations.length && `Locations: ${world.locations.map((item) => item.name).join(', ')}`,
    world.factions.length && `Factions: ${world.factions.map((item) => item.name).join(', ')}`,
    world.societies.length && `Peoples & societies: ${world.societies.map((item) => item.name).join(', ')}`,
    world.families.length && `Families: ${world.families.map((item) => item.name).join(', ')}`,
  ].filter((item): item is string => Boolean(item))
}

export function wouldCreateHierarchyCycle<T extends { id: string; parentLocationId?: string; parentSocietyId?: string }>(items: T[], entityId: string, nextParentId?: string): boolean {
  if (!nextParentId) return false
  if (nextParentId === entityId) return true
  const parents = new Map(items.map((item) => [item.id, item.parentLocationId ?? item.parentSocietyId]))
  let cursor: string | undefined = nextParentId
  const visited = new Set<string>()
  while (cursor) {
    if (cursor === entityId || visited.has(cursor)) return true
    visited.add(cursor)
    cursor = parents.get(cursor)
  }
  return false
}

export function normalizeWorldRecord(world: WorldRecord): WorldRecord {
  return { ...structuredClone(world), societies: structuredClone(world.societies ?? []) }
}
