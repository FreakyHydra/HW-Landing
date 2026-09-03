import type { CharacterCardV2 } from '../domain/character-card-v2'
import type { EvolutionProposal, Observation } from '../domain/character-record'
import type { Persona } from '../domain/persona'

export type CodaCoreEventMap = {
  'character.generate.requested': { brief: string }
  'character.expand.requested': { card: CharacterCardV2; field: keyof CharacterCardV2['data'] }
  'story.analyze.requested': { characterId: string; history: string }
  'observation.extracted': Observation
  'evolution.proposed': EvolutionProposal
  'canon.compare.requested': { card: CharacterCardV2; proposal: EvolutionProposal }
  'lore.generate.requested': { brief: string }
  'persona.assist.requested': { persona: Persona; field: keyof Persona }
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
