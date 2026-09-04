export type RoleplayResponseLength = 'quick' | 'immersive' | 'novel'

export const ROLEPLAY_RESPONSE_LENGTH_KEY = 'hw.runtime.responseLength'

export const ROLEPLAY_RESPONSE_LENGTHS: Array<{ value: RoleplayResponseLength; label: string; description: string }> = [
  { value: 'quick', label: 'Quick', description: 'Maximum 2 paragraphs.' },
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

function dialogueBalanceInstruction(): string {
  return `DIALOGUE BALANCE\n- When an established character is actively participating in the exchange, let dialogue carry the interaction instead of narrating around them.\n- Keep narration concise and functional: immediate action, expression, positioning, and only the environmental detail needed for the moment.\n- Do not replace a character's natural spoken response with several sentences of atmosphere or explanatory narration.\n- Do not force dialogue when silence or nonverbal behavior is genuinely the natural response.`
}

export function roleplayLengthInstruction(value = getRoleplayResponseLength()): string {
  if (value === 'quick') return `RESPONSE LENGTH\n- Quick mode is a HARD MAXIMUM of 2 paragraphs. Never output a third paragraph.\n- Prefer 1 short paragraph for a tiny exchange and 2 paragraphs for a fuller beat. Do not pad to reach two.\n- Keep each paragraph compact. Prioritize character dialogue and immediate reaction over atmosphere, summary, or extended narration.\n- Finish the second paragraph cleanly. Do not begin another scene beat after it.\n\n${dialogueBalanceInstruction()}`
  if (value === 'novel') return `RESPONSE LENGTH\n- Novel-like mode: usually answer in about 5-8 substantial paragraphs when the scene supports it.\n- Add meaningful scene progression, environmental detail, character reactions, subtext, and dialogue.\n- Do not add filler merely to reach a paragraph count, and allow naturally brief exchanges to stay shorter.\n- Always finish the current sentence and scene beat naturally.\n\n${dialogueBalanceInstruction()}`
  return `RESPONSE LENGTH\n- Immersive mode: usually answer in about 3-5 substantial paragraphs.\n- Dialogue should carry active character exchanges; use narration to support rather than dominate them.\n- Balance meaningful action, reaction, subtext, and only relevant environmental detail.\n- Do not pad a naturally short exchange just to reach a paragraph count.\n- Always finish the current sentence and scene beat naturally.\n\n${dialogueBalanceInstruction()}`
}

export function roleplayLengthTokenCap(value = getRoleplayResponseLength()): number {
  // Quick is deliberately tight because it is also hard-capped to two rendered paragraphs.
  if (value === 'quick') return 420
  if (value === 'novel') return 1600
  return 1100
}
