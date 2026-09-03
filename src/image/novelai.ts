import type { ImageGenerationRequest } from './image-generation'

export type NovelAiGenerationResult = {
  blob: Blob
  mimeType: string
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
      params_version: 4,
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

async function unzipFirstFile(zip: ArrayBuffer): Promise<Blob> {
  const view = new DataView(zip)
  if (view.byteLength < 30 || view.getUint32(0, true) !== 0x04034b50) throw new Error('NovelAI returned an unexpected image archive.')
  const compressionMethod = view.getUint16(8, true)
  const compressedSize = view.getUint32(18, true)
  const fileNameLength = view.getUint16(26, true)
  const extraLength = view.getUint16(28, true)
  const start = 30 + fileNameLength + extraLength
  const end = compressedSize ? start + compressedSize : view.byteLength
  const compressed = zip.slice(start, Math.min(end, view.byteLength))

  if (compressionMethod === 0) return new Blob([compressed], { type: 'image/png' })
  if (compressionMethod !== 8) throw new Error(`Unsupported NovelAI ZIP compression method: ${compressionMethod}`)
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack NovelAI image responses.')

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const bytes = await new Response(stream).arrayBuffer()
  return new Blob([bytes], { type: 'image/png' })
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
    if (!response.ok) {
      let detail = ''
      try { detail = (await response.json()).error || '' } catch { detail = await response.text() }
      throw new Error(detail || `NovelAI image generation failed (${response.status}).`)
    }
    const archive = await response.arrayBuffer()
    const blob = await unzipFirstFile(archive)
    return { blob, mimeType: blob.type || 'image/png' }
  }
}
