import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryRepository } from '../src/data/repositories.ts'
import { createEmptyWorld, validateWorld, worldContextSummary, type WorldRecord } from '../src/domain/world.ts'
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
