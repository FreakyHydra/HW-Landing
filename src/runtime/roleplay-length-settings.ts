export type RoleplayResponseLength = 'quick' | 'immersive' | 'novel'

export const ROLEPLAY_RESPONSE_LENGTH_KEY = 'hw.runtime.responseLength'

export const ROLEPLAY_RESPONSE_LENGTHS: Array<{ value: RoleplayResponseLength; label: string; description: string }> = [
  { value: 'quick', label: 'Quick', description: 'About 1-2 paragraphs.' },
  { value: 'immersive', label: 'Immersive', description: 'About 3-5 substantial paragraphs. Default.' },
  { value: 'novel', label: 'Novel-like', description: 'About 5-8 substantial paragraphs.' },
]

export function getRoleplayResponseLength(): RoleplayResponseLength {
  const stored = localStorage.getItem(ROLEPLAY_RESPONSE_LENGTH_KEY)
  return stored === 'quick' || stored === 'novel' || stored === 'immersive' ? stored : 'immersive'
}

export function saveRoleplayResponseLength(value: RoleplayResponseLength): RoleplayResponseLength {
  localStorage.setItem(ROLEPLAY_RESPONSE_LENGTH_KEY, value)
  return value
}

export function roleplayLengthInstruction(value = getRoleplayResponseLength()): string {
  if (value === 'quick') return `RESPONSE LENGTH\n- Quick mode: usually answer in about 1-2 paragraphs.\n- Keep the scene moving and prioritize dialogue, immediate reactions, and only the narration needed to understand the moment.\n- Do not pad a naturally short exchange.\n- Finish the current sentence, dialogue line, and immediate beat naturally. Never stop mid-word, mid-sentence, or mid-dialogue merely to satisfy the length preference.`
  if (value === 'novel') return `RESPONSE LENGTH\n- Novel-like mode: usually answer in about 5-8 substantial paragraphs when the scene supports it.\n- Add meaningful scene progression, environmental detail, character reactions, subtext, and dialogue.\n- Do not add filler merely to reach a paragraph count, and allow naturally brief exchanges to stay shorter.\n- Always finish the current sentence and scene beat naturally.`
  return `RESPONSE LENGTH\n- Immersive mode: usually answer in about 3-5 substantial paragraphs.\n- Balance dialogue with meaningful action, reaction, subtext, and environmental detail.\n- Do not pad a naturally short exchange just to reach a paragraph count.\n- Always finish the current sentence and scene beat naturally.`
}

export function roleplayLengthTokenCap(value = getRoleplayResponseLength()): number {
  // Length is primarily a writing preference, not a hard truncation target.
  // Keep enough headroom for the model to finish its current sentence/beat cleanly.
  if (value === 'quick') return 800
  if (value === 'novel') return 1600
  return 1100
}
