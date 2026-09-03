export const WORLD_RUNTIME_NAI_MODELS = ['xialong-v1', 'glm-4-6'] as const
export type WorldRuntimeNovelAiModel = typeof WORLD_RUNTIME_NAI_MODELS[number]

export type WorldRuntimeGenerationRequest = {
  prompt: string
  model?: WorldRuntimeNovelAiModel
  maxTokens?: number
  temperature?: number
  characterNames?: string[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripLeadingRuntimeDirective(text: string): string {
  const firstBreak = text.search(/\n\s*\n|\s{2,}(?=[A-Z"“])/)
  const head = firstBreak >= 0 ? text.slice(0, firstBreak).trim() : text.trim()
  const directiveSignals = [
    /\bno invented\b/i,
    /\bdo not assume\b/i,
    /\brespect .+ relationship state\b/i,
    /\bdefault to (?:silence|environment|another inhabitant)\b/i,
    /\bshort natural response\b/i,
    /\bdo not (?:create|invent|output|continue)\b/i,
  ]
  const matches = directiveSignals.filter((pattern) => pattern.test(head)).length
  if (matches < 2) return text
  return firstBreak >= 0 ? text.slice(firstBreak).trim() : ''
}

export function cleanWorldRuntimeReply(raw: string, characterNames: string[] = []): string {
  let text = raw.trim()

  // Some reasoning-capable models can expose hidden scratch text before a
  // closing think tag even when the opening tag is omitted by the upstream.
  const lastThinkClose = text.toLowerCase().lastIndexOf('</think>')
  if (lastThinkClose >= 0) text = text.slice(lastThinkClose + '</think>'.length).trim()
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  text = text.replace(/<think>[\s\S]*$/gi, '').trim()

  text = text.replace(/^\s*```(?:text|markdown)?\s*/i, '').replace(/\s*```\s*$/i, '')
  text = text.replace(/^\s*(?:assistant|world runtime|response)\s*:\s*/i, '')
  text = stripLeadingRuntimeDirective(text)

  // The model must not continue the player's side of the exchange.
  const playerContinuation = text.search(/(?:^|\n|\s{2,})Player\s*:/i)
  if (playerContinuation >= 0) text = text.slice(0, playerContinuation).trim()

  // Transcript-style labels sometimes survive prompt instructions. Convert
  // them to paragraph boundaries rather than displaying an RPG cast list.
  const labels = ['Narrator', ...characterNames]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
  if (labels.length) {
    const labelPattern = new RegExp(`(?:^|\\s{2,}|\\n)\\s*(?:${labels.join('|')})\\s*:\\s*`, 'gi')
    text = text.replace(labelPattern, '\n\n')
  }

  // Old roleplay formatting used [action text]. The world runtime renders
  // continuous prose, so unwrap action brackets instead of preserving them.
  text = text.replace(/\[([^\[\]]{1,1200})\]/g, '$1')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/[ \t]+\n/g, '\n')
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
    const reply = cleanWorldRuntimeReply(payload.reply, request.characterNames)
    if (!reply) throw new Error('NovelAI returned no usable roleplay text after runtime cleanup.')
    return reply
  }
}
