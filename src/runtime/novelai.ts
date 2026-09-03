export const WORLD_RUNTIME_NAI_MODELS = ['xialong-v1', 'glm-4-6'] as const
export type WorldRuntimeNovelAiModel = typeof WORLD_RUNTIME_NAI_MODELS[number]

export type WorldRuntimeGenerationRequest = {
  prompt: string
  model?: WorldRuntimeNovelAiModel
  maxTokens?: number
  temperature?: number
}

export class WorldRuntimeNovelAiProvider {
  async generate(request: WorldRuntimeGenerationRequest, persistentToken = ''): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (persistentToken.trim()) headers['X-NovelAI-Token'] = persistentToken.trim()
    const response = await fetch('/api/roleplay/novelai', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: request.prompt,
        model: request.model || 'xialong-v1',
        maxTokens: request.maxTokens ?? 850,
        temperature: request.temperature ?? 0.9,
      }),
    })
    if (!response.ok) {
      let detail = ''
      try { detail = (await response.json()).error || '' } catch { detail = await response.text() }
      throw new Error(detail || `NovelAI roleplay generation failed (${response.status}).`)
    }
    const payload = await response.json() as { reply?: unknown }
    if (typeof payload.reply !== 'string' || !payload.reply.trim()) throw new Error('NovelAI returned an empty roleplay reply.')
    return payload.reply.trim()
  }
}
