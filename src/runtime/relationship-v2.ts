export const RELATIONSHIP_MIN = -1000
export const RELATIONSHIP_NEUTRAL = 0
export const RELATIONSHIP_MAX = 10000
export const DEFAULT_PERSONA_ID = 'default'

export const RELATIONSHIP_DIMENSIONS = [
  'trust', 'affection', 'respect', 'fear', 'comfort', 'suspicion',
  'attachment', 'protectiveness', 'resentment', 'loyalty', 'familiarity', 'authority',
] as const

export type RelationshipDimension = typeof RELATIONSHIP_DIMENSIONS[number]
export type RelationshipDimensions = Record<RelationshipDimension, number>

export type RelationshipEvent = {
  id: string
  characterId: string
  personaId: string
  turnId: string
  delta: number
  playerDelta: number
  characterDelta: number
  reason: string
  dimensionDeltas: Partial<RelationshipDimensions>
  causalMemory: { event: string; appraisal: string; aftereffects: string[] }
  createdAt: number
}

export type RelationshipRecord = {
  characterId: string
  personaId: string
  baselineScore: number
  score: number
  dimensions: RelationshipDimensions
  updatedAt: number
  events: RelationshipEvent[]
}

export type RelationshipState = Record<string, RelationshipRecord>

export function relationshipKey(characterId: string, personaId = DEFAULT_PERSONA_ID): string {
  return `${characterId}::${personaId}`
}

export function emptyDimensions(): RelationshipDimensions {
  return Object.fromEntries(RELATIONSHIP_DIMENSIONS.map((dimension) => [dimension, 0])) as RelationshipDimensions
}

export function relationshipTier(score: number): string {
  if (score < -700) return 'Hostile'
  if (score < -300) return 'Antagonistic'
  if (score < -80) return 'Wary'
  if (score < 120) return 'Stranger'
  if (score < 500) return 'Acquaintance'
  if (score < 1200) return 'Comfortable'
  if (score < 2500) return 'Trusted'
  if (score < 4500) return 'Close'
  if (score < 7000) return 'Deeply bonded'
  return 'Devoted'
}

const cue = (pattern: RegExp, text: string): boolean => pattern.test(text)

export function evaluateRelationshipTurn(input: {
  characterId: string
  personaId?: string
  previousScore: number
  playerMessage: string
  characterReply: string
  turnId: string
  now?: number
}): RelationshipEvent {
  const player = input.playerMessage.trim()
  const reply = input.characterReply.trim()
  let playerDelta = 0
  let characterDelta = 0
  const reasons: string[] = []
  const dimensions: Partial<RelationshipDimensions> = {}
  let appraisal = 'No strong relational signal is clear.'
  const aftereffects: string[] = []

  const coercion = cue(/\b(?:no choice|without your consent|boundaries (?:do not|don't) matter|force you|make you)\b/i, player)
  const hostility = cue(/\b(?:attack|kill|hurt you|harm you|hate you|threaten)\b/i, player)
  const fear = cue(/\b(?:afraid|scared|terrified|flinch|trembl|please don['’]t hurt me)\b/i, player)
  const boundary = cue(/\b(?:not comfortable|not ready|stop|don['’]t touch me|leave me alone|my boundary)\b/i, player)
  const kindness = cue(/\b(?:thank you|thanks|appreciate|care (?:about|for) you|here for you)\b/i, player)
  const affection = cue(/\b(?:i love you|hug(?:ged|s|ging)?|kiss(?:ed|es|ing)?)\b/i, player)

  if (cue(/\b(?:i trust you|you can trust me|put my trust in you)\b/i, player)) { playerDelta += 6; reasons.push('Trust was expressed.'); dimensions.trust = 3 }
  if (cue(/\b(?:i(?:'m| am) sorry|i apolog(?:ise|ize)|please forgive me|i forgive you)\b/i, player)) { playerDelta += 8; reasons.push('An apology or forgiveness was offered.') }
  if (kindness) { playerDelta += 3; reasons.push('Kindness was offered.'); dimensions.comfort = 2; dimensions.trust = (dimensions.trust ?? 0) + 1 }
  if (affection) { playerDelta += 7; reasons.push('Affection was expressed.'); dimensions.affection = 3 }
  if (cue(/\b(?:betray(?:ed|ing)? you|lied to you|lying to you|deceiv(?:e|ed|ing) you)\b/i, player)) { playerDelta -= 30; reasons.push('Betrayal or deception damaged trust.'); dimensions.trust = -8; dimensions.suspicion = 6 }
  if (hostility) { playerDelta -= 26; reasons.push('The player acted with hostility.'); dimensions.fear = 4; dimensions.suspicion = 4 }
  if (coercion) { playerDelta -= 28; reasons.push('A boundary was deliberately overridden.'); dimensions.trust = -8; dimensions.resentment = 7; dimensions.suspicion = 5 }

  if (fear && !hostility) {
    appraisal = 'The player appears afraid, not hostile.'
    aftereffects.push('notice fear', 'lower needless intensity', 'retain character motives')
    dimensions.fear = 4
    dimensions.protectiveness = 6
  } else if (coercion) {
    appraisal = 'The player is trying to override a boundary.'
    aftereffects.push('protect boundaries', 'resist coercion', 'do not appease')
  } else if (boundary) {
    appraisal = 'The player is setting a personal boundary.'
    aftereffects.push('recognize the boundary', 'respond in character')
  } else if (kindness) {
    appraisal = 'The player is offering kindness.'
    aftereffects.push('notice the kindness', 'respond according to established trust')
  } else if (hostility) {
    appraisal = 'The player is acting with hostility.'
    aftereffects.push('assess threat', 'protect self or others', 'retain boundaries')
  }

  if (cue(/\b(?:i trust you|trusts you|believes you)\b/i, reply)) { characterDelta += 4; reasons.push('The character reciprocated trust.') }
  if (cue(/\b(?:thank you|thanks|grateful|appreciate)\b/i, reply)) characterDelta += 2
  if (cue(/\b(?:i (?:do not|don't) trust you|never trust you again|stay away from me|get away from me)\b/i, reply)) characterDelta -= 6

  const established = Math.min(0.75, Math.abs(input.previousScore) / RELATIONSHIP_MAX * 0.75)
  if (!coercion && !hostility) playerDelta = Math.round(playerDelta * (1 - established))
  playerDelta = Math.max(-40, Math.min(40, playerDelta))
  characterDelta = Math.max(-10, Math.min(10, characterDelta))
  const delta = Math.max(-40, Math.min(40, playerDelta + characterDelta))

  return {
    id: `${input.turnId}:${input.characterId}`,
    characterId: input.characterId,
    personaId: input.personaId || DEFAULT_PERSONA_ID,
    turnId: input.turnId,
    delta,
    playerDelta,
    characterDelta,
    reason: reasons.length ? [...new Set(reasons)].join(' ') : 'No notable relationship change this turn.',
    dimensionDeltas: dimensions,
    causalMemory: { event: player.slice(0, 500), appraisal, aftereffects },
    createdAt: input.now ?? Date.now(),
  }
}

export function applyRelationshipEvent(record: RelationshipRecord | undefined, event: RelationshipEvent): RelationshipRecord {
  const base: RelationshipRecord = record ? structuredClone(record) : {
    characterId: event.characterId,
    personaId: event.personaId,
    baselineScore: 0,
    score: 0,
    dimensions: emptyDimensions(),
    updatedAt: event.createdAt,
    events: [],
  }
  const prior = base.events.find((item) => item.turnId === event.turnId)
  if (prior) {
    base.score -= prior.delta
    for (const [key, value] of Object.entries(prior.dimensionDeltas)) base.dimensions[key as RelationshipDimension] -= Number(value)
    base.events = base.events.filter((item) => item.turnId !== event.turnId)
  }
  base.score = Math.max(RELATIONSHIP_MIN, Math.min(RELATIONSHIP_MAX, base.score + event.delta))
  for (const [key, value] of Object.entries(event.dimensionDeltas)) {
    const dimension = key as RelationshipDimension
    base.dimensions[dimension] = Math.max(-100, Math.min(100, base.dimensions[dimension] + Number(value)))
  }
  base.events.push(event)
  base.updatedAt = event.createdAt
  return base
}

export class LocalRelationshipRepository {
  private readonly key = 'hw.runtime.relationships.v2'

  list(): RelationshipState {
    try { return JSON.parse(localStorage.getItem(this.key) || '{}') as RelationshipState } catch { return {} }
  }

  get(characterId: string, personaId = DEFAULT_PERSONA_ID): RelationshipRecord | undefined {
    const record = this.list()[relationshipKey(characterId, personaId)]
    return record ? structuredClone(record) : undefined
  }

  apply(event: RelationshipEvent): RelationshipRecord {
    const state = this.list()
    const key = relationshipKey(event.characterId, event.personaId)
    const next = applyRelationshipEvent(state[key], event)
    state[key] = next
    localStorage.setItem(this.key, JSON.stringify(state))
    return structuredClone(next)
  }
}
