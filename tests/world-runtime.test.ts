import test from 'node:test'
import assert from 'node:assert/strict'
import { CanonicalPublicWorldRepository } from '../src/data/canonical-public-worlds.ts'
import { BITTERROOT_PUBLIC_WORLD_ID } from '../src/data/public-worlds.ts'
import { createEmptyCharacterCardV2 } from '../src/domain/character-card-v2.ts'
import type { CharacterRecord } from '../src/domain/character-record.ts'
import { chooseInitialLocation, compileWorldRuntimePrompt, resolveRuntimeInhabitants, type WorldRuntimeSession } from '../src/runtime/world-brain.ts'
import { applyRelationshipEvent, evaluateRelationshipTurn } from '../src/runtime/relationship-v2.ts'
import { cleanWorldRuntimeReply, enforceRoleplayResponseLength } from '../src/runtime/novelai.ts'
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

test('NovelAI cleanup removes leaked runtime prompt and scene-reset metadata', () => {
  const raw = 'Pip tugs the quilt higher. “Move over, you are stealing the warm side.”\n\nRagna gives the pair one last glance and turns back toward the hearth. —END—  Style: prose  POV: undefined  Scene: reset  Time: new scene, morning  Location: Brackenjaw Enclave  Tags: summer\nCURRENT SCENE STATE\nRuntime location anchor: Brackenjaw Enclave\nOUTPUT CONTRACT\nReturn only finished roleplay prose suitable for direct display to the player.'
  const cleaned = cleanWorldRuntimeReply(raw, ['Ragna Holt', 'Pip Holt'])
  assert.equal(cleaned, 'Pip tugs the quilt higher. “Move over, you are stealing the warm side.”\n\nRagna gives the pair one last glance and turns back toward the hearth.')
  assert.doesNotMatch(cleaned, /END|Style:|Scene:|CURRENT SCENE STATE|OUTPUT CONTRACT|Runtime location anchor/i)
})

test('quick roleplay output is hard-capped to two rendered paragraphs', () => {
  const raw = 'First paragraph with dialogue.\n\nSecond paragraph with the immediate reaction.\n\nThird paragraph that must never render in quick mode.'
  assert.equal(enforceRoleplayResponseLength(raw, 'quick'), 'First paragraph with dialogue.\n\nSecond paragraph with the immediate reaction.')
  assert.equal(enforceRoleplayResponseLength(raw, 'immersive'), raw)
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
  assert.match(prompt, /next PLAYER turn/i)
  assert.match(prompt, /only filling the player's turn slot/i)
  assert.match(prompt, /world response is generated separately/i)
  assert.match(prompt, /creator's world rules.*authoritative/i)
  assert.match(prompt, /RECENT CONTINUITY/)
  assert.match(prompt, /Pip looks up\. “Hi\.”/)
  assert.match(prompt, /USER DIRECTION/)
  assert.match(prompt, /Ask what she is doing/)
  assert.equal(cleanImpersonatedPlayerTurn('Player: What are you doing?\nPip Holt: Skipping stones.', ['Pip Holt']), 'What are you doing?')
})

test('runtime prompt orders authored authority ahead of recent generated continuity', async () => {
  const world = await new CanonicalPublicWorldRepository().get(BITTERROOT_PUBLIC_WORLD_ID)
  assert.ok(world)
  const location = chooseInitialLocation(world!)
  const session: WorldRuntimeSession = {
    worldId: world!.id,
    currentLocationId: location?.id,
    history: [
      { id: 'w', sender: 'world', text: 'A mistaken prior reply claims a human mayor rules the industrial city.', createdAt: '2026-09-03T00:00:00.000Z' },
    ],
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
  }
  const prompt = compileWorldRuntimePrompt({ world: world!, session, playerTurn: 'Continue.', inhabitants: [] })
  const headings = [
    'CURRENT TURN - HIGHEST AUTHORITY',
    'CURRENT SCENE STATE',
    'WORLD RULES - USER AUTHORED AND BINDING IN THIS FICTION',
    'WORLD CANON',
    'CURRENT LOCATION - ESTABLISHED FACTS',
    'RELEVANT CHARACTERS - CHARACTER SHEETS ARE AUTHORITATIVE',
    'PLAYER PERSONA',
    'RELATIONSHIP AND RUNTIME STATE',
    'RECENT CONTINUITY - STRONG BUT BELOW AUTHORED CANON',
    'GENERATION INSTRUCTIONS',
  ]
  const positions = headings.map((heading) => prompt.indexOf(heading))
  assert.ok(positions.every((position) => position >= 0))
  assert.deepEqual([...positions].sort((a, b) => a - b), positions)
  assert.match(prompt, /Recent generated prose cannot override authored canon/i)
  assert.match(prompt, /authored world rule wins inside this fiction/i)
  assert.match(prompt, /No humans exist in Bitterroot\./)
  assert.match(prompt, /mistaken prior reply claims a human mayor/)
  assert.match(prompt, /Do not automatically classify unusual behavior as malicious, predatory, sexual, romantic, hostile, manipulative/i)
  assert.match(prompt, /accidental or involuntary action remains accidental or involuntary/i)
})

test('runtime and impersonation share full character, location, world-rule, and continuity context', async () => {
  const world = await new CanonicalPublicWorldRepository().get(BITTERROOT_PUBLIC_WORLD_ID)
  assert.ok(world)
  const card = createEmptyCharacterCardV2()
  card.data.name = 'Ragna Holt'
  card.data.description = 'Silver-furred veteran warden with a scarred left paw.'
  card.data.personality = 'Terse, observant, practical.'
  card.data.scenario = 'Tracking damage near the warning stones.'
  card.data.first_mes = '“Report.”'
  card.data.mes_example = '“Facts first. Guessing later.”'
  card.data.system_prompt = 'Keep Ragna direct and evidence-led.'
  card.data.post_history_instructions = 'Preserve her established knowledge and current injury.'
  card.data.extensions = { voice: 'low and clipped', motivation: 'protect Pip and Brackenjaw' }
  card.data.character_book = {
    extensions: {},
    entries: [{ keys: ['old oath'], content: 'Ragna swore never to abandon a marked boundary.', extensions: {}, enabled: true, insertion_order: 1, constant: true, name: 'Old oath' }],
  }
  const now = '2026-09-03T00:00:00.000Z'
  const character: CharacterRecord = {
    id: 'ragna-holt', worldId: world!.id, cardV2: card, speciesId: 'werewolf-upright-feral',
    familyPersonIds: ['ragna-holt-person'], factionIds: ['boundary-wardens'], homeLocationId: 'brackenjaw-enclave',
    knownWorldMemoryIds: ['howling-hills-flood'], developedCanon: ['Her left paw was injured yesterday.'], memories: ['Pip asked about the eastern patrol.'],
    relationships: { pip: 'Ragna is Pip’s mother and primary protector.' }, sceneState: { position: 'Beside the damaged warning stone', heldObject: 'A split marker fragment' },
    observations: [], evolutionProposals: [], createdAt: now, updatedAt: now,
  }
  const inhabitants = [{ id: character.id, name: 'Ragna Holt', description: card.data.description, familyId: 'holt-family', character }]
  const session: WorldRuntimeSession = {
    worldId: world!.id, currentLocationId: 'brackenjaw-enclave',
    history: [{ id: 'w', sender: 'world', text: 'Ragna keeps the split marker fragment in her injured paw.', createdAt: now }],
    createdAt: now, updatedAt: now,
  }
  const normal = compileWorldRuntimePrompt({ world: world!, session, playerTurn: 'I ask what broke it.', inhabitants })
  const impersonated = compileWorldImpersonationPrompt({ world: world!, session, inhabitants, direction: 'Ask about the marker.' })
  for (const prompt of [normal, impersonated]) {
    assert.match(prompt, /Silver-furred veteran warden with a scarred left paw/)
    assert.match(prompt, /Werewolf: Intelligent speaking werewolves/)
    assert.match(prompt, /Ragna is Pip’s mother and primary protector/)
    assert.match(prompt, /Beside the damaged warning stone/)
    assert.match(prompt, /Her left paw was injured yesterday/)
    assert.match(prompt, /Facts first\. Guessing later/)
    assert.match(prompt, /Keep Ragna direct and evidence-led/)
    assert.match(prompt, /Preserve her established knowledge and current injury/)
    assert.match(prompt, /Ragna swore never to abandon a marked boundary/)
    assert.match(prompt, /protect Pip and Brackenjaw/)
    assert.match(prompt, /Brackenjaw Enclave \(settlement\)/)
    assert.match(prompt, /No humans exist in Bitterroot/)
    assert.match(prompt, /Ragna keeps the split marker fragment in her injured paw/)
  }
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
