import type { CharacterCardV2 } from './character-card-v2'

export type Observation = {
  id: string
  text: string
  source: string
  createdAt: string
}

export type EvolutionTargetField = 'description' | 'personality' | 'scenario' | 'mes_example' | 'creator_notes'
export type EvolutionStatus = 'pending' | 'accepted' | 'memory' | 'rejected'

export type EvolutionProposal = {
  id: string
  observationId?: string
  source: string
  timestamp: string
  confidence: number
  evidenceCount: number
  targetField: EvolutionTargetField
  proposedValue: string
  status: EvolutionStatus
  resolvedAt?: string
}

export type CharacterRecord = {
  id: string
  cardV2: CharacterCardV2
  developedCanon: string[]
  memories: string[]
  relationships: Record<string, string>
  sceneState: Record<string, string>
  observations: Observation[]
  evolutionProposals: EvolutionProposal[]
  createdAt: string
  updatedAt: string
}

export function transitionProposal(
  record: CharacterRecord,
  proposalId: string,
  status: EvolutionStatus,
  now = new Date().toISOString(),
): CharacterRecord {
  const proposal = record.evolutionProposals.find((item) => item.id === proposalId)
  if (!proposal) throw new Error('Evolution proposal not found')
  if (proposal.status !== 'pending') throw new Error('Only pending proposals can be resolved')

  const next = structuredClone(record)
  const nextProposal = next.evolutionProposals.find((item) => item.id === proposalId)!
  nextProposal.status = status
  nextProposal.resolvedAt = now
  next.updatedAt = now

  if (status === 'accepted') {
    const field = nextProposal.targetField
    const current = next.cardV2.data[field]
    next.cardV2.data[field] = current ? `${current}\n\n${nextProposal.proposedValue}` : nextProposal.proposedValue
  } else if (status === 'memory') {
    next.memories.push(nextProposal.proposedValue)
  }
  return next
}
