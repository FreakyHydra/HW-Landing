import { getRoleplayResponseLength, roleplayLengthInstruction, roleplayLengthTokenCap, type RoleplayResponseLength } from './roleplay-length-settings.ts'

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
    /\bdo not (?:create|invent|output|continue|decide|include)\b/i,
    /\bplayer(?:'s)? (?:actions|words|feelings|input)\b/i,
  ]
  const matches = directiveSignals.filter((pattern) => pattern.test(head)).length
  if (matches < 2) return text
  return firstBreak >= 0 ? text.slice(firstBreak).trim() : ''
}

function stripLeakedControlText(text: string): string {
  // Internal prompt/control material must never reach rendered chat. If NovelAI
  // starts echoing any runtime section, discard that section and everything after it.
  const internalHeading = /(?:^|\n)\s*(?:CURRENT TURN(?:\s*-\s*HIGHEST AUTHORITY)?|AUTHORITY ORDER|CURRENT SCENE STATE|WORLD RULES(?:\s*-\s*USER AUTHORED AND BINDING IN THIS FICTION)?|WORLD CANON|CURRENT LOCATION(?:\s*-\s*ESTABLISHED FACTS)?|RELEVANT CHARACTERS(?:\s*-\s*CHARACTER SHEETS ARE AUTHORITATIVE)?|PLAYER PERSONA|RELATIONSHIP AND RUNTIME STATE|RECENT CONTINUITY(?:\s*-\s*STRONG BUT BELOW AUTHORED CANON)?|GENERATION INSTRUCTIONS|GROUNDING|AMBIGUOUS INTENT AND NOVEL EXPERIENCES|PROSE QUALITY POLICY|OUTPUT CONTRACT|RESPONSE LENGTH|DIALOGUE BALANCE|TURN MODE|USER DIRECTION)\s*(?:\n|$)/i
  const metadataBlock = /(?:^|\n|\s{2,})(?:Style|POV|Scene|Time|Location|Tags|Season|Weather)\s*:\s*/i
  const explicitEnd = /(?:^|\n|\s+)[—-]*\s*END\s*[—-]*(?=\s|$)/i
  const knownInstructionLeak = /(?:^|\n|\s{2,})(?:Return only finished roleplay prose suitable for direct display|You are the living world runtime for\b|Resolve conflicts in this order:|Authored facts and rules are facts of the current fiction\.)/i

  const starts = [internalHeading, metadataBlock, explicitEnd, knownInstructionLeak]
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0)
  if (!starts.length) return text
  return text.slice(0, Math.min(...starts)).trim()
}

function stripTrailingMetadata(text: string): string {
  const metadataLine = /(?:^|\n)\s*(?:Emotion|Mood|State|Relationship|Trust|Affection|Thoughts?|Analysis|Notes?|Metadata|Style|POV|Scene|Time|Location|Tags|Season|Weather)\s*:\s*[^\n]*\s*$/i
  let previous = ''
  while (text !== previous) {
    previous = text
    text = text.replace(metadataLine, '').trim()
  }
  return text
}

export function cleanWorldRuntimeReply(raw: string, characterNames: string[] = []): string {
  let text = raw.trim()

  const lastThinkClose = text.toLowerCase().lastIndexOf('</think>')
  if (lastThinkClose >= 0) text = text.slice(lastThinkClose + '</think>'.length).trim()
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  text = text.replace(/<think>[\s\S]*$/gi, '').trim()

  text = text.replace(/^\s*```(?:text|markdown)?\s*/i, '').replace(/\s*```\s*$/i, '')
  text = text.replace(/^\s*(?:assistant|world runtime|response)\s*:\s*/i, '')
  text = stripLeadingRuntimeDirective(text)

  const playerContinuation = text.search(/(?:^|\n|\s{2,})Player\s*:/i)
  if (playerContinuation >= 0) text = text.slice(0, playerContinuation).trim()

  const labels = ['Narrator', ...characterNames]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
  if (labels.length) {
    const labelPattern = new RegExp(`(?:^|\\s{2,}|\\n)\\s*(?:${labels.join('|')})\\s*:\\s*`, 'gi')
    text = text.replace(labelPattern, '\n\n')
  }

  text = text.replace(/\[([^\[\]]{1,1200})\]/g, '$1')
  text = stripLeakedControlText(text)
  text = stripTrailingMetadata(text)
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/[ \t]+\n/g, '\n')
  return text.trim()
}

export function enforceRoleplayResponseLength(text: string, value: RoleplayResponseLength): string {
  if (value !== 'quick') return text.trim()
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  if (paragraphs.length <= 2) return text.trim()
  return paragraphs.slice(0, 2).join('\n\n').trim()
}

export class WorldRuntimeNovelAiProvider {
  async generateRaw(request: WorldRuntimeGenerationRequest, persistentToken = ''): Promise<string> {
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
    return payload.reply
  }

  async generate(request: WorldRuntimeGenerationRequest, persistentToken = ''): Promise<string> {
    const responseLength = getRoleplayResponseLength()
    const maxTokens = Math.min(request.maxTokens ?? 850, roleplayLengthTokenCap(responseLength))
    const raw = await this.generateRaw({
      ...request,
      prompt: `${request.prompt}\n\n${roleplayLengthInstruction(responseLength)}`,
      maxTokens,
    }, persistentToken)
    const cleaned = cleanWorldRuntimeReply(raw, request.characterNames)
    const reply = enforceRoleplayResponseLength(cleaned, responseLength)
    if (!reply) throw new Error('NovelAI returned no usable roleplay text after runtime cleanup.')
    return reply
  }
}
