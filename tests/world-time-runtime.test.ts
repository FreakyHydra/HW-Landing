import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyWorld } from '../src/domain/world.ts'
import { advanceWorldRuntimeClock, advanceWorldRuntimeForInput, createWorldRuntimeClock, formatWorldRuntimeTime, seasonAtDay } from '../src/runtime/world-time-runtime.ts'

test('world clock starts from authored day and hour', () => {
  const world = createEmptyWorld('clock')
  world.timeWeather!.startingDay = 3
  world.timeWeather!.startingHour = 7.5
  const clock = createWorldRuntimeClock(world, '2026-09-04T00:00:00.000Z')
  assert.equal(clock.day, 3)
  assert.equal(clock.minuteOfDay, 450)
  assert.match(formatWorldRuntimeTime(clock, world), /Day 3, 07:30/)
})

test('tick mode advances by authored minutes per input and rolls days', () => {
  const world = createEmptyWorld('clock')
  world.timeWeather!.minutesPerInput = 15
  world.timeWeather!.startingHour = 23.9
  let clock = createWorldRuntimeClock(world, '2026-09-04T00:00:00.000Z')
  clock = advanceWorldRuntimeForInput(clock, world, '2026-09-04T00:01:00.000Z')
  assert.equal(clock.day, 2)
  assert.ok(clock.minuteOfDay < 15)
})

test('explicit long action can advance the whole clock by hours', () => {
  const world = createEmptyWorld('clock')
  let clock = createWorldRuntimeClock(world)
  clock = advanceWorldRuntimeClock(clock, world, 180)
  assert.equal(clock.minuteOfDay, 11 * 60)
})

test('season follows authored season lengths', () => {
  const world = createEmptyWorld('clock')
  world.timeWeather!.seasons = [
    { id: 'wet', name: 'Wet', lengthDays: 10, weatherPrompt: '' },
    { id: 'dry', name: 'Dry', lengthDays: 20, weatherPrompt: '' },
  ]
  assert.equal(seasonAtDay(world, 1).season?.name, 'Wet')
  assert.equal(seasonAtDay(world, 10).seasonDay, 10)
  assert.equal(seasonAtDay(world, 11).season?.name, 'Dry')
  assert.equal(seasonAtDay(world, 31).season?.name, 'Wet')
})

test('realtime mode advances only when inactive time is allowed', () => {
  const world = createEmptyWorld('clock')
  world.timeWeather!.mode = 'realtime'
  world.timeWeather!.simpleDayRealMinutes = 24
  world.timeWeather!.pauseWhenInactive = false
  const clock = createWorldRuntimeClock(world, '2026-09-04T00:00:00.000Z')
  const advanced = advanceWorldRuntimeForInput(clock, world, '2026-09-04T00:01:00.000Z')
  assert.equal(advanced.minuteOfDay, clock.minuteOfDay + 60)
})
