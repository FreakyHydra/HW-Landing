export type RoleplayTextColors = {
  dialogue: string
  action: string
  narration: string
}

const STORAGE_KEY = 'hw.roleplay.text-colors.v1'

export const SANDBOX_ROLEPLAY_TEXT_COLORS: RoleplayTextColors = {
  dialogue: '#e8e4d9',
  action: '#8ab4c8',
  narration: '#9a9f7a',
}

function validColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

export function getRoleplayTextColors(): RoleplayTextColors {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<RoleplayTextColors>
    return {
      dialogue: validColor(parsed.dialogue, SANDBOX_ROLEPLAY_TEXT_COLORS.dialogue),
      action: validColor(parsed.action, SANDBOX_ROLEPLAY_TEXT_COLORS.action),
      narration: validColor(parsed.narration, SANDBOX_ROLEPLAY_TEXT_COLORS.narration),
    }
  } catch {
    return { ...SANDBOX_ROLEPLAY_TEXT_COLORS }
  }
}

export function saveRoleplayTextColors(colors: RoleplayTextColors): RoleplayTextColors {
  const saved = {
    dialogue: validColor(colors.dialogue, SANDBOX_ROLEPLAY_TEXT_COLORS.dialogue),
    action: validColor(colors.action, SANDBOX_ROLEPLAY_TEXT_COLORS.action),
    narration: validColor(colors.narration, SANDBOX_ROLEPLAY_TEXT_COLORS.narration),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  return saved
}

export function resetRoleplayTextColors(): RoleplayTextColors {
  localStorage.removeItem(STORAGE_KEY)
  return { ...SANDBOX_ROLEPLAY_TEXT_COLORS }
}
