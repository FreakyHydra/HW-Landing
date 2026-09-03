import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryRepository } from '../src/data/repositories.ts'
import { createEmptyWorld, normalizeWorldRecord, validateWorld, wouldCreateHierarchyCycle, worldContextSummary, type WorldRecord } from '../src/domain/world.ts'
import { createEmptyCharacterCardV2 } from '../src/domain/character-card-v2.ts'
import { resolveCharacterWorldContext } from '../src/domain/world-context.ts'
import type { CharacterRecord } from '../src/domain/character-record.ts'

function bitterroot(): WorldRecord {
  const world = createEmptyWorld('bitterroot', '2026-09-03T00:00:00.000Z')
  world.identity = { name: 'Bitterroot', description: 'A small living valley.', genre: 'Dark fantasy', tone: 'Intimate' }
  world.rules.technology = 'Pre-industrial'
  world.species.push({ id: 'fox', name: 'Fox', description: 'A speaking fox people.' })
  world.locations.push({ id: 'woods', name: 'Whispering Woods', kind: 'region', description: 'Northern forest.' })
  world.factions.push({ id: 'watch', name: 'River Watch', description: 'Guards the crossings.' })
  world.families.push({
    id: 'whiteclaw', name: 'Whiteclaw', description: 'A ranger family.',
    people: [{ id: 'heather', name: 'Heather Whiteclaw', description: 'Mother' }, { id: 'valerie', name: 'Valerie Whiteclaw', description: 'Daughter' }],
    relationships: [{ id: 'parent-link', fromPersonId: 'heather', toPersonId: 'valerie', kind: 'parent', notes: '' }],
  })
  return world
}

test('creates and validates a world root', () => {
  assert.equal(validateWorld(bitterroot()).success, true)
})

test('rejects a family relationship that references a missing person', () => {
  const world = bitterroot()
  world.families[0].relationships[0].toPersonId = 'missing'
  const result = validateWorld(world)
  assert.equal(result.success, false)
  if (!result.success) assert.ok(result.errors.some((error) => error.includes('missing person')))
})

test('builds concise inherited world context', () => {
  const summary = worldContextSummary(bitterroot())
  assert.ok(summary.includes('Technology: Pre-industrial'))
  assert.ok(summary.includes('Species: Fox'))
  assert.ok(summary.includes('Families: Whiteclaw'))
})

test('world repository preserves structured family trees and memory', async () => {
  const repository = new MemoryRepository<WorldRecord>()
  const world = bitterroot()
  world.memories.push({ id: 'flood', title: 'Great Flood', description: 'The valley drowned.', kind: 'event', occurredAt: 'Year 0', visibility: 'common', locationIds: ['woods'], factionIds: [], familyIds: ['whiteclaw'], affectedCharacterIds: [], persistentEffects: ['Old roads remain underwater'], createdAt: '2026-09-03T00:00:00.000Z' })
  await repository.save(world)
  const stored = await repository.get('bitterroot')
  assert.equal(stored?.families[0].relationships[0].kind, 'parent')
  assert.deepEqual(stored?.memories[0].persistentEffects, ['Old roads remain underwater'])
})

test('resolves only relevant world memory for a character', () => {
  const world = bitterroot()
  world.memories.push(
    { id: 'flood', title: 'Great Flood', description: 'The valley drowned.', kind: 'event', occurredAt: 'Year 0', visibility: 'common', locationIds: [], factionIds: [], familyIds: [], affectedCharacterIds: [], persistentEffects: [], createdAt: '2026-09-03T00:00:00.000Z' },
    { id: 'watch-secret', title: 'Watch Secret', description: 'A guarded discovery.', kind: 'discovery', occurredAt: 'Year 2', visibility: 'faction', locationIds: [], factionIds: ['watch'], familyIds: [], affectedCharacterIds: [], persistentEffects: [], createdAt: '2026-09-03T00:00:00.000Z' },
    { id: 'other-secret', title: 'Other Secret', description: 'Unknown to Mira.', kind: 'discovery', occurredAt: 'Year 3', visibility: 'private', locationIds: [], factionIds: [], familyIds: [], affectedCharacterIds: [], persistentEffects: [], createdAt: '2026-09-03T00:00:00.000Z' },
  )
  const record: CharacterRecord = { id: 'mira', worldId: 'bitterroot', cardV2: createEmptyCharacterCardV2(), factionIds: ['watch'], familyPersonIds: ['heather'], knownWorldMemoryIds: [], developedCanon: [], memories: [], relationships: {}, sceneState: {}, observations: [], evolutionProposals: [], createdAt: '', updatedAt: '' }
  const context = resolveCharacterWorldContext(record, world)
  assert.deepEqual(context.relevantMemories.map((memory) => memory.id), ['flood', 'watch-secret'])
  assert.equal(context.familyPeople[0].familyName, 'Whiteclaw')
})

test('rejects resolving a character against the wrong world', () => {
  const record: CharacterRecord = { id: 'mira', worldId: 'elsewhere', cardV2: createEmptyCharacterCardV2(), factionIds: [], familyPersonIds: [], knownWorldMemoryIds: [], developedCanon: [], memories: [], relationships: {}, sceneState: {}, observations: [], evolutionProposals: [], createdAt: '', updatedAt: '' }
  assert.throws(() => resolveCharacterWorldContext(record, bitterroot()), /does not belong/)
})

test('supports nested pre-industrial societies and their world links', () => {
  const world = bitterroot()
  world.societies.push(
    { id: 'valley-confederacy', name: 'Valley Confederacy', type: 'confederacy', description: '', origin: '', territoryLocationIds: ['woods'], territoryNotes: 'Shared range', seasonalMovement: '', lifestyle: 'mixed', speciesIds: ['fox'], kinshipBasis: 'Oath and affinity', membershipRules: '', leadershipStructure: 'No permanent leader', decisionMaking: 'Seasonal council', customs: '', beliefs: 'Several traditions', languageDialect: 'Spoken valley dialects', livelihood: 'Mixed', allySocietyIds: [], rivalSocietyIds: [], familyIds: ['whiteclaw'], factionIds: ['watch'], settlementLocationIds: [], currentStatus: 'Active', canonStatus: 'canon' },
    { id: 'ashfall-clan', name: 'Ashfall', type: 'clan', parentSocietyId: 'valley-confederacy', description: '', origin: '', territoryLocationIds: [], territoryNotes: '', seasonalMovement: 'Winter route', lifestyle: 'nomadic', speciesIds: ['fox'], kinshipBasis: 'Descent, adoption, and oath-bonds', membershipRules: '', leadershipStructure: 'Three speakers', decisionMaking: 'Consensus', customs: '', beliefs: '', languageDialect: '', livelihood: '', allySocietyIds: [], rivalSocietyIds: [], familyIds: [], factionIds: [], settlementLocationIds: [], currentStatus: 'Migrating', canonStatus: 'canon' },
  )
  assert.equal(validateWorld(world).success, true)
  assert.ok(worldContextSummary(world).some((line) => line.includes('Valley Confederacy')))
})

test('rejects circular location and society parents', () => {
  const world = bitterroot()
  world.locations.push({ id: 'cave', name: 'Cave', kind: 'landmark', parentLocationId: 'woods', description: '' })
  assert.equal(wouldCreateHierarchyCycle(world.locations, 'woods', 'cave'), true)
  world.locations[0].parentLocationId = 'cave'
  assert.equal(validateWorld(world).success, false)

  world.locations[0].parentLocationId = undefined
  world.societies.push(
    { id: 'tribe', name: 'River Tribe', type: 'tribe', parentSocietyId: 'clan', description: '', origin: '', territoryLocationIds: [], territoryNotes: '', seasonalMovement: '', lifestyle: 'mixed', speciesIds: [], kinshipBasis: '', membershipRules: '', leadershipStructure: '', decisionMaking: '', customs: '', beliefs: '', languageDialect: '', livelihood: '', allySocietyIds: [], rivalSocietyIds: [], familyIds: [], factionIds: [], settlementLocationIds: [], currentStatus: '', canonStatus: 'draft' },
    { id: 'clan', name: 'Reed Clan', type: 'clan', parentSocietyId: 'tribe', description: '', origin: '', territoryLocationIds: [], territoryNotes: '', seasonalMovement: '', lifestyle: 'settled', speciesIds: [], kinshipBasis: '', membershipRules: '', leadershipStructure: '', decisionMaking: '', customs: '', beliefs: '', languageDialect: '', livelihood: '', allySocietyIds: [], rivalSocietyIds: [], familyIds: [], factionIds: [], settlementLocationIds: [], currentStatus: '', canonStatus: 'draft' },
  )
  assert.equal(validateWorld(world).success, false)
})

test('normalizes older saved worlds without replacing existing data', () => {
  const legacyShape = bitterroot() as WorldRecord & { societies?: WorldRecord['societies'] }
  delete legacyShape.societies
  const normalized = normalizeWorldRecord(legacyShape as WorldRecord)
  assert.deepEqual(normalized.societies, [])
  assert.equal(normalized.locations[0].id, 'woods')
  assert.equal(normalized.families[0].id, 'whiteclaw')
})
