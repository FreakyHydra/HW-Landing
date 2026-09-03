import { worldTimeWeatherOf, type WorldRecord, type WorldSeason } from '../domain/world.ts'

export type WorldRuntimeClock = {
  day: number
  minuteOfDay: number
  lastRealTimestamp: string
}

export type WorldRuntimeTimeSnapshot = {
  day: number
  hour: number
  minute: number
  minuteOfDay: number
  season?: WorldSeason
  seasonDay?: number
}

function clampPositiveInt(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function dayMinutes(world: WorldRecord): number {
  return clampPositiveInt(worldTimeWeatherOf(world).hoursPerDay, 24) * 60
}

export function createWorldRuntimeClock(world: WorldRecord, now = new Date().toISOString()): WorldRuntimeClock {
  const settings = worldTimeWeatherOf(world)
  const minutesPerDay = dayMinutes(world)
  const startMinute = Math.max(0, Math.min(minutesPerDay - 1, Math.round(settings.startingHour * 60)))
  return {
    day: Math.max(1, Math.floor(settings.startingDay)),
    minuteOfDay: startMinute,
    lastRealTimestamp: now,
  }
}

export function advanceWorldRuntimeClock(clock: WorldRuntimeClock, world: WorldRecord, minutes: number, now = new Date().toISOString()): WorldRuntimeClock {
  const minutesPerDay = dayMinutes(world)
  const delta = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0))
  const total = (Math.max(1, clock.day) - 1) * minutesPerDay + Math.max(0, clock.minuteOfDay) + delta
  return {
    day: Math.floor(total / minutesPerDay) + 1,
    minuteOfDay: total % minutesPerDay,
    lastRealTimestamp: now,
  }
}

export function advanceWorldRuntimeForInput(clock: WorldRuntimeClock, world: WorldRecord, now = new Date().toISOString()): WorldRuntimeClock {
  const settings = worldTimeWeatherOf(world)
  if (settings.mode === 'tick') return advanceWorldRuntimeClock(clock, world, settings.minutesPerInput, now)

  if (settings.pauseWhenInactive) return { ...clock, lastRealTimestamp: now }
  const previous = Date.parse(clock.lastRealTimestamp)
  const current = Date.parse(now)
  if (!Number.isFinite(previous) || !Number.isFinite(current) || current <= previous) return { ...clock, lastRealTimestamp: now }

  const elapsedRealMinutes = (current - previous) / 60_000
  const realMinutesPerWorldDay = Math.max(1, settings.simpleDayRealMinutes)
  const worldMinutesPerDay = dayMinutes(world)
  const worldMinutes = Math.floor(elapsedRealMinutes * (worldMinutesPerDay / realMinutesPerWorldDay))
  return advanceWorldRuntimeClock(clock, world, worldMinutes, now)
}

export function seasonAtDay(world: WorldRecord, day: number): { season?: WorldSeason; seasonDay?: number } {
  const settings = worldTimeWeatherOf(world)
  if (!settings.seasonsEnabled || !settings.seasons.length) return {}
  const yearLength = settings.seasons.reduce((sum, season) => sum + Math.max(1, Math.floor(season.lengthDays)), 0)
  if (!yearLength) return {}
  let cursor = ((Math.max(1, Math.floor(day)) - 1) % yearLength) + 1
  for (const season of settings.seasons) {
    const length = Math.max(1, Math.floor(season.lengthDays))
    if (cursor <= length) return { season, seasonDay: cursor }
    cursor -= length
  }
  return {}
}

export function worldRuntimeTimeSnapshot(clock: WorldRuntimeClock, world: WorldRecord): WorldRuntimeTimeSnapshot {
  const hoursPerDay = clampPositiveInt(worldTimeWeatherOf(world).hoursPerDay, 24)
  const minuteOfDay = Math.max(0, Math.min(hoursPerDay * 60 - 1, Math.floor(clock.minuteOfDay)))
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const season = seasonAtDay(world, clock.day)
  return { day: Math.max(1, Math.floor(clock.day)), hour, minute, minuteOfDay, ...season }
}

export function formatWorldRuntimeTime(clock: WorldRuntimeClock, world: WorldRecord): string {
  const snapshot = worldRuntimeTimeSnapshot(clock, world)
  const time = `${String(snapshot.hour).padStart(2, '0')}:${String(snapshot.minute).padStart(2, '0')}`
  return `Day ${snapshot.day}, ${time}${snapshot.season ? `, ${snapshot.season.name}${snapshot.seasonDay ? ` day ${snapshot.seasonDay}` : ''}` : ''}`
}
