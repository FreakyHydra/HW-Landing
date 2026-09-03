import type { CharacterRecord } from '../domain/character-record'
import type { Persona } from '../domain/persona'
import { normalizeWorldRecord, type WorldRecord, type WorldTimeWeather } from '../domain/world.ts'

export interface CharacterRepository {
  list(): Promise<CharacterRecord[]>
  get(id: string): Promise<CharacterRecord | undefined>
  save(record: CharacterRecord): Promise<void>
  remove(id: string): Promise<void>
}

export interface PersonaRepository {
  list(): Promise<Persona[]>
  get(id: string): Promise<Persona | undefined>
  save(persona: Persona): Promise<void>
  remove(id: string): Promise<void>
}

export interface WorldRepository {
  list(): Promise<WorldRecord[]>
  get(id: string): Promise<WorldRecord | undefined>
  save(world: WorldRecord): Promise<void>
  remove(id: string): Promise<void>
}

export interface LoreRepository {
  list(): Promise<unknown[]>
}

export class MemoryRepository<T extends { id: string }> {
  protected records = new Map<string, T>()
  async list(): Promise<T[]> { return [...this.records.values()].map((item) => structuredClone(item)) }
  async get(id: string): Promise<T | undefined> {
    const item = this.records.get(id)
    return item ? structuredClone(item) : undefined
  }
  async save(item: T): Promise<void> { this.records.set(item.id, structuredClone(item)) }
  async remove(id: string): Promise<void> { this.records.delete(id) }
}

class LocalRepository<T extends { id: string }> extends MemoryRepository<T> {
  private readonly storageKey: string

  constructor(storageKey: string) {
    super()
    this.storageKey = storageKey
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '[]') as T[]
      value.forEach((item) => this.records.set(item.id, item))
    } catch {
      localStorage.removeItem(storageKey)
    }
  }
  protected persist() { localStorage.setItem(this.storageKey, JSON.stringify([...this.records.values()])) }
  override async save(item: T) { await super.save(item); this.persist() }
  override async remove(id: string) { await super.remove(id); this.persist() }
}

export class LocalCharacterRepository extends LocalRepository<CharacterRecord> implements CharacterRepository {
  constructor() { super('hw.forge.characters.v1') }
}

export class LocalPersonaRepository extends LocalRepository<Persona> implements PersonaRepository {
  constructor() {
    super('hw.forge.personas.v1')
    // Remove the short-lived built-in Skyler seed from machines that loaded it.
    // Imported/user-created personas use their own IDs and are left untouched.
    if (this.records.delete('skyler-bitterroot')) this.persist()
  }
}

function pendingTimeWeather(worldId: string): WorldTimeWeather | undefined {
  try {
    const value = localStorage.getItem(`hw.forge.world-time-weather.${worldId}`)
    return value ? JSON.parse(value) as WorldTimeWeather : undefined
  } catch {
    return undefined
  }
}

export class LocalWorldRepository extends LocalRepository<WorldRecord> implements WorldRepository {
  constructor() { super('hw.forge.worlds.v1') }
  override async list(): Promise<WorldRecord[]> { return (await super.list()).map(normalizeWorldRecord) }
  override async get(id: string): Promise<WorldRecord | undefined> {
    const world = await super.get(id)
    return world ? normalizeWorldRecord(world) : undefined
  }
  override async save(world: WorldRecord): Promise<void> {
    const normalized = normalizeWorldRecord(world)
    const pending = pendingTimeWeather(normalized.id)
    if (pending) normalized.timeWeather = structuredClone(pending)
    await super.save(normalized)
    if (pending) localStorage.removeItem(`hw.forge.world-time-weather.${normalized.id}`)
  }
}
