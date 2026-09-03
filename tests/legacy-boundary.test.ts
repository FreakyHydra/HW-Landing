import test from 'node:test'
import assert from 'node:assert/strict'
import { legacyHwV2ToCharacterV2 } from '../src/legacy/legacy-hwv2.ts'

test('legacy conversion maps portable fields and quarantines legacy state', () => {
  const result = legacyHwV2ToCharacterV2({
    name: 'Mira', description: 'A metalworker.', firstMessage: 'Come in.',
    relationshipState: { trust: 92 }, sceneState: { location: 'forge' }, privateRuntimeFlag: true,
  })
  assert.equal(result.card.spec, 'chara_card_v2')
  assert.equal(result.card.data.name, 'Mira')
  assert.equal(result.card.data.first_mes, 'Come in.')
  assert.equal('relationshipState' in result.card.data, false)
  assert.deepEqual(result.unclassified.relationshipState, { trust: 92 })
  assert.equal(result.warnings.length, 1)
})
