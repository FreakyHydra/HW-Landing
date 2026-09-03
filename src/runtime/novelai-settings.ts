import { WORLD_RUNTIME_NAI_MODELS, type WorldRuntimeNovelAiModel } from './novelai.ts'

export const NOVELAI_TOKEN_KEY = 'hw.runtime.novelai.token'
export const NOVELAI_MODEL_KEY = 'hw.runtime.novelai.model'
export const NOVELAI_MAX_TOKENS_KEY = 'hw.runtime.novelai.maxTokens'
export const NOVELAI_TEMPERATURE_KEY = 'hw.runtime.novelai.temperature'

export type NovelAiRuntimeSettings = {
  token: string
  model: WorldRuntimeNovelAiModel
  maxTokens: number
  temperature: number
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

export function getNovelAiRuntimeSettings(): NovelAiRuntimeSettings {
  const storedModel = localStorage.getItem(NOVELAI_MODEL_KEY)
  const model = WORLD_RUNTIME_NAI_MODELS.includes(storedModel as WorldRuntimeNovelAiModel)
    ? storedModel as WorldRuntimeNovelAiModel
    : 'xialong-v1'
  const maxTokens = clamp(Number(localStorage.getItem(NOVELAI_MAX_TOKENS_KEY)) || 850, 64, 1600)
  const temperature = clamp(Number(localStorage.getItem(NOVELAI_TEMPERATURE_KEY)) || 0.78, 0.1, 1.5)
  return {
    token: localStorage.getItem(NOVELAI_TOKEN_KEY) || '',
    model,
    maxTokens,
    temperature,
  }
}

export function saveNovelAiRuntimeSettings(settings: NovelAiRuntimeSettings): NovelAiRuntimeSettings {
  const model = WORLD_RUNTIME_NAI_MODELS.includes(settings.model) ? settings.model : 'xialong-v1'
  const maxTokens = clamp(Number(settings.maxTokens) || 850, 64, 1600)
  const temperature = clamp(Number(settings.temperature) || 0.78, 0.1, 1.5)
  const token = settings.token.trim()

  if (token) localStorage.setItem(NOVELAI_TOKEN_KEY, token)
  else localStorage.removeItem(NOVELAI_TOKEN_KEY)
  localStorage.setItem(NOVELAI_MODEL_KEY, model)
  localStorage.setItem(NOVELAI_MAX_TOKENS_KEY, String(maxTokens))
  localStorage.setItem(NOVELAI_TEMPERATURE_KEY, String(temperature))

  return { token, model, maxTokens, temperature }
}

export function clearNovelAiToken(): void {
  localStorage.removeItem(NOVELAI_TOKEN_KEY)
}
