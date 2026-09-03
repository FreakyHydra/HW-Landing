import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createEmptyCharacterCardV2,
  exportCharacterCardV2,
  importCharacterCardV2,
  validateCharacterCardV2,
} from '../src/domain/character-card-v2.ts'

test('validates a canonical Character Card V2', () => {
  const card = createEmptyCharacterCardV2()
  card.data.name = 'Mira'
  assert.equal(validateCharacterCardV2(card).success, true)
})

test('imports and exports without changing card data', () => {
  const card = createEmptyCharacterCardV2()
  card.data.name = 'Mira'
  card.data.first_mes = 'The workshop door opens.'
  card.data.tags = ['original', 'smith']
  assert.deepEqual(importCharacterCardV2(exportCharacterCardV2(card)), card)
})

test('rejects malformed cards with useful field paths', () => {
  const result = validateCharacterCardV2({ spec: 'hwv2', spec_version: 2, data: {} })
  assert.equal(result.success, false)
  if (!result.success) {
    assert.ok(result.errors.includes('spec must be "chara_card_v2"'))
    assert.ok(result.errors.includes('data.name must be a string'))
  }
})

test('preserves optional lorebook fields and unknown extensions', () => {
  const card = createEmptyCharacterCardV2()
  card.data.extensions = { 'other-app': { voice: 'low' } }
  card.data.character_book = {
    name: 'Workshop lore',
    scan_depth: 4,
    extensions: { 'other-app': true },
    entries: [{
      keys: ['forge'], secondary_keys: ['metal'], selective: true,
      content: 'The forge stands below the northern ridge.', extensions: { custom: 7 },
      enabled: true, insertion_order: 10, position: 'before_char',
    }],
  }
  const result = importCharacterCardV2(exportCharacterCardV2(card))
  assert.deepEqual(result.data.character_book, card.data.character_book)
  assert.deepEqual(result.data.extensions, card.data.extensions)
})

test('rejects invalid JSON at the import boundary', () => {
  assert.throws(() => importCharacterCardV2('{broken'), /not valid JSON/)
})

test('rejects malformed optional lorebook fields', () => {
  const card = createEmptyCharacterCardV2()
  const malformed = structuredClone(card) as unknown as { data: Record<string, unknown> }
  malformed.data.character_book = { extensions: {}, entries: [{ keys: ['forge'], content: 'Lore', enabled: 'yes', insertion_order: 1, extensions: {} }] }
  const result = validateCharacterCardV2(malformed)
  assert.equal(result.success, false)
  if (!result.success) assert.ok(result.errors.some((error) => error.includes('.enabled must be a boolean')))
})
