import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWorldImagePrompt, createFreeNovelAiRequest, estimateNovelAiCost } from '../src/image/image-generation.ts'
import { buildNovelAiPayload } from '../src/image/novelai.ts'
import { createEmptyWorld } from '../src/domain/world.ts'

test('free NovelAI preset uses normal landscape dimensions and 28 steps', () => {
  const request = createFreeNovelAiRequest('world', 'world-1', 'misty mountain valley')
  assert.equal(request.samples, 1)
  assert.equal(request.steps, 28)
  assert.deepEqual(request.dimensions, { width: 1216, height: 832 })
  assert.equal(estimateNovelAiCost(request).freeEligible, true)
})

test('NovelAI V5 payload uses params_version 3 and V4 prompt structures', () => {
  const request = createFreeNovelAiRequest('world', 'world-1', 'misty mountain valley', 'blurry')
  const payload = buildNovelAiPayload(request) as { model: string; parameters: Record<string, unknown> }
  assert.equal(payload.model, 'nai-diffusion-5-full')
  assert.equal(payload.parameters.params_version, 3)
  assert.equal(payload.parameters.n_samples, 1)
  assert.ok(payload.parameters.v4_prompt)
  assert.ok(payload.parameters.v4_negative_prompt)
})

test('cost estimator flags settings outside the free preset', () => {
  const request = createFreeNovelAiRequest('world', 'world-1', 'misty mountain valley')
  request.steps = 40
  request.dimensions = { width: 1536, height: 1024 }
  const estimate = estimateNovelAiCost(request)
  assert.equal(estimate.freeEligible, false)
  assert.equal(estimate.label, 'May consume Anlas')
  assert.ok(estimate.reasons.length >= 2)
})

test('world prompt incorporates authored world context', () => {
  const world = createEmptyWorld('bitterroot')
  world.identity.name = 'Bitterroot'
  world.identity.genre = 'dark fantasy'
  world.identity.tone = 'melancholic'
  world.rules.technology = 'pre-industrial'
  world.species.push({ id: 'fox', name: 'Fox', description: '' })
  world.locations.push({ id: 'woods', name: 'Whispering Woods', kind: 'region', description: '' })
  const prompt = buildWorldImagePrompt(world)
  assert.match(prompt, /Bitterroot/)
  assert.match(prompt, /dark fantasy/)
  assert.match(prompt, /pre-industrial/)
  assert.match(prompt, /Whispering Woods/)
})
