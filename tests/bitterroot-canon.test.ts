import test from 'node:test'
import assert from 'node:assert/strict'
import { CanonicalPublicWorldRepository } from '../src/data/canonical-public-worlds.ts'
import { BITTERROOT_PUBLIC_WORLD_ID } from '../src/data/public-worlds.ts'
import { validateWorld } from '../src/domain/world.ts'

test('canonical Bitterroot includes the Holt family and Brackenjaw hierarchy', async () => {
  const repository = new CanonicalPublicWorldRepository()
  const world = await repository.get(BITTERROOT_PUBLIC_WORLD_ID)
  assert.ok(world)
  assert.equal(validateWorld(world!).success, true)

  const splitpine = world!.locations.find((location) => location.id === 'splitpine-reach')
  const enclave = world!.locations.find((location) => location.id === 'brackenjaw-enclave')
  const station = world!.locations.find((location) => location.id === 'brackenjaw-ranger-station')
  assert.equal(splitpine?.kind, 'subregion')
  assert.equal(splitpine?.parentLocationId, 'howling-hills')
  assert.equal(enclave?.kind, 'settlement')
  assert.equal(enclave?.parentLocationId, 'splitpine-reach')
  assert.equal(station?.kind, 'building')
  assert.equal(station?.parentLocationId, 'brackenjaw-enclave')

  const holts = world!.families.find((family) => family.id === 'holt-family')
  assert.deepEqual(holts?.people.map((person) => person.characterId), ['ragna-holt', 'pip-holt'])
  assert.equal(holts?.relationships[0]?.kind, 'parent')

  const brackenjaw = world!.societies.find((society) => society.id === 'brackenjaw-enclave-society')
  assert.equal(brackenjaw?.speciesIds.includes('werewolf-upright-feral'), true)
  assert.equal(brackenjaw?.familyIds.includes('holt-family'), true)
  assert.equal(brackenjaw?.factionIds.includes('boundary-wardens'), true)
})
