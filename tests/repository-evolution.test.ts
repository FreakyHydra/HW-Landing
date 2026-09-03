import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyCharacterCardV2 } from '../src/domain/character-card-v2.ts'
import { transitionProposal, type CharacterRecord } from '../src/domain/character-record.ts'
import { MemoryRepository } from '../src/data/repositories.ts'

function record(): CharacterRecord {
  return {
    id: 'mira', cardV2: createEmptyCharacterCardV2(), developedCanon: [], memories: [], relationships: {}, sceneState: {}, observations: [],
    evolutionProposals: [{ id: 'p1', source: 'scene-4', timestamp: '2026-09-01T00:00:00.000Z', confidence: .82, evidenceCount: 3, targetField: 'personality', proposedValue: 'Taps her claws against metal when anxious.', status: 'pending' }],
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  }
}

test('memory repository saves clones and retrieves by id', async () => {
  const repository = new MemoryRepository<CharacterRecord>()
  const source = record()
  await repository.save(source)
  source.cardV2.data.name = 'Changed outside repository'
  assert.equal((await repository.get('mira'))?.cardV2.data.name, '')
  assert.equal((await repository.list()).length, 1)
  await repository.remove('mira')
  assert.equal(await repository.get('mira'), undefined)
})

test('accepting a proposal explicitly appends it to the targeted V2 field', () => {
  const next = transitionProposal(record(), 'p1', 'accepted', '2026-09-02T00:00:00.000Z')
  assert.equal(next.evolutionProposals[0].status, 'accepted')
  assert.equal(next.cardV2.data.personality, 'Taps her claws against metal when anxious.')
})

test('keeping a proposal as memory does not mutate the V2 card', () => {
  const next = transitionProposal(record(), 'p1', 'memory')
  assert.deepEqual(next.memories, ['Taps her claws against metal when anxious.'])
  assert.equal(next.cardV2.data.personality, '')
})

test('rejecting a proposal does not mutate canon or memory', () => {
  const next = transitionProposal(record(), 'p1', 'rejected')
  assert.equal(next.evolutionProposals[0].status, 'rejected')
  assert.equal(next.cardV2.data.personality, '')
  assert.deepEqual(next.memories, [])
})

test('resolved proposals cannot be transitioned twice', () => {
  const accepted = transitionProposal(record(), 'p1', 'accepted')
  assert.throws(() => transitionProposal(accepted, 'p1', 'rejected'), /Only pending/)
})
