export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type CharacterBookEntry = {
  keys: string[]
  content: string
  extensions: Record<string, JsonValue>
  enabled: boolean
  insertion_order: number
  case_sensitive?: boolean
  name?: string
  priority?: number
  id?: number
  comment?: string
  selective?: boolean
  secondary_keys?: string[]
  constant?: boolean
  position?: 'before_char' | 'after_char'
}

export type CharacterBook = {
  name?: string
  description?: string
  scan_depth?: number
  token_budget?: number
  recursive_scanning?: boolean
  extensions: Record<string, JsonValue>
  entries: CharacterBookEntry[]
}

export type CharacterCardV2Data = {
  name: string
  description: string
  personality: string
  scenario: string
  first_mes: string
  mes_example: string
  creator_notes: string
  system_prompt: string
  post_history_instructions: string
  alternate_greetings: string[]
  character_book?: CharacterBook
  tags: string[]
  creator: string
  character_version: string
  extensions: Record<string, JsonValue>
}

export type CharacterCardV2 = {
  spec: 'chara_card_v2'
  spec_version: '2.0'
  data: CharacterCardV2Data
}

export type ValidationResult =
  | { success: true; card: CharacterCardV2 }
  | { success: false; errors: string[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringFields = [
  'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example',
  'creator_notes', 'system_prompt', 'post_history_instructions', 'creator', 'character_version',
] as const

function validateBook(value: unknown, errors: string[]): value is CharacterBook {
  if (!isRecord(value)) {
    errors.push('data.character_book must be an object')
    return false
  }
  if (!Array.isArray(value.entries)) errors.push('data.character_book.entries must be an array')
  if (!isRecord(value.extensions)) errors.push('data.character_book.extensions must be an object')
  for (const field of ['name', 'description'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'string') errors.push(`data.character_book.${field} must be a string when present`)
  }
  for (const field of ['scan_depth', 'token_budget'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'number') errors.push(`data.character_book.${field} must be a number when present`)
  }
  if (value.recursive_scanning !== undefined && typeof value.recursive_scanning !== 'boolean') errors.push('data.character_book.recursive_scanning must be a boolean when present')
  if (!Array.isArray(value.entries)) return false
  value.entries.forEach((entry, index) => {
    const path = `data.character_book.entries[${index}]`
    if (!isRecord(entry)) {
      errors.push(`${path} must be an object`)
      return
    }
    if (!Array.isArray(entry.keys) || !entry.keys.every((key) => typeof key === 'string')) errors.push(`${path}.keys must be a string array`)
    if (typeof entry.content !== 'string') errors.push(`${path}.content must be a string`)
    if (typeof entry.enabled !== 'boolean') errors.push(`${path}.enabled must be a boolean`)
    if (typeof entry.insertion_order !== 'number') errors.push(`${path}.insertion_order must be a number`)
    if (!isRecord(entry.extensions)) errors.push(`${path}.extensions must be an object`)
    for (const field of ['name', 'comment'] as const) {
      if (entry[field] !== undefined && typeof entry[field] !== 'string') errors.push(`${path}.${field} must be a string when present`)
    }
    for (const field of ['priority', 'id'] as const) {
      if (entry[field] !== undefined && typeof entry[field] !== 'number') errors.push(`${path}.${field} must be a number when present`)
    }
    for (const field of ['case_sensitive', 'selective', 'constant'] as const) {
      if (entry[field] !== undefined && typeof entry[field] !== 'boolean') errors.push(`${path}.${field} must be a boolean when present`)
    }
    if (entry.secondary_keys !== undefined && (!Array.isArray(entry.secondary_keys) || !entry.secondary_keys.every((key) => typeof key === 'string'))) errors.push(`${path}.secondary_keys must be a string array when present`)
    if (entry.position !== undefined && entry.position !== 'before_char' && entry.position !== 'after_char') errors.push(`${path}.position must be "before_char" or "after_char" when present`)
  })
  return errors.length === 0
}

export function validateCharacterCardV2(value: unknown): ValidationResult {
  const errors: string[] = []
  if (!isRecord(value)) return { success: false, errors: ['Card must be a JSON object'] }
  if (value.spec !== 'chara_card_v2') errors.push('spec must be "chara_card_v2"')
  if (value.spec_version !== '2.0') errors.push('spec_version must be "2.0"')
  if (!isRecord(value.data)) return { success: false, errors: [...errors, 'data must be an object'] }

  const data = value.data
  for (const field of stringFields) {
    if (typeof data[field] !== 'string') errors.push(`data.${field} must be a string`)
  }
  if (!Array.isArray(data.alternate_greetings) || !data.alternate_greetings.every((item) => typeof item === 'string')) {
    errors.push('data.alternate_greetings must be a string array')
  }
  if (!Array.isArray(data.tags) || !data.tags.every((item) => typeof item === 'string')) errors.push('data.tags must be a string array')
  if (!isRecord(data.extensions)) errors.push('data.extensions must be an object')
  if (data.character_book !== undefined) validateBook(data.character_book, errors)

  return errors.length > 0
    ? { success: false, errors }
    : { success: true, card: value as CharacterCardV2 }
}

export function createEmptyCharacterCardV2(): CharacterCardV2 {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '', description: '', personality: '', scenario: '', first_mes: '', mes_example: '',
      creator_notes: '', system_prompt: '', post_history_instructions: '', alternate_greetings: [],
      tags: [], creator: '', character_version: '1.0', extensions: {},
    },
  }
}

export function importCharacterCardV2(json: string): CharacterCardV2 {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('The file is not valid JSON.')
  }
  const result = validateCharacterCardV2(value)
  if (!result.success) throw new Error(result.errors.join('\n'))
  return result.card
}

export function exportCharacterCardV2(card: CharacterCardV2): string {
  const result = validateCharacterCardV2(card)
  if (!result.success) throw new Error(result.errors.join('\n'))
  return JSON.stringify(result.card, null, 2)
}
