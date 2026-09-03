import test from 'node:test'
import assert from 'node:assert/strict'
import { CanonicalPublicWorldRepository } from '../src/data/canonical-public-worlds.ts'
import { BITTERROOT_PUBLIC_WORLD_ID } from '../src/data/public-worlds.ts'
import { chooseInitialLocation, compileWorldRuntimePrompt, resolveRuntimeInhabitants, type WorldRuntimeSession } from '../src/runtime/world-brain.ts'
import { applyRelationshipEvent, evaluateRelationshipTurn } from '../src/runtime/relationship-v2.ts'
import { cleanWorldRuntimeReply } from '../src/runtime/novelai.ts'

test('Bitterroot enters a real location and resolves Holt inhabitants without selecting a character', async () => {
  const world = await new CanonicalPublicWorldRepository().get(BITTERROOT_PUBLIC_WORLD_ID)
  assert.ok(world)
  const location = chooseInitialLocation(world!)
  assert.equal(location?.id, 'brackenjaw-enclave')
  const inhabitants = resolveRuntimeInhabitants(world!, [], location?.id)
  assert.deepEqual(inhabitants.map((item) => item.name), ['Ragna Holt', 'Pip Holt'])

  const session: WorldRuntimeSession = {
    worldId: world!.id,
    currentLocationId: location?.id,
    history: [],
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
  }
  const prompt = compileWorldRuntimePrompt({ world: world!, session, playerTurn: 'I walk toward the ranger station.', inhabitants })
  assert.match(prompt, /living world runtime for Bitterroot/i)
  assert.match(prompt, /Brackenjaw Enclave/)
  assert.match(prompt, /Ragna Holt/)
  assert.match(prompt, /Pip Holt/)
  assert.match(prompt, /no mandatory primary character/i)
  assert.match(prompt, /do not invent new named NPCs/i)
  assert.match(prompt, /not automatically present/i)
  assert.match(prompt, /Do not format the response as a cast list/i)
  assert.doesNotMatch(prompt, /selected character:/i)
})

test('NovelAI cleanup removes leaked reasoning before roleplay prose', () => {
  const raw = 'Show only observable facts and no metadata.</think>\nRagna steps into view. "Afternoon."'
  assert.equal(cleanWorldRuntimeReply(raw), 'Ragna steps into view. "Afternoon."')
  assert.equal(cleanWorldRuntimeReply('<think>private reasoning</think>\nThe wind moves through the pines.'), 'The wind moves through the pines.')
})

test('Relationship V2 does not punish fear or a personal boundary', () => {
  const fear = evaluateRelationshipTurn({ characterId: 'ragna-holt', previousScore: 0, playerMessage: 'I am scared. Please do not hurt me.', characterReply: 'Ragna stops where she is.', turnId: 'fear' })
  assert.ok(fear.delta >= 0)
  const boundary = evaluateRelationshipTurn({ characterId: 'ragna-holt', previousScore: 0, playerMessage: 'Stop. I am not comfortable with that.', characterReply: 'Ragna steps back.', turnId: 'boundary' })
  assert.ok(boundary.delta >= 0)
})

test('Relationship V2 records coercion negatively and kindness positively', () => {
  const coercion = evaluateRelationshipTurn({ characterId: 'ragna-holt', previousScore: 0, playerMessage: 'You have no choice. Your boundaries do not matter.', characterReply: 'Stay away from me.', turnId: 'coercion' })
  assert.ok(coercion.delta < 0)
  assert.ok((coercion.dimensionDeltas.resentment ?? 0) > 0)
  const damaged = applyRelationshipEvent(undefined, coercion)
  assert.ok(damaged.score < 0)

  const kindness = evaluateRelationshipTurn({ characterId: 'ragna-holt', previousScore: 0, playerMessage: 'Thank you. I appreciate you.', characterReply: 'Ragna nods. “Thanks.”', turnId: 'kindness' })
  assert.ok(kindness.delta > 0)
  assert.ok((kindness.dimensionDeltas.comfort ?? 0) > 0)
})
