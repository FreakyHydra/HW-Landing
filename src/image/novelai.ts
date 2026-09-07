import type { ImageGenerationRequest } from './image-generation'

export type NovelAiGenerationResult = {
  blob: Blob
  mimeType: string
}

type NovelAiImageProxyResponse = {
  imageBase64?: string
  mimeType?: string
  error?: string
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647)
}

export function buildNovelAiPayload(request: ImageGenerationRequest): Record<string, unknown> {
  const seed = randomSeed()
  const basePrompt = request.prompt.trim()
  const negativePrompt = request.negativePrompt.trim()
  return {
    input: basePrompt,
    model: request.model,
    action: 'generate',
    parameters: {
      params_version: 3,
      width: request.dimensions.width,
      height: request.dimensions.height,
      scale: 6,
      sampler: 'k_euler_ancestral',
      steps: request.steps,
      seed,
      extra_noise_seed: seed,
      n_samples: 1,
      noise_schedule: 'karras',
      dynamic_thresholding: false,
      cfg_rescale: 0,
      prefer_brownian: true,
      legacy: false,
      legacy_v3_extend: false,
      negative_prompt: negativePrompt,
      uc: negativePrompt,
      v4_prompt: {
        caption: { base_caption: basePrompt, char_captions: [] },
        use_coords: false,
        use_order: true,
        legacy_uc: false,
      },
      v4_negative_prompt: {
        caption: { base_caption: negativePrompt, char_captions: [] },
        use_coords: false,
        use_order: false,
        legacy_uc: false,
      },
    },
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mimeType })
}

export class NovelAiImageProvider {
  async generate(request: ImageGenerationRequest, persistentToken: string): Promise<NovelAiGenerationResult> {
    if (!persistentToken.trim()) throw new Error('NovelAI Persistent API token is required.')
    const response = await fetch('/api/image/novelai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NovelAI-Token': persistentToken.trim(),
      },
      body: JSON.stringify(buildNovelAiPayload(request)),
    })

    let payload: NovelAiImageProxyResponse = {}
    try { payload = await response.json() as NovelAiImageProxyResponse } catch {}

    if (!response.ok) {
      throw new Error(payload.error || `NovelAI image generation failed (${response.status}).`)
    }
    if (!payload.imageBase64) throw new Error('NovelAI image proxy returned no image data.')

    const mimeType = payload.mimeType || 'image/png'
    return { blob: base64ToBlob(payload.imageBase64, mimeType), mimeType }
  }
}
