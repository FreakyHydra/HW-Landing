import type { CharacterRecord } from '../domain/character-record'
import type { WorldRecord } from '../domain/world'

export type ImageEntityType = 'world' | 'character' | 'location' | 'family' | 'faction' | 'lore'
export type ImageAspect = 'landscape' | 'portrait' | 'square'
export type ImageProviderId = 'novelai'

export type ImageDimensions = { width: number; height: number }

export type ImageGenerationRequest = {
  entityType: ImageEntityType
  entityId: string
  prompt: string
  negativePrompt: string
  aspect: ImageAspect
  dimensions: ImageDimensions
  steps: number
  samples: 1
  model: 'nai-diffusion-5-full' | 'nai-diffusion-5-curated'
  provider: ImageProviderId
}

export type ImageCostEstimate = {
  freeEligible: boolean
  label: '0 Anlas eligible' | 'May consume Anlas'
  reasons: string[]
}

export type ImageAsset = {
  id: string
  entityType: ImageEntityType
  entityId: string
  provider: ImageProviderId
  model: string
  prompt: string
  negativePrompt: string
  aspect: ImageAspect
  width: number
  height: number
  steps: number
  createdAt: string
  mimeType: string
}

// NovelAI's three Normal aspect presets all stay at or below 1,048,576 pixels.
// Landscape matches the current 1216 x 832 UI preset shown in NovelAI ImageGen V5.
export const NAI_NORMAL_DIMENSIONS: Record<ImageAspect, ImageDimensions> = {
  landscape: { width: 1216, height: 832 },
  portrait: { width: 832, height: 1216 },
  square: { width: 1024, height: 1024 },
}

export function createFreeNovelAiRequest(
  entityType: ImageEntityType,
  entityId: string,
  prompt: string,
  negativePrompt = '',
  aspect: ImageAspect = entityType === 'character' ? 'portrait' : 'landscape',
): ImageGenerationRequest {
  return {
    entityType,
    entityId,
    prompt,
    negativePrompt,
    aspect,
    dimensions: NAI_NORMAL_DIMENSIONS[aspect],
    steps: 28,
    samples: 1,
    model: 'nai-diffusion-5-full',
    provider: 'novelai',
  }
}

export function estimateNovelAiCost(request: ImageGenerationRequest): ImageCostEstimate {
  const reasons: string[] = []
  if (request.samples !== 1) reasons.push('Free preset requires one image at a time.')
  if (request.steps > 28) reasons.push('Free preset requires 28 steps or fewer.')
  if (request.dimensions.width * request.dimensions.height > 1024 * 1024) reasons.push('Resolution exceeds the Normal free-preset pixel budget.')
  const freeEligible = reasons.length === 0
  return { freeEligible, label: freeEligible ? '0 Anlas eligible' : 'May consume Anlas', reasons }
}

function compact(parts: Array<string | undefined | false>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(', ')
}

export function buildWorldImagePrompt(world: WorldRecord): string {
  const places = world.locations.slice(0, 6).map((location) => location.name).join(', ')
  const species = world.species.slice(0, 6).map((item) => item.name).join(', ')
  const facts = world.lore.importantFacts.slice(0, 5).join('; ')
  return compact([
    'cinematic world cover illustration',
    world.identity.name && `world named ${world.identity.name}`,
    world.identity.genre,
    world.identity.tone && `${world.identity.tone} atmosphere`,
    world.identity.description,
    world.rules.technology && `technology level: ${world.rules.technology}`,
    world.rules.magicPhysics && `world rules: ${world.rules.magicPhysics}`,
    species && `inhabited by ${species}`,
    places && `notable places: ${places}`,
    facts && `established lore: ${facts}`,
    'cohesive environment design',
    'high detail',
    'no interface elements',
  ])
}

export function buildCharacterImagePrompt(record: CharacterRecord, world?: WorldRecord): string {
  const card = record.cardV2.data
  const worldContext = world
    ? compact([
        world.identity.name && `from the world ${world.identity.name}`,
        world.identity.genre,
        world.identity.tone && `${world.identity.tone} atmosphere`,
        world.rules.technology && `technology level: ${world.rules.technology}`,
      ])
    : ''
  return compact([
    'character portrait',
    card.name,
    card.description,
    card.personality && `personality expressed visually: ${card.personality}`,
    card.scenario && `setting context: ${card.scenario}`,
    worldContext,
    'focused character composition',
    'high detail',
    'no interface elements',
  ])
}
