import test from 'node:test'
import assert from 'node:assert/strict'
import { importHowlingWhispersPersona } from '../src/domain/persona-import.ts'

test('imports Howling Whispers persona v1 and preserves guidance in notes', () => {
  const imported = importHowlingWhispersPersona(JSON.stringify({
    format: 'howling-whispers-persona',
    version: 1,
    persona: {
      id: 'persona-test',
      name: 'Skyler',
      pronouns: 'he/him',
      description: 'Teen wolf boy.',
      appearance: 'Dark fur.',
      background: 'Home life.',
      personalityTraits: ['observant', 'stubborn'],
      boundaries: ['Keep interactions age-appropriate.'],
      roleplayGuidance: ['Do not make him automatically trust the player.'],
      createdAt: 1787538518163,
      updatedAt: 1787904455775,
    },
  }), '2026-09-03T00:00:00.000Z')

  assert.equal(imported.id, 'persona-test')
  assert.equal(imported.name, 'Skyler')
  assert.equal(imported.personality, 'observant, stubborn')
  assert.match(imported.notes, /Keep interactions age-appropriate/)
  assert.match(imported.notes, /automatically trust the player/)
})
