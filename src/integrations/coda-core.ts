import type { CharacterCardV2 } from '../domain/character-card-v2'
import type { EvolutionProposal, Observation } from '../domain/character-record'
import type { Persona } from '../domain/persona'
import type { WorldRecord } from '../domain/world'

export type CodaWorldContext = {
  world: WorldRecord
  regionId?: string
  speciesId?: string
  familyId?: string
  societyIds?: string[]
  factionIds?: string[]
  relevantMemoryIds?: string[]
}

export type CodaCoreEventMap = {
  'world.expand.requested': { world: WorldRecord; field: keyof WorldRecord }
  'world.lore.generate.requested': { world: WorldRecord; brief: string }
  'world.memory.extract.requested': { worldId: string; history: string }
  'character.generate.requested': { context: CodaWorldContext; brief: string }
  'character.expand.requested': { context: CodaWorldContext; card: CharacterCardV2; field: keyof CharacterCardV2['data'] }
  'story.analyze.requested': { worldId: string; characterId: string; history: string }
  'observation.extracted': Observation
  'evolution.proposed': EvolutionProposal
  'canon.compare.requested': { card: CharacterCardV2; proposal: EvolutionProposal }
  'lore.generate.requested': { world: WorldRecord; brief: string }
  'persona.assist.requested': { world: WorldRecord; persona: Persona; field: keyof Persona }
}

export interface CodaCoreAdapter {
  available(): Promise<boolean>
  request<K extends keyof CodaCoreEventMap>(event: K, payload: CodaCoreEventMap[K]): Promise<void>
}

export class OfflineCodaCoreAdapter implements CodaCoreAdapter {
  async available() { return false }
  async request<K extends keyof CodaCoreEventMap>(_event: K, _payload: CodaCoreEventMap[K]) {
    throw new Error('Coda Core is not connected')
  }
}
