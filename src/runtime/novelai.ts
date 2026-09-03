export const WORLD_RUNTIME_NAI_MODELS = ['xialong-v1', 'glm-4-6'] as const
export type WorldRuntimeNovelAiModel = typeof WORLD_RUNTIME_NAI_MODELS[number]

export type WorldRuntimeGenerationRequest = {
  prompt: string
  model?: WorldRuntimeNovelAiModel
  maxTokens?: number
  temperature?: number
}

export function cleanWorldRuntimeReply(raw: string): string {
  let text = raw.trim()

  // Some reasoning-capable models can expose hidden scratch text before a
  // closing think tag even when the opening tag is omitted by the upstream.
  const lastThinkClose = text.toLowerCase().lastIndexOf('</think>')
  if (lastThinkClose >= 0) text = text.slice(lastThinkClose + '</think>'.length).trim()
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  text = text.replace(/<think>[\s\S]*$/gi, '').trim()

  // Keep the runtime as prose rather than a model/debug transcript.
  text = text.replace(/^\s*(?:assistant|world runtime|response)\s*:\s*/i, '')
  text = text.replace(/^\s*```(?:text|markdown)?\s*/i, '').replace(/\s*```\s*$/i, '')
  return text.trim()
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
        maxTokens: request.maxTokens ?? 520,
        temperature: request.temperature ?? 0.82,
      }),
    })
    if (!response.ok) {
      let detail = ''
      try { detail = (await response.json()).error || '' } catch { detail = await response.text() }
      throw new Error(detail || `NovelAI roleplay generation failed (${response.status}).`)
    }
    const payload = await response.json() as { reply?: unknown }
    if (typeof payload.reply !== 'string' || !payload.reply.trim()) throw new Error('NovelAI returned an empty roleplay reply.')
    const reply = cleanWorldRuntimeReply(payload.reply)
    if (!reply) throw new Error('NovelAI returned no usable roleplay text after runtime cleanup.')
    return reply
  }
}
