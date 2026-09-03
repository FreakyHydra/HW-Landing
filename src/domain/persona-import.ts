import type { Persona } from './persona.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : []
}

function isoDate(value: unknown, fallback: string): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString()
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString()
  return fallback
}

function section(label: string, values: string[]): string {
  return values.length ? `${label}: ${values.join('; ')}` : ''
}

export function importHowlingWhispersPersona(json: string, now = new Date().toISOString()): Persona {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error('The selected file is not valid JSON.') }
  if (!isRecord(parsed)) throw new Error('The selected persona file must contain a JSON object.')

  const source = parsed.format === 'howling-whispers-persona' && isRecord(parsed.persona) ? parsed.persona : parsed
  if (!isRecord(source)) throw new Error('The selected file does not contain persona data.')

  const name = stringValue(source.name)
  if (!name) throw new Error('Imported persona requires a name.')

  const identity = isRecord(source.identity) ? source.identity : {}
  const personalityTraits = stringList(source.personalityTraits)
  const roleplayGuidance = stringList(source.roleplayGuidance)
  const boundaries = stringList(source.boundaries)
  const likes = stringList(source.likes)
  const dislikes = stringList(source.dislikes)
  const interests = stringList(source.interests)
  const habits = stringList(source.habits)
  const memoryPriorities = stringList(source.memoryPriorities)

  const notes = [
    stringValue(source.notes),
    section('Likes', likes),
    section('Dislikes', dislikes),
    section('Interests', interests),
    section('Habits', habits),
    section('Roleplay guidance', roleplayGuidance),
    section('Boundaries', boundaries),
    section('Memory priorities', memoryPriorities),
    stringValue(identity.notes) && `Identity notes: ${stringValue(identity.notes)}`,
  ].filter(Boolean).join('\n\n')

  return {
    id: stringValue(source.id) || `persona-${crypto.randomUUID()}`,
    name,
    pronouns: stringValue(source.pronouns) || stringValue(identity.pronouns),
    description: stringValue(source.description),
    appearance: stringValue(source.appearance) || stringValue(identity.presentation),
    personality: personalityTraits.length ? personalityTraits.join(', ') : stringValue(source.personality),
    background: stringValue(source.background),
    notes,
    createdAt: isoDate(source.createdAt, now),
    updatedAt: isoDate(source.updatedAt, now),
  }
}
