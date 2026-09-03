import test from 'node:test'
import assert from 'node:assert/strict'
import { CanonicalPublicWorldRepository } from '../src/data/canonical-public-worlds.ts'
import { BITTERROOT_PUBLIC_WORLD_ID } from '../src/data/public-worlds.ts'
import { chooseInitialLocation, compileWorldRuntimePrompt, resolveRuntimeInhabitants, type WorldRuntimeSession } from '../src/runtime/world-brain.ts'
import { applyRelationshipEvent, evaluateRelationshipTurn } from '../src/runtime/relationship-v2.ts'
import { cleanWorldRuntimeReply } from '../src/runtime/novelai.ts'
import { cleanImpersonatedPlayerTurn, compileWorldImpersonationPrompt } from '../src/runtime/world-turn-tools.ts'

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
    history: [
      { id: 'p', sender: 'player', text: 'hello', createdAt: '2026-09-03T00:00:00.000Z' },
      { id: 'w', sender: 'world', text: 'Ragna looks over. “Afternoon.”', createdAt: '2026-09-03T00:00:01.000Z' },
    ],
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:01.000Z',
  }
  const prompt = compileWorldRuntimePrompt({ world: world!, session, playerTurn: 'I walk toward the ranger station.', inhabitants })
  assert.match(prompt, /living world runtime for Bitterroot/i)
  assert.match(prompt, /Brackenjaw Enclave/)
  assert.match(prompt, /Ragna Holt/)
  assert.match(prompt, /Pip Holt/)
  assert.match(prompt, /no mandatory primary character/i)
  assert.match(prompt, /do not invent new named NPCs/i)
  assert.match(prompt, /not automatically present/i)
  assert.match(prompt, /Never output speaker labels/i)
  assert.match(prompt, /Recent player input\nhello/)
  assert.match(prompt, /Resulting world prose\nRagna looks over/)
  assert.doesNotMatch(prompt, /Player: hello/)
  assert.doesNotMatch(prompt, /World: Ragna looks over/)
  assert.doesNotMatch(prompt, /selected character:/i)
})

test('NovelAI cleanup removes leaked reasoning before roleplay prose', () => {
  const raw = 'Show only observable facts and no metadata.</think>\nRagna steps into view. "Afternoon."'
  assert.equal(cleanWorldRuntimeReply(raw), 'Ragna steps into view. "Afternoon."')
  assert.equal(cleanWorldRuntimeReply('<think>private reasoning</think>\nThe wind moves through the pines.'), 'The wind moves through the pines.')
})

test('NovelAI cleanup unwraps transcript formatting and stops player continuation', () => {
  const raw = 'Ragna Holt: [Her ears twitch.] Afternoon.  Pip Holt: [Pip waves.] Hi!  Narrator: The wind moves through the pines.  Player: I walk away.'
  const cleaned = cleanWorldRuntimeReply(raw, ['Ragna Holt', 'Pip Holt'])
  assert.doesNotMatch(cleaned, /Ragna Holt:/)
  assert.doesNotMatch(cleaned, /Pip Holt:/)
  assert.doesNotMatch(cleaned, /Narrator:/)
  assert.doesNotMatch(cleaned, /Player:/)
  assert.doesNotMatch(cleaned, /\[/)
  assert.match(cleaned, /Her ears twitch\./)
  assert.match(cleaned, /Pip waves\./)
  assert.match(cleaned, /The wind moves through the pines\./)
  assert.doesNotMatch(cleaned, /I walk away/)
})

test('world impersonation writes only the player side and strips wrappers', async () => {
  const world = await new CanonicalPublicWorldRepository().get(BITTERROOT_PUBLIC_WORLD_ID)
  assert.ok(world)
  const location = chooseInitialLocation(world!)
  const inhabitants = resolveRuntimeInhabitants(world!, [], location?.id)
  const session: WorldRuntimeSession = {
    worldId: world!.id,
    currentLocationId: location?.id,
    history: [
      { id: 'p', sender: 'player', text: 'Hello Pip.', createdAt: '2026-09-03T00:00:00.000Z' },
      { id: 'w', sender: 'world', text: 'Pip looks up. “Hi.”', createdAt: '2026-09-03T00:00:01.000Z' },
    ],
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:01.000Z',
  }
  const prompt = compileWorldImpersonationPrompt({ world: world!, session, inhabitants, direction: 'Ask what she is doing.' })
  assert.match(prompt, /one plausible next PLAYER turn/i)
  assert.match(prompt, /Do not write any NPC response/i)
  assert.match(prompt, /Ask what she is doing/)
  assert.equal(cleanImpersonatedPlayerTurn('Player: What are you doing?\nPip Holt: Skipping stones.', ['Pip Holt']), 'What are you doing?')
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
